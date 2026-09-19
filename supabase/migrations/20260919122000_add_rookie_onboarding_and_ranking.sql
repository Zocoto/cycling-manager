begin;

-- A rookie remains eligible until they have completed one whole season. A
-- partial arrival season therefore does not consume their only rookie year.
create or replace function public.get_rookie_team_eligibility(
  p_season_id uuid default null
)
returns table (
  team_id uuid,
  sporting_director_id uuid,
  joined_at timestamptz,
  arrival_game_year integer,
  first_full_season_game_year integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_season as (
    select season.id, season.game_year
    from public.seasons as season
    where season.id = coalesce(
      p_season_id,
      (select active.id from public.seasons as active
       where active.status = 'active' limit 1)
    )
  )
  select
    generation.team_id,
    generation.sporting_director_id,
    generation.created_at,
    arrival_season.game_year,
    case
      when (generation.created_at at time zone 'Europe/Paris')::date
        <= arrival_season.starts_on
      then arrival_season.game_year
      else arrival_season.game_year + 1
    end
  from public.initial_career_generations as generation
  join public.seasons as arrival_season
    on arrival_season.id = generation.season_id
  join target_season on true
  join public.team_seasons as target_team
    on target_team.team_id = generation.team_id
   and target_team.season_id = target_season.id
   and target_team.status <> 'withdrawn'
  join public.sporting_directors as director
    on director.id = generation.sporting_director_id
   and director.status = 'active'
  where not exists (
    select 1
    from public.alpha_bot_managers as bot
    where bot.sporting_director_id = generation.sporting_director_id
  )
    and not exists (
      select 1
      from public.seasons as completed_season
      join public.team_seasons as completed_team
        on completed_team.team_id = generation.team_id
       and completed_team.season_id = completed_season.id
       and completed_team.status = 'completed'
      where completed_season.status = 'completed'
        and completed_season.game_year < target_season.game_year
        and completed_season.starts_on >=
          (generation.created_at at time zone 'Europe/Paris')::date
    )
  order by generation.created_at, generation.team_id;
$$;

revoke all on function public.get_rookie_team_eligibility(uuid)
  from public, anon;
grant execute on function public.get_rookie_team_eligibility(uuid)
  to authenticated, service_role;

-- The social badge deliberately has a shorter, real-time lifespan than the
-- sporting rookie ranking.
create or replace function public.get_global_chat_rookie_status(
  p_sporting_director_ids uuid[]
)
returns table (
  sporting_director_id uuid,
  badge_expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    generation.sporting_director_id,
    generation.created_at + interval '21 days'
  from public.initial_career_generations as generation
  join public.sporting_directors as director
    on director.id = generation.sporting_director_id
   and director.status = 'active'
  where (select auth.uid()) is not null
    and cardinality(coalesce(p_sporting_director_ids, array[]::uuid[])) <= 100
    and generation.sporting_director_id = any(
      coalesce(p_sporting_director_ids, array[]::uuid[])
    )
    and generation.created_at + interval '21 days' > pg_catalog.now()
    and not exists (
      select 1 from public.alpha_bot_managers as bot
      where bot.sporting_director_id = generation.sporting_director_id
    )
  order by generation.created_at;
$$;

revoke all on function public.get_global_chat_rookie_status(uuid[])
  from public, anon;
grant execute on function public.get_global_chat_rookie_status(uuid[])
  to authenticated, service_role;

create table public.rookie_season_rewards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  target_team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  sporting_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  rookie_rank smallint not null,
  uci_points integer not null,
  reward_items jsonb not null,
  granted_at timestamptz not null default now(),
  constraint rookie_season_rewards_rank_range
    check (rookie_rank between 1 and 3),
  constraint rookie_season_rewards_points_non_negative
    check (uci_points >= 0),
  constraint rookie_season_rewards_items_array
    check (jsonb_typeof(reward_items) = 'array'),
  unique (season_id, rookie_rank),
  unique (season_id, team_id)
);

create index rookie_season_rewards_director_idx
  on public.rookie_season_rewards (sporting_director_id, granted_at desc);

alter table public.rookie_season_rewards enable row level security;
create policy rookie_season_rewards_read_authenticated
  on public.rookie_season_rewards for select to authenticated using (true);
grant select on public.rookie_season_rewards to authenticated;
grant all privileges on public.rookie_season_rewards to service_role;

create or replace function private.settle_rookie_season_rewards(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season record;
  v_winner record;
  v_target_team_season_id uuid;
  v_reward_items text[];
  v_reward_labels text;
  v_item_key text;
  v_created integer := 0;
begin
  select season.id, season.name, season.game_year, season.status
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found or v_season.status <> 'completed' then
    return 0;
  end if;

  for v_winner in
    select
      ranked.team_id,
      ranked.sporting_director_id,
      ranked.team_name,
      ranked.director_name,
      ranked.points,
      ranked.rookie_rank
    from (
      select
        team_season.team_id,
        eligibility.sporting_director_id,
        team_season.display_name as team_name,
        director.display_name as director_name,
        team_season.points,
        row_number() over (
          order by team_season.points desc, team_season.display_name, team_season.team_id
        )::smallint as rookie_rank
      from public.get_rookie_team_eligibility(p_season_id) as eligibility
      join public.team_seasons as team_season
        on team_season.team_id = eligibility.team_id
       and team_season.season_id = p_season_id
       and team_season.status = 'completed'
      join public.sporting_directors as director
        on director.id = eligibility.sporting_director_id
      where team_season.points > 0
    ) as ranked
    where ranked.rookie_rank <= 3
    order by ranked.rookie_rank
  loop
    select target_team.id
    into v_target_team_season_id
    from public.seasons as target_season
    join public.team_seasons as target_team
      on target_team.season_id = target_season.id
     and target_team.team_id = v_winner.team_id
    where target_season.game_year = v_season.game_year + 1
      and target_team.status <> 'withdrawn'
    limit 1;

    if v_target_team_season_id is null then
      continue;
    end if;

    v_reward_items := case v_winner.rookie_rank
      when 1 then array[
        'custom-staff-mandate',
        'classified-talent-dossier',
        'precision-architect-tee'
      ]::text[]
      when 2 then array['potential-notebook', 'construction-square']::text[]
      else array['medallion-panache']::text[]
    end;
    v_reward_labels := case v_winner.rookie_rank
      when 1 then 'un staff sur mesure, un bonus de potentiel et 7 jours de chantier gagnés'
      when 2 then 'un bonus de potentiel et 2 jours de chantier gagnés'
      else 'un médaillon Panache'
    end;

    if exists (
      select 1
      from unnest(v_reward_items) as expected(item_key)
      where not exists (
        select 1 from public.inventory_catalog_items as item
        where item.item_key = expected.item_key and item.status = 'active'
      )
    ) then
      raise exception 'Le catalogue rookie est incomplet pour la place %.',
        v_winner.rookie_rank;
    end if;

    insert into public.rookie_season_rewards (
      season_id, target_team_season_id, team_id, sporting_director_id,
      rookie_rank, uci_points, reward_items
    ) values (
      p_season_id, v_target_team_season_id, v_winner.team_id,
      v_winner.sporting_director_id, v_winner.rookie_rank,
      v_winner.points, to_jsonb(v_reward_items)
    )
    on conflict (season_id, team_id) do nothing;

    if not found then
      continue;
    end if;

    foreach v_item_key in array v_reward_items loop
      insert into public.team_item_inventory (
        team_season_id, inventory_item_id, quantity,
        acquisition_source, acquired_at, updated_at
      )
      select
        v_target_team_season_id,
        item.id,
        1,
        'Podium rookie ' || v_season.name || ' · place ' || v_winner.rookie_rank,
        now(),
        now()
      from public.inventory_catalog_items as item
      where item.item_key = v_item_key
      on conflict (team_season_id, inventory_item_id) do update set
        quantity = public.team_item_inventory.quantity + 1,
        updated_at = now();
    end loop;

    insert into public.sporting_director_messages (
      sporting_director_id, season_id, team_season_id, message_type,
      sender_name, subject, preview, body, action_href, action_label,
      source_reference, is_important
    ) values (
      v_winner.sporting_director_id,
      p_season_id,
      v_target_team_season_id,
      'system',
      'Assistant du DS',
      'Podium du classement rookie',
      'Votre ' || v_winner.rookie_rank || case
        when v_winner.rookie_rank = 1 then 're'
        else 'e'
      end || ' place vous rapporte plusieurs cadeaux.',
      'Bravo ! ' || v_winner.team_name || ' termine ' ||
        v_winner.rookie_rank || case
          when v_winner.rookie_rank = 1 then 're'
          else 'e'
        end || ' du classement rookie avec ' || v_winner.points ||
        ' points UCI. Vous recevez ' || v_reward_labels ||
        ', disponibles dans votre inventaire de la nouvelle saison.',
      '/jeu/classements?circuit=uci&vue=rookies',
      'Voir le classement rookie',
      'rookie-season-reward:' || p_season_id::text || ':' || v_winner.team_id::text,
      true
    ) on conflict (sporting_director_id, source_reference) do nothing;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function private.settle_rookie_season_rewards(uuid)
  from public, anon, authenticated;
grant execute on function private.settle_rookie_season_rewards(uuid)
  to service_role;

create or replace function private.settle_rookie_rewards_after_season_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform private.settle_rookie_season_rewards(new.id);
  end if;
  return new;
end;
$$;

create trigger settle_rookie_rewards_after_season_completion
after update of status on public.seasons
for each row execute function private.settle_rookie_rewards_after_season_completion();

revoke all on function private.settle_rookie_rewards_after_season_completion()
  from public, anon, authenticated;

-- If a target team season is ever provisioned after an exceptional manual
-- closure, this retry path grants the still-pending rookie podium safely.
create or replace function private.retry_rookie_rewards_after_team_season_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_season_id uuid;
begin
  select previous.id into v_previous_season_id
  from public.seasons as current_season
  join public.seasons as previous
    on previous.game_year = current_season.game_year - 1
   and previous.status = 'completed'
  where current_season.id = new.season_id;

  if v_previous_season_id is not null then
    perform private.settle_rookie_season_rewards(v_previous_season_id);
  end if;
  return new;
end;
$$;

create trigger retry_rookie_rewards_after_team_season_insert
after insert on public.team_seasons
for each row execute function private.retry_rookie_rewards_after_team_season_insert();

revoke all on function private.retry_rookie_rewards_after_team_season_insert()
  from public, anon, authenticated;

create or replace function private.send_rookie_chat_welcome()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_season_id uuid;
begin
  if exists (
    select 1 from public.alpha_bot_managers as bot
    where bot.sporting_director_id = new.sporting_director_id
  ) then
    return new;
  end if;

  select team_season.id into v_team_season_id
  from public.team_seasons as team_season
  where team_season.team_id = new.team_id
    and team_season.season_id = new.season_id
  limit 1;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important
  ) values (
    new.sporting_director_id,
    new.season_id,
    v_team_season_id,
    'system',
    'Assistant du DS',
    'Bienvenue dans le peloton !',
    'Le chat général est le meilleur endroit pour rencontrer les autres DS.',
    'Présentez votre équipe dans le chat, partagez votre prochain objectif ou posez vos questions tactiques. Votre badge Rookie aidera les membres à vous repérer et à vous répondre pendant vos trois premières semaines.',
    '/jeu/chat',
    'Se présenter au peloton',
    'rookie-chat-welcome:' || new.id::text,
    false
  ) on conflict (sporting_director_id, source_reference) do nothing;

  return new;
end;
$$;

create trigger send_rookie_chat_welcome
after insert on public.initial_career_generations
for each row execute function private.send_rookie_chat_welcome();

revoke all on function private.send_rookie_chat_welcome()
  from public, anon, authenticated;

-- Current newcomers receive the same invitation immediately on deployment.
insert into public.sporting_director_messages (
  sporting_director_id, season_id, team_season_id, message_type,
  sender_name, subject, preview, body, action_href, action_label,
  source_reference, is_important
)
select
  generation.sporting_director_id,
  generation.season_id,
  team_season.id,
  'system',
  'Assistant du DS',
  'Bienvenue dans le peloton !',
  'Le chat général est le meilleur endroit pour rencontrer les autres DS.',
  'Présentez votre équipe dans le chat, partagez votre prochain objectif ou posez vos questions tactiques. Votre badge Rookie aidera les membres à vous repérer et à vous répondre pendant vos trois premières semaines.',
  '/jeu/chat',
  'Se présenter au peloton',
  'rookie-chat-welcome:' || generation.id::text,
  false
from public.initial_career_generations as generation
left join public.team_seasons as team_season
  on team_season.team_id = generation.team_id
 and team_season.season_id = generation.season_id
join public.sporting_directors as director
  on director.id = generation.sporting_director_id
 and director.status = 'active'
where generation.created_at + interval '21 days' > now()
  and not exists (
    select 1 from public.alpha_bot_managers as bot
    where bot.sporting_director_id = generation.sporting_director_id
  )
on conflict (sporting_director_id, source_reference) do nothing;

comment on function public.get_rookie_team_eligibility(uuid) is
  'Retourne les équipes humaines qui n’ont encore achevé aucune saison complète avant la saison ciblée.';
comment on function public.get_global_chat_rookie_status(uuid[]) is
  'Expose aux membres connectés les badges Rookie actifs pendant 21 jours.';
comment on table public.rookie_season_rewards is
  'Registre idempotent du podium rookie et des cadeaux versés dans la saison suivante.';

notify pgrst, 'reload schema';

commit;
