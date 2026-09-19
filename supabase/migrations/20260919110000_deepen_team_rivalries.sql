begin;

-- A rivalry created at the start of a season must reflect the sporting order
-- inherited from the previous one.  New teams have no previous rank and are
-- deliberately placed afterwards, by arrival date rather than alphabetically.
alter table public.team_rivalries
  add column if not exists ranking_source_season_id uuid
    references public.seasons(id) on delete set null,
  add column if not exists team_a_previous_rank integer,
  add column if not exists team_b_previous_rank integer,
  add column if not exists team_a_cash_reward numeric(14, 2),
  add column if not exists team_b_cash_reward numeric(14, 2);

alter table public.team_rivalries
  add constraint team_rivalries_previous_ranks_positive check (
    (team_a_previous_rank is null or team_a_previous_rank > 0)
    and (team_b_previous_rank is null or team_b_previous_rank > 0)
  ),
  add constraint team_rivalries_cash_rewards_non_negative check (
    (team_a_cash_reward is null or team_a_cash_reward >= 0)
    and (team_b_cash_reward is null or team_b_cash_reward >= 0)
  );

alter table public.team_rivalries
  drop constraint if exists team_rivalries_scores_consistent;
alter table public.team_rivalries
  add constraint team_rivalries_scores_consistent check (
    team_a_wins + team_b_wins + draws >= shared_races
    and team_a_wins + team_b_wins + draws <= shared_races * 2
  );

alter table public.team_rivalries
  drop constraint if exists team_rivalries_resolution_valid;
alter table public.team_rivalries
  add constraint team_rivalries_resolution_valid check (
    (
      status = 'active'
      and settled_at is null
      and team_a_reputation_delta is null
      and team_b_reputation_delta is null
      and team_a_cash_reward is null
      and team_b_cash_reward is null
    )
    or (
      status = 'completed'
      and settled_at is not null
      and team_a_reputation_delta is not null
      and team_b_reputation_delta is not null
      and team_a_cash_reward is not null
      and team_b_cash_reward is not null
    )
    or status = 'cancelled'
  ) not valid;

-- Historical completed rivalries predate cash prizes.  Their real payout was
-- zero, which lets the new validation remain truthful without retroactive cash.
update public.team_rivalries
set team_a_cash_reward = 0,
    team_b_cash_reward = 0
where status = 'completed'
  and (team_a_cash_reward is null or team_b_cash_reward is null);

alter table public.team_rivalries
  validate constraint team_rivalries_resolution_valid;

create or replace function private.initialize_team_rivalries_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  with season_context as (
    select season.id, season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ), eligible as (
    select
      team_season.id as team_season_id,
      team_season.team_id,
      team_season.display_name as team_name,
      team_season.created_at as joined_at,
      assignment.sporting_director_id,
      director.display_name as director_name,
      director.reputation_points,
      previous_season.id as previous_season_id,
      previous_team_season.final_rank as previous_rank,
      previous_team_season.points as previous_points,
      season_context.game_year,
      row_number() over (
        order by
          case when previous_team_season.final_rank is null then 1 else 0 end,
          previous_team_season.final_rank nulls last,
          previous_team_season.points desc nulls last,
          director.reputation_points desc,
          team_season.created_at,
          team_season.team_id
      ) as pairing_rank
    from season_context
    join public.team_seasons as team_season
      on team_season.season_id = season_context.id
    join public.team_manager_assignments as assignment
      on assignment.team_id = team_season.team_id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
     and director.status = 'active'
    left join public.seasons as previous_season
      on previous_season.game_year = season_context.game_year - 1
     and previous_season.status = 'completed'
    left join public.team_seasons as previous_team_season
      on previous_team_season.season_id = previous_season.id
     and previous_team_season.team_id = team_season.team_id
     and previous_team_season.status = 'completed'
    where team_season.status = 'active'
      and not exists (
        select 1
        from public.alpha_bot_managers as bot
        where bot.sporting_director_id = director.id
      )
      and not exists (
        select 1
        from public.team_rivalries as rivalry
        where rivalry.season_id = p_season_id
          and rivalry.status = 'active'
          and team_season.team_id in (rivalry.team_a_id, rivalry.team_b_id)
      )
  ), paired as (
    select
      a.*,
      b.team_season_id as b_team_season_id,
      b.team_id as b_team_id,
      b.team_name as b_team_name,
      b.sporting_director_id as b_director_id,
      b.director_name as b_director_name,
      b.pairing_rank as b_pairing_rank,
      b.previous_rank as b_previous_rank
    from eligible as a
    join eligible as b on b.pairing_rank = a.pairing_rank + 1
    where mod(a.pairing_rank, 2) = 1
  )
  insert into public.team_rivalries (
    season_id, team_a_id, team_b_id, team_a_season_id, team_b_season_id,
    team_a_director_id, team_b_director_id, team_a_name, team_b_name,
    team_a_director_name, team_b_director_name,
    pairing_reason, team_a_pairing_rank, team_b_pairing_rank,
    ranking_source_season_id, team_a_previous_rank, team_b_previous_rank
  )
  select
    p_season_id,
    paired.team_id,
    paired.b_team_id,
    paired.team_season_id,
    paired.b_team_season_id,
    paired.sporting_director_id,
    paired.b_director_id,
    paired.team_name,
    paired.b_team_name,
    paired.director_name,
    paired.b_director_name,
    case
      when paired.previous_rank is not null and paired.b_previous_rank is not null
        then 'Classement UCI final S' || (paired.game_year - 1)
          || ' : #' || paired.previous_rank || ' et #'
          || paired.b_previous_rank || ', deux voisins directs.'
      when paired.previous_rank is null and paired.b_previous_rank is null
        then 'Nouvelles équipes sans classement en S'
          || (paired.game_year - 1) || ', associées selon leur ordre d’arrivée.'
      else 'Ordre sportif final S' || (paired.game_year - 1)
        || ', complété par l’ordre d’arrivée pour les équipes sans historique.'
    end,
    paired.pairing_rank,
    paired.b_pairing_rank,
    paired.previous_season_id,
    paired.previous_rank,
    paired.b_previous_rank
  from paired
  on conflict (season_id, team_a_id, team_b_id) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke all on function private.initialize_team_rivalries_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.initialize_team_rivalries_for_season(uuid)
  to service_role;

-- Piques are predefined: they are visible in the Gazette, raise intensity and
-- only affect the score when both rivals choose to engage.  This prevents a
-- unilateral message from granting a free sporting advantage.
create table public.team_rivalry_taunts (
  id uuid primary key default gen_random_uuid(),
  rivalry_id uuid not null
    references public.team_rivalries(id) on delete cascade,
  season_id uuid not null
    references public.seasons(id) on delete cascade,
  sender_team_id uuid not null
    references public.teams(id) on delete cascade,
  recipient_team_id uuid not null
    references public.teams(id) on delete cascade,
  sender_director_id uuid not null
    references public.sporting_directors(id) on delete cascade,
  taunt_code text not null,
  quote text not null,
  intensity_delta integer not null default 2,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_race_edition_id uuid
    references public.race_editions(id) on delete set null,
  bonus_winner_team_id uuid
    references public.teams(id) on delete set null,
  constraint team_rivalry_taunts_distinct_teams
    check (sender_team_id <> recipient_team_id),
  constraint team_rivalry_taunts_code_allowed check (
    taunt_code in ('scoreboard', 'road', 'pressure', 'appointment')
  ),
  constraint team_rivalry_taunts_quote_present check (btrim(quote) <> ''),
  constraint team_rivalry_taunts_intensity check (intensity_delta between 1 and 5),
  constraint team_rivalry_taunts_resolution_consistent check (
    (resolved_at is null and resolved_race_edition_id is null and bonus_winner_team_id is null)
    or (resolved_at is not null and resolved_race_edition_id is not null)
  )
);

create unique index team_rivalry_taunts_one_pending_per_team_idx
  on public.team_rivalry_taunts (rivalry_id, sender_team_id)
  where resolved_at is null;
create index team_rivalry_taunts_gazette_idx
  on public.team_rivalry_taunts (season_id, created_at desc);

alter table public.team_rivalry_taunts enable row level security;
create policy team_rivalry_taunts_select_authenticated
  on public.team_rivalry_taunts for select to authenticated using (true);
grant select on public.team_rivalry_taunts to authenticated;
grant all privileges on public.team_rivalry_taunts to service_role;

create or replace function public.send_current_team_rivalry_taunt(
  p_rivalry_id uuid,
  p_taunt_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_sender_team_id uuid;
  v_rivalry public.team_rivalries%rowtype;
  v_recipient_team_id uuid;
  v_recipient_director_id uuid;
  v_recipient_team_season_id uuid;
  v_sender_team_name text;
  v_sender_director_name text;
  v_quote text;
  v_taunt_id uuid;
begin
  select director.id, assignment.team_id, director.display_name
  into v_director_id, v_sender_team_id, v_sender_director_name
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_director_id is null then
    raise exception 'Directeur sportif actif introuvable.';
  end if;

  select rivalry.* into v_rivalry
  from public.team_rivalries as rivalry
  where rivalry.id = p_rivalry_id
  for update;

  if v_rivalry.id is null
    or v_rivalry.status <> 'active'
    or v_sender_team_id not in (v_rivalry.team_a_id, v_rivalry.team_b_id)
  then
    raise exception 'Cette rivalité active ne vous appartient pas.';
  end if;

  if exists (
    select 1
    from public.team_rivalry_taunts as taunt
    where taunt.rivalry_id = v_rivalry.id
      and taunt.sender_team_id = v_sender_team_id
      and taunt.resolved_at is null
  ) then
    raise exception 'Votre précédente pique attend encore la prochaine confrontation.';
  end if;

  v_quote := case p_taunt_code
    when 'scoreboard' then 'Regardez bien le score : la prochaine ligne sera encore pour nous.'
    when 'road' then 'La route départagera les discours. Préparez-vous à suivre.'
    when 'pressure' then 'Cette rivalité commence à peser. De notre côté, elle nous porte.'
    when 'appointment' then 'Rendez-vous sur la prochaine course commune : nous ne laisserons aucun doute.'
    else null
  end;
  if v_quote is null then
    raise exception 'Cette pique ne fait pas partie des déclarations autorisées.';
  end if;

  if v_sender_team_id = v_rivalry.team_a_id then
    v_recipient_team_id := v_rivalry.team_b_id;
    v_recipient_director_id := v_rivalry.team_b_director_id;
    v_recipient_team_season_id := v_rivalry.team_b_season_id;
    v_sender_team_name := v_rivalry.team_a_name;
  else
    v_recipient_team_id := v_rivalry.team_a_id;
    v_recipient_director_id := v_rivalry.team_a_director_id;
    v_recipient_team_season_id := v_rivalry.team_a_season_id;
    v_sender_team_name := v_rivalry.team_b_name;
  end if;

  insert into public.team_rivalry_taunts (
    rivalry_id, season_id, sender_team_id, recipient_team_id,
    sender_director_id, taunt_code, quote
  ) values (
    v_rivalry.id, v_rivalry.season_id, v_sender_team_id,
    v_recipient_team_id, v_director_id, p_taunt_code, v_quote
  ) returning id into v_taunt_id;

  update public.team_rivalries
  set intensity = intensity + 2
  where id = v_rivalry.id;

  insert into public.sporting_director_messages (
    sporting_director_id, season_id, team_season_id, message_type,
    sender_name, subject, preview, body, action_href, action_label,
    source_reference, is_important
  ) values (
    v_recipient_director_id,
    v_rivalry.season_id,
    v_recipient_team_season_id,
    'system',
    'La Cyclogazette',
    v_sender_team_name || ' vous lance une pique',
    'Votre rival fait monter la pression avant votre prochaine confrontation.',
    v_sender_director_name || ' déclare : « ' || v_quote
      || ' » Si vous répondez, la prochaine course commune attribuera deux points au vainqueur du duel.',
    '/jeu/gazette?onglet=rivalites',
    'Répondre au rival',
    'team-rivalry-taunt:' || v_taunt_id,
    true
  ) on conflict (sporting_director_id, source_reference) do nothing;

  return jsonb_build_object(
    'id', v_taunt_id,
    'quote', v_quote,
    'intensityDelta', 2
  );
end;
$$;

revoke all on function public.send_current_team_rivalry_taunt(uuid, text)
  from public, anon;
grant execute on function public.send_current_team_rivalry_taunt(uuid, text)
  to authenticated;

alter table public.team_rivalry_events
  add column if not exists stakes_bonus integer not null default 0,
  add column if not exists was_heated boolean not null default false;

alter table public.team_rivalry_events
  drop constraint if exists team_rivalry_events_intensity_positive;
alter table public.team_rivalry_events
  add constraint team_rivalry_events_intensity_positive check (
    intensity_delta between 1 and 13 and intensity_after >= intensity_delta
  );

alter table public.team_rivalry_events
  drop constraint if exists team_rivalry_events_points_valid;
alter table public.team_rivalry_events
  add constraint team_rivalry_events_points_valid check (
    team_a_points between 0 and 2
    and team_b_points between 0 and 2
    and team_a_points + team_b_points <= 2
  );

alter table public.team_rivalry_events
  drop constraint if exists team_rivalry_events_outcome_consistent;
alter table public.team_rivalry_events
  add constraint team_rivalry_events_outcome_consistent check (
    (
      is_draw and team_a_points = 0 and team_b_points = 0
      and winner_team_id is null
    )
    or (
      not is_draw
      and team_a_points + team_b_points in (1, 2)
      and winner_team_id is not null
    )
  );

alter table public.team_rivalry_events
  add constraint team_rivalry_events_stakes_consistent check (
    stakes_bonus in (0, 1)
    and (not was_heated or stakes_bonus = 1)
    and (was_heated or stakes_bonus = 0)
  );

create or replace function private.update_team_rivalries_after_race(
  p_race_edition_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rivalry record;
  v_team_a_rank integer;
  v_team_b_rank integer;
  v_team_a_points integer;
  v_team_b_points integer;
  v_is_draw boolean;
  v_winner_team_id uuid;
  v_intensity_delta integer;
  v_team_a_has_taunt boolean;
  v_team_b_has_taunt boolean;
  v_was_heated boolean;
  v_stakes_bonus integer;
  v_inserted_id uuid;
  v_updated integer := 0;
begin
  for v_rivalry in
    select rivalry.*
    from public.team_rivalries as rivalry
    join public.race_editions as edition
      on edition.id = p_race_edition_id
     and edition.season_id = rivalry.season_id
    where rivalry.status = 'active'
    for update of rivalry
  loop
    select
      min(result.final_rank) filter (
        where registration.team_season_id = v_rivalry.team_a_season_id
      ),
      min(result.final_rank) filter (
        where registration.team_season_id = v_rivalry.team_b_season_id
      )
    into v_team_a_rank, v_team_b_rank
    from public.race_results as result
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    where result.race_edition_id = p_race_edition_id
      and result.status = 'classified'
      and registration.team_season_id in (
        v_rivalry.team_a_season_id, v_rivalry.team_b_season_id
      );

    if v_team_a_rank is null or v_team_b_rank is null then
      continue;
    end if;

    select
      coalesce(bool_or(taunt.sender_team_id = v_rivalry.team_a_id), false),
      coalesce(bool_or(taunt.sender_team_id = v_rivalry.team_b_id), false)
    into v_team_a_has_taunt, v_team_b_has_taunt
    from public.team_rivalry_taunts as taunt
    where taunt.rivalry_id = v_rivalry.id
      and taunt.resolved_at is null;

    v_was_heated := v_team_a_has_taunt and v_team_b_has_taunt;
    v_stakes_bonus := case when v_was_heated then 1 else 0 end;
    v_is_draw := v_team_a_rank = v_team_b_rank;
    v_team_a_points := case
      when v_team_a_rank < v_team_b_rank then 1 + v_stakes_bonus else 0 end;
    v_team_b_points := case
      when v_team_b_rank < v_team_a_rank then 1 + v_stakes_bonus else 0 end;
    v_winner_team_id := case
      when v_team_a_points > 0 then v_rivalry.team_a_id
      when v_team_b_points > 0 then v_rivalry.team_b_id
      else null
    end;
    v_intensity_delta := greatest(
      1,
      11 - least(10, abs(v_team_a_rank - v_team_b_rank))
    ) + case when v_was_heated then 3 else 0 end;
    v_inserted_id := null;

    insert into public.team_rivalry_events (
      rivalry_id, season_id, race_edition_id,
      team_a_rank, team_b_rank, team_a_points, team_b_points,
      is_draw, winner_team_id, intensity_delta,
      team_a_score_after, team_b_score_after, draws_after, intensity_after,
      stakes_bonus, was_heated
    ) values (
      v_rivalry.id, v_rivalry.season_id, p_race_edition_id,
      v_team_a_rank, v_team_b_rank, v_team_a_points, v_team_b_points,
      v_is_draw, v_winner_team_id, v_intensity_delta,
      v_rivalry.team_a_wins + v_team_a_points,
      v_rivalry.team_b_wins + v_team_b_points,
      v_rivalry.draws + case when v_is_draw then 1 else 0 end,
      v_rivalry.intensity + v_intensity_delta,
      v_stakes_bonus, v_was_heated
    )
    on conflict (rivalry_id, race_edition_id) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      continue;
    end if;

    update public.team_rivalries
    set shared_races = shared_races + 1,
        team_a_wins = team_a_wins + v_team_a_points,
        team_b_wins = team_b_wins + v_team_b_points,
        draws = draws + case when v_is_draw then 1 else 0 end,
        intensity = intensity + v_intensity_delta,
        last_race_edition_id = p_race_edition_id
    where id = v_rivalry.id;

    if v_was_heated then
      update public.team_rivalry_taunts
      set resolved_at = now(),
          resolved_race_edition_id = p_race_edition_id,
          bonus_winner_team_id = v_winner_team_id
      where rivalry_id = v_rivalry.id
        and resolved_at is null;
    end if;

    v_updated := v_updated + 1;
  end loop;
  return v_updated;
end;
$$;

revoke all on function private.update_team_rivalries_after_race(uuid)
  from public, anon, authenticated;
grant execute on function private.update_team_rivalries_after_race(uuid)
  to service_role;

create or replace function private.apply_team_rivalry_reward(
  p_rivalry_id uuid,
  p_team_side text,
  p_director_id uuid,
  p_team_season_id uuid,
  p_requested_reputation integer,
  p_cash_reward numeric,
  p_description text
)
returns table (applied_reputation integer, applied_cash numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_reference text := 'team-rivalry:' || p_rivalry_id || ':' || p_team_side;
  v_previous_reputation integer;
  v_applied_reputation integer;
  v_existing record;
  v_day_number integer;
  v_season_day_id uuid;
begin
  select reward.reputation_points, reward.cash_prize
  into v_existing
  from public.reward_events as reward
  where reward.source_reference = v_source_reference;

  if found then
    return query select v_existing.reputation_points, v_existing.cash_prize;
    return;
  end if;

  select director.reputation_points
  into v_previous_reputation
  from public.sporting_directors as director
  where director.id = p_director_id
  for update;

  v_applied_reputation := least(
    1000,
    greatest(0, v_previous_reputation + p_requested_reputation)
  ) - v_previous_reputation;

  select coalesce(season.current_day_number, 28), season_day.id
  into v_day_number, v_season_day_id
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  left join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 28)
  where team_season.id = p_team_season_id;

  insert into public.reward_events (
    source_reference, source_type, sporting_director_id, team_season_id,
    reputation_points, cash_prize, description
  ) values (
    v_source_reference, 'team_rivalry', p_director_id, p_team_season_id,
    v_applied_reputation, greatest(0, p_cash_reward), p_description
  );

  update public.sporting_directors
  set reputation_points = reputation_points + v_applied_reputation
  where id = p_director_id;

  update public.team_seasons
  set cash_balance = cash_balance + greatest(0, p_cash_reward)
  where id = p_team_season_id;

  -- Division carry-over creates the next team season just before the season
  -- status itself becomes completed (which is when rivalries are settled).
  -- Mirror the payout into that already prepared opening balance so the money
  -- is not stranded in the closed season.
  update public.team_seasons as next_team_season
  set opening_cash_balance = next_team_season.opening_cash_balance
        + greatest(0, p_cash_reward),
      cash_balance = next_team_season.cash_balance
        + greatest(0, p_cash_reward)
  from public.team_seasons as source_team_season
  join public.seasons as source_season
    on source_season.id = source_team_season.season_id
  join public.seasons as next_season
    on next_season.game_year = source_season.game_year + 1
  where source_team_season.id = p_team_season_id
    and next_team_season.team_id = source_team_season.team_id
    and next_team_season.season_id = next_season.id
    and next_team_season.status = 'planned';

  if p_cash_reward > 0 then
    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category, status,
      description, source_reference, posted_at
    ) values (
      p_team_season_id, v_season_day_id, v_day_number,
      p_cash_reward, 'other', 'posted', p_description,
      'reward:' || v_source_reference, now()
    ) on conflict (team_season_id, source_reference) do nothing;
  end if;

  return query select v_applied_reputation, greatest(0, p_cash_reward);
end;
$$;

revoke all on function private.apply_team_rivalry_reward(
  uuid, text, uuid, uuid, integer, numeric, text
) from public, anon, authenticated;
grant execute on function private.apply_team_rivalry_reward(
  uuid, text, uuid, uuid, integer, numeric, text
) to service_role;

create or replace function private.settle_team_rivalries_for_season(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rivalry record;
  v_winner uuid;
  v_team_a_requested_reputation integer;
  v_team_b_requested_reputation integer;
  v_team_a_requested_cash numeric;
  v_team_b_requested_cash numeric;
  v_team_a_applied_reputation integer;
  v_team_b_applied_reputation integer;
  v_team_a_applied_cash numeric;
  v_team_b_applied_cash numeric;
  v_winner_cash numeric;
  v_draw_cash numeric;
  v_settled integer := 0;
begin
  for v_rivalry in
    select rivalry.*
    from public.team_rivalries as rivalry
    where rivalry.season_id = p_season_id
      and rivalry.status = 'active'
    for update
  loop
    v_winner := case
      when v_rivalry.team_a_wins > v_rivalry.team_b_wins
        then v_rivalry.team_a_id
      when v_rivalry.team_b_wins > v_rivalry.team_a_wins
        then v_rivalry.team_b_id
      else null
    end;
    v_winner_cash := 200000 + least(100000, v_rivalry.intensity * 5000);
    v_draw_cash := 100000 + least(50000, v_rivalry.intensity * 2500);

    v_team_a_requested_reputation := case
      when v_rivalry.shared_races = 0 then 0
      when v_winner is null then 10
      when v_winner = v_rivalry.team_a_id then 20
      else 5
    end;
    v_team_b_requested_reputation := case
      when v_rivalry.shared_races = 0 then 0
      when v_winner is null then 10
      when v_winner = v_rivalry.team_b_id then 20
      else 5
    end;
    v_team_a_requested_cash := case
      when v_rivalry.shared_races = 0 then 0
      when v_winner is null then v_draw_cash
      when v_winner = v_rivalry.team_a_id then v_winner_cash
      else 50000
    end;
    v_team_b_requested_cash := case
      when v_rivalry.shared_races = 0 then 0
      when v_winner is null then v_draw_cash
      when v_winner = v_rivalry.team_b_id then v_winner_cash
      else 50000
    end;

    select reward.applied_reputation, reward.applied_cash
    into v_team_a_applied_reputation, v_team_a_applied_cash
    from private.apply_team_rivalry_reward(
      v_rivalry.id, 'a', v_rivalry.team_a_director_id,
      v_rivalry.team_a_season_id, v_team_a_requested_reputation,
      v_team_a_requested_cash,
      'Bilan de rivalité contre ' || v_rivalry.team_b_name
    ) as reward;

    select reward.applied_reputation, reward.applied_cash
    into v_team_b_applied_reputation, v_team_b_applied_cash
    from private.apply_team_rivalry_reward(
      v_rivalry.id, 'b', v_rivalry.team_b_director_id,
      v_rivalry.team_b_season_id, v_team_b_requested_reputation,
      v_team_b_requested_cash,
      'Bilan de rivalité contre ' || v_rivalry.team_a_name
    ) as reward;

    update public.team_rivalries
    set status = 'completed',
        winner_team_id = v_winner,
        team_a_reputation_delta = v_team_a_applied_reputation,
        team_b_reputation_delta = v_team_b_applied_reputation,
        team_a_cash_reward = v_team_a_applied_cash,
        team_b_cash_reward = v_team_b_applied_cash,
        settled_at = now()
    where id = v_rivalry.id;
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

revoke all on function private.settle_team_rivalries_for_season(uuid)
  from public, anon, authenticated;
grant execute on function private.settle_team_rivalries_for_season(uuid)
  to service_role;

drop function if exists public.get_current_team_rivalry_dossiers();
create function public.get_current_team_rivalry_dossiers()
returns table (
  rivalry_id uuid,
  season_id uuid,
  season_name text,
  game_year integer,
  status text,
  own_team_id uuid,
  team_a_id uuid,
  team_a_name text,
  team_a_director_name text,
  team_a_wins integer,
  team_a_reputation_delta integer,
  team_a_cash_reward numeric,
  team_b_id uuid,
  team_b_name text,
  team_b_director_name text,
  team_b_wins integer,
  team_b_reputation_delta integer,
  team_b_cash_reward numeric,
  draws integer,
  shared_races integer,
  intensity integer,
  winner_team_id uuid,
  pairing_reason text,
  team_a_pairing_rank integer,
  team_b_pairing_rank integer,
  team_a_previous_rank integer,
  team_b_previous_rank integer,
  events jsonb,
  taunts jsonb,
  settled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with own_team as (
    select assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.auth_user_id = auth.uid()
    limit 1
  )
  select
    rivalry.id,
    rivalry.season_id,
    season.name,
    season.game_year,
    rivalry.status,
    own_team.team_id,
    rivalry.team_a_id,
    rivalry.team_a_name,
    rivalry.team_a_director_name,
    rivalry.team_a_wins,
    rivalry.team_a_reputation_delta,
    rivalry.team_a_cash_reward,
    rivalry.team_b_id,
    rivalry.team_b_name,
    rivalry.team_b_director_name,
    rivalry.team_b_wins,
    rivalry.team_b_reputation_delta,
    rivalry.team_b_cash_reward,
    rivalry.draws,
    rivalry.shared_races,
    rivalry.intensity,
    rivalry.winner_team_id,
    rivalry.pairing_reason,
    rivalry.team_a_pairing_rank,
    rivalry.team_b_pairing_rank,
    rivalry.team_a_previous_rank,
    rivalry.team_b_previous_rank,
    coalesce(event_log.events, '[]'::jsonb),
    coalesce(taunt_log.taunts, '[]'::jsonb),
    rivalry.settled_at
  from own_team
  join public.team_rivalries as rivalry
    on own_team.team_id in (rivalry.team_a_id, rivalry.team_b_id)
  join public.seasons as season on season.id = rivalry.season_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'raceEditionId', event.race_edition_id,
        'raceName', edition.display_name,
        'raceSlug', race.slug,
        'teamARank', event.team_a_rank,
        'teamBRank', event.team_b_rank,
        'teamAPoints', event.team_a_points,
        'teamBPoints', event.team_b_points,
        'isDraw', event.is_draw,
        'winnerTeamId', event.winner_team_id,
        'intensityDelta', event.intensity_delta,
        'teamAScoreAfter', event.team_a_score_after,
        'teamBScoreAfter', event.team_b_score_after,
        'drawsAfter', event.draws_after,
        'intensityAfter', event.intensity_after,
        'stakesBonus', event.stakes_bonus,
        'wasHeated', event.was_heated,
        'decidedAt', event.decided_at
      ) order by event.decided_at desc, event.id desc
    ) as events
    from public.team_rivalry_events as event
    join public.race_editions as edition on edition.id = event.race_edition_id
    join public.races as race on race.id = edition.race_id
    where event.rivalry_id = rivalry.id
  ) as event_log on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', taunt.id,
        'senderTeamId', taunt.sender_team_id,
        'recipientTeamId', taunt.recipient_team_id,
        'code', taunt.taunt_code,
        'quote', taunt.quote,
        'intensityDelta', taunt.intensity_delta,
        'createdAt', taunt.created_at,
        'resolvedAt', taunt.resolved_at,
        'resolvedRaceEditionId', taunt.resolved_race_edition_id,
        'bonusWinnerTeamId', taunt.bonus_winner_team_id
      ) order by taunt.created_at desc, taunt.id desc
    ) as taunts
    from public.team_rivalry_taunts as taunt
    where taunt.rivalry_id = rivalry.id
  ) as taunt_log on true
  order by season.game_year desc, rivalry.created_at desc;
$$;

revoke all on function public.get_current_team_rivalry_dossiers()
  from public, anon;
grant execute on function public.get_current_team_rivalry_dossiers()
  to authenticated;

comment on table public.team_rivalry_taunts is
  'Piques publiques et prédéfinies entre deux équipes rivales ; une réponse réciproque double l’enjeu de la prochaine confrontation.';
comment on column public.team_rivalries.team_a_previous_rank is
  'Rang UCI final de l’équipe A lors de la saison précédente, utilisé pour créer le duel.';
comment on column public.team_rivalries.team_b_previous_rank is
  'Rang UCI final de l’équipe B lors de la saison précédente, utilisé pour créer le duel.';

commit;
