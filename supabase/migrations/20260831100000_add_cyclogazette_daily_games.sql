begin;

create table public.cyclogazette_game_completions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references public.cyclogazette_editions(id)
    on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  game_type text not null,
  reward_cash numeric(14, 2) not null default 1000,
  completed_at timestamptz not null default now(),
  constraint cyclogazette_game_completions_game_allowed
    check (game_type in ('sudoku', 'crossword')),
  constraint cyclogazette_game_completions_reward_valid
    check (reward_cash >= 0),
  constraint cyclogazette_game_completions_once
    unique (edition_id, sporting_director_id, game_type)
);

create index cyclogazette_game_completions_edition_idx
  on public.cyclogazette_game_completions (
    edition_id,
    completed_at,
    sporting_director_id
  );

create index cyclogazette_game_completions_director_idx
  on public.cyclogazette_game_completions (
    sporting_director_id,
    edition_id
  );

alter table public.cyclogazette_game_completions enable row level security;

create policy cyclogazette_game_completions_select_own
on public.cyclogazette_game_completions
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id = sporting_director_id
      and director.auth_user_id = (select auth.uid())
  )
);

grant select on public.cyclogazette_game_completions to authenticated;
grant all privileges on public.cyclogazette_game_completions to service_role;

alter table public.reward_events
  drop constraint if exists reward_events_source_type_allowed;
alter table public.reward_events
  add constraint reward_events_source_type_allowed check (
    source_type in (
      'race_result', 'stage_result', 'mountain_prime',
      'intermediate_sprint', 'secondary_classification',
      'game_objective', 'sponsor_objective', 'division_bonus',
      'special_ability', 'staff_daily', 'mixed_zone_event',
      'gazette_game'
    )
  );

create or replace function public.get_cyclogazette_game_summary(
  p_edition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_director_id uuid;
  v_viewer_completed jsonb := '[]'::jsonb;
  v_completers jsonb := '[]'::jsonb;
  v_total_completers integer := 0;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour consulter les jeux.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(completion.game_type order by completion.game_type), '[]'::jsonb)
  into v_viewer_completed
  from public.cyclogazette_game_completions as completion
  where completion.edition_id = p_edition_id
    and completion.sporting_director_id = v_director_id;

  select count(distinct completion.sporting_director_id)::integer
  into v_total_completers
  from public.cyclogazette_game_completions as completion
  where completion.edition_id = p_edition_id
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = completion.sporting_director_id
    );

  with grouped as (
    select
      director.display_name,
      array_agg(completion.game_type order by completion.game_type) as completed_games,
      max(completion.completed_at) as latest_completion,
      count(distinct completion.game_type) as game_count
    from public.cyclogazette_game_completions as completion
    join public.sporting_directors as director
      on director.id = completion.sporting_director_id
    where completion.edition_id = p_edition_id
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
    group by completion.sporting_director_id, director.display_name
    order by game_count desc, latest_completion asc, director.display_name asc
    limit 24
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'directorName', grouped.display_name,
        'completedGames', to_jsonb(grouped.completed_games)
      )
      order by grouped.game_count desc, grouped.latest_completion asc, grouped.display_name asc
    ),
    '[]'::jsonb
  )
  into v_completers
  from grouped;

  return jsonb_build_object(
    'viewerCompleted', v_viewer_completed,
    'completers', v_completers,
    'totalCompleters', greatest(coalesce(v_total_completers, 0), 0)
  );
end;
$$;

create or replace function public.complete_cyclogazette_game_for_user(
  p_auth_user_id uuid,
  p_edition_id uuid,
  p_game_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_completion_id uuid;
  v_trophy_id uuid;
  v_trophy_unlocked boolean := false;
  v_streak_complete boolean := false;
  v_now timestamptz := now();
  v_game_reward numeric(14, 2) := 1000;
  v_trophy_cash numeric(14, 2) := 50000;
  v_trophy_experience integer := 250;
  v_trophy_reputation integer := 15;
begin
  if p_auth_user_id is null then
    raise exception 'Le compte utilisateur est obligatoire.';
  end if;

  if p_game_type not in ('sudoku', 'crossword') then
    raise exception 'Ce jeu de La Cyclogazette est inconnu.';
  end if;

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    edition.id as edition_id,
    edition.issue_number,
    edition.season_day_id,
    season_day.day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.cyclogazette_editions as edition
    on edition.id = p_edition_id
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = edition.season_id
  join public.season_days as season_day
    on season_day.id = edition.season_day_id
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
    and edition.id = (
      select latest.id
      from public.cyclogazette_editions as latest
      order by latest.published_at desc
      limit 1
    )
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
    )
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Cette édition ne peut plus attribuer de gain.';
  end if;

  insert into public.cyclogazette_game_completions (
    edition_id,
    sporting_director_id,
    team_season_id,
    game_type,
    reward_cash,
    completed_at
  )
  values (
    v_context.edition_id,
    v_context.director_id,
    v_context.team_season_id,
    p_game_type,
    v_game_reward,
    v_now
  )
  on conflict (edition_id, sporting_director_id, game_type) do nothing
  returning id into v_completion_id;

  if v_completion_id is null then
    return jsonb_build_object(
      'status', 'already-completed',
      'rewardCash', 0,
      'trophyUnlocked', false
    );
  end if;

  update public.team_seasons
  set cash_balance = cash_balance + v_game_reward
  where id = v_context.team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  )
  values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.day_number,
    v_game_reward,
    'other',
    'posted',
    case p_game_type
      when 'sudoku' then 'Jeu de La Cyclogazette : Sudoku réussi'
      else 'Jeu de La Cyclogazette : mots croisés réussis'
    end,
    'cyclogazette-game:' || v_completion_id::text,
    v_now
  );

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    cash_prize,
    description
  )
  values (
    'cyclogazette-game:' || v_completion_id::text,
    'gazette_game',
    v_context.director_id,
    v_context.team_season_id,
    v_game_reward,
    case p_game_type
      when 'sudoku' then 'Sudoku quotidien de La Cyclogazette'
      else 'Mots croisés quotidiens de La Cyclogazette'
    end
  );

  select
    count(*) = 10
    and min(recent.issue_number) = v_context.issue_number - 9
    and max(recent.issue_number) = v_context.issue_number
  into v_streak_complete
  from (
    select edition.issue_number
    from public.cyclogazette_game_completions as completion
    join public.cyclogazette_editions as edition
      on edition.id = completion.edition_id
    where completion.sporting_director_id = v_context.director_id
      and edition.issue_number <= v_context.issue_number
    group by edition.issue_number
    having count(distinct completion.game_type) = 2
    order by edition.issue_number desc
    limit 10
  ) as recent;

  if coalesce(v_streak_complete, false) then
    insert into public.sporting_director_trophies (
      sporting_director_id,
      trophy_key,
      available_at,
      claimed_at
    )
    values (
      v_context.director_id,
      'joueur_inveter',
      v_now,
      v_now
    )
    on conflict (sporting_director_id, trophy_key) do nothing
    returning id into v_trophy_id;

    if v_trophy_id is not null then
      v_trophy_unlocked := true;

      update public.sporting_directors
      set
        experience_points = experience_points + v_trophy_experience,
        reputation_points = reputation_points + v_trophy_reputation
      where id = v_context.director_id;

      update public.team_seasons
      set cash_balance = cash_balance + v_trophy_cash
      where id = v_context.team_season_id;

      insert into public.team_finance_transactions (
        team_season_id,
        season_day_id,
        day_number,
        amount,
        category,
        status,
        description,
        source_reference,
        posted_at
      )
      values (
        v_context.team_season_id,
        v_context.season_day_id,
        v_context.day_number,
        v_trophy_cash,
        'other',
        'posted',
        'Trophée caché : Joueur invétéré',
        'cyclogazette-trophy:' || v_trophy_id::text,
        v_now
      );

      insert into public.reward_events (
        source_reference,
        source_type,
        sporting_director_id,
        team_season_id,
        reputation_points,
        experience_points,
        cash_prize,
        description
      )
      values (
        'cyclogazette-trophy:' || v_trophy_id::text,
        'gazette_game',
        v_context.director_id,
        v_context.team_season_id,
        v_trophy_reputation,
        v_trophy_experience,
        v_trophy_cash,
        'Trophée Joueur invétéré : dix éditions consécutives parfaitement remplies'
      );
    end if;
  end if;

  return jsonb_build_object(
    'status', 'completed',
    'rewardCash', v_game_reward,
    'trophyUnlocked', v_trophy_unlocked
  );
end;
$$;

alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_cyclogazette_games;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'cyclogazette_sudoku_completions' then
      select count(*)::integer
      into v_value
      from public.cyclogazette_game_completions as completion
      where completion.sporting_director_id = p_director_id
        and completion.game_type = 'sudoku';

    when 'cyclogazette_crossword_completions' then
      select count(*)::integer
      into v_value
      from public.cyclogazette_game_completions as completion
      where completion.sporting_director_id = p_director_id
        and completion.game_type = 'crossword';

    else
      return public.calculate_game_objective_progress_pre_cyclogazette_games(
        p_metric_key,
        p_director_id,
        p_current_team_id,
        p_experience_points
      );
  end case;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order,
  is_active
)
values
  (
    'cyclogazette_sudoku_1', 'secondary', 'gazette_games',
    'Premier carré',
    'Réussir une grille de Sudoku dans La Cyclogazette.',
    'cyclogazette_sudoku_completions', 1,
    5000, 15, 0, null, null, false, 1830, true
  ),
  (
    'cyclogazette_sudoku_5', 'secondary', 'gazette_games',
    'Logique du peloton',
    'Réussir cinq grilles de Sudoku dans La Cyclogazette.',
    'cyclogazette_sudoku_completions', 5,
    15000, 50, 1, null, null, false, 1840, true
  ),
  (
    'cyclogazette_sudoku_20', 'secondary', 'gazette_games',
    'Maître des neuf cases',
    'Réussir vingt grilles de Sudoku dans La Cyclogazette.',
    'cyclogazette_sudoku_completions', 20,
    75000, 200, 8, 'potential-spark', null, false, 1850, true
  ),
  (
    'cyclogazette_crossword_1', 'secondary', 'gazette_games',
    'Premier mot',
    'Réussir une grille de mots croisés dans La Cyclogazette.',
    'cyclogazette_crossword_completions', 1,
    5000, 15, 0, null, null, false, 1860, true
  ),
  (
    'cyclogazette_crossword_5', 'secondary', 'gazette_games',
    'Plume du peloton',
    'Réussir cinq grilles de mots croisés dans La Cyclogazette.',
    'cyclogazette_crossword_completions', 5,
    15000, 50, 1, null, null, false, 1870, true
  ),
  (
    'cyclogazette_crossword_20', 'secondary', 'gazette_games',
    'Dictionnaire de la route',
    'Réussir vingt grilles de mots croisés dans La Cyclogazette.',
    'cyclogazette_crossword_completions', 20,
    75000, 200, 8, 'potential-spark', null, false, 1880, true
  )
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

create or replace function private.validate_inveterate_player_avatar_outfit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_outfit_key text;
begin
  if new.avatar_key is null
     or new.avatar_key not like 'director_custom_v1:%' then
    return new;
  end if;

  v_outfit_key := split_part(
    substring(
      new.avatar_key
      from char_length('director_custom_v1:') + 1
    ),
    '.',
    14
  );

  if v_outfit_key <> 'poker-chips' then
    return new;
  end if;

  if not exists (
    select 1
    from public.sporting_director_trophies as trophy
    where trophy.sporting_director_id = new.id
      and trophy.trophy_key = 'joueur_inveter'
      and trophy.claimed_at is not null
  ) then
    raise exception
      'Le trophée Joueur invétéré est requis pour porter les piles de jetons.';
  end if;

  return new;
end;
$$;

create trigger validate_inveterate_player_avatar_outfit_before_write
before insert or update of avatar_key
on public.sporting_directors
for each row
execute function private.validate_inveterate_player_avatar_outfit();

create or replace function private.notify_sporting_director_trophy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
  v_detail text;
begin
  if new.claimed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.claimed_at is not null then
    return new;
  end if;

  v_title := case new.trophy_key
    when 'alpha_tester' then 'Alphatesteur'
    when 'atlas_peloton' then 'Atlas du peloton'
    when 'campus_de_pointe' then 'Campus de pointe'
    when 'alchimiste_carbone' then 'Alchimiste du carbone'
    when 'triple_couronne_integrale' then 'Triple Couronne intégrale'
    when 'virage_cache' then 'Le Virage caché'
    when 'ambulancier' then 'Ambulancier'
    when 'medecin_urgentiste' then 'Médecin urgentiste'
    when 'peloton_eternel' then 'Le Peloton éternel'
    when 'joueur_inveter' then 'Joueur invétéré'
    else initcap(replace(new.trophy_key, '_', ' '))
  end;
  v_kind := case
    when new.trophy_key in ('ambulancier', 'medecin_urgentiste') then 'medical'
    when new.trophy_key = 'alpha_tester' then 'special'
    else 'achievement'
  end;
  v_detail := case
    when new.trophy_key = 'peloton_eternel' then
      'Récompenses remises : 5 000 000 €, 5 000 XP, 500 points de réputation et 3 objets de niveau 10.'
    when new.trophy_key = 'joueur_inveter' then
      'Récompenses remises : 50 000 €, 250 XP, 15 points de réputation et les piles de jetons pour votre avatar.'
    else
      'Cette distinction de carrière est désormais visible dans votre galerie.'
  end;

  perform private.create_trophy_notification(
    new.sporting_director_id,
    v_kind,
    new.trophy_key,
    v_title,
    'special:' || new.id::text,
    new.claimed_at,
    null,
    null,
    v_detail
  );

  return new;
end;
$$;

revoke all on function public.get_cyclogazette_game_summary(uuid)
  from public, anon;
grant execute on function public.get_cyclogazette_game_summary(uuid)
  to authenticated;

revoke all on function public.complete_cyclogazette_game_for_user(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.complete_cyclogazette_game_for_user(uuid, uuid, text)
  to service_role;

revoke all on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  to service_role;

revoke all on function private.validate_inveterate_player_avatar_outfit()
  from public, anon, authenticated;
revoke all on function private.notify_sporting_director_trophy()
  from public, anon, authenticated;

comment on table public.cyclogazette_game_completions is
  'Une seule réussite récompensée par DS, édition et jeu de La Cyclogazette.';
comment on function public.get_cyclogazette_game_summary(uuid) is
  'Retourne en une lecture compacte les réussites du lecteur et le tableau d’honneur d’une édition.';
comment on function public.complete_cyclogazette_game_for_user(uuid, uuid, text) is
  'Crédite atomiquement un jeu quotidien validé côté serveur et récompense une série parfaite de dix éditions.';

notify pgrst, 'reload schema';

commit;
