begin;

-- L'inactivite est traitee par un cron quotidien, hors des requetes de jeu.
-- Le compte Auth disparait apres le delai de grace, mais les identites metier
-- restent archivees afin de conserver tous les liens historiques.
alter table public.teams
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_season_id uuid
    references public.seasons(id) on delete restrict,
  add column if not exists inactivated_day_number smallint,
  add column if not exists inactivation_reason text;

alter table public.teams
  drop constraint if exists teams_inactivated_day_range,
  drop constraint if exists teams_inactivation_shape,
  drop constraint if exists teams_inactivation_reason_not_empty;

update public.teams
set
  inactivated_at = coalesce(inactivated_at, created_at),
  inactivated_season_id = coalesce(inactivated_season_id, founded_season_id),
  inactivated_day_number = coalesce(inactivated_day_number, 1),
  inactivation_reason = coalesce(inactivation_reason, 'legacy_inactive_team')
where status = 'inactive';

alter table public.teams
  add constraint teams_inactivated_day_range check (
    inactivated_day_number is null
    or inactivated_day_number between 1 and 28
  ),
  add constraint teams_inactivation_shape check (
    (
      status = 'inactive'
      and inactivated_at is not null
      and inactivated_season_id is not null
      and inactivated_day_number is not null
    )
    or status <> 'inactive'
  ),
  add constraint teams_inactivation_reason_not_empty check (
    inactivation_reason is null or btrim(inactivation_reason) <> ''
  );

create table public.director_inactivity_lifecycle (
  sporting_director_id uuid primary key
    references public.sporting_directors(id) on delete cascade,
  auth_user_id uuid not null,
  last_activity_at timestamptz not null,
  status text not null default 'pending_warning',
  warning_attempt_count integer not null default 0,
  warning_claimed_at timestamptz,
  warning_sent_at timestamptz,
  deletion_due_at timestamptz,
  deletion_attempt_count integer not null default 0,
  deletion_claimed_at timestamptz,
  last_error text,
  archived_at timestamptz,
  auth_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint director_inactivity_status_allowed check (
    status in (
      'pending_warning',
      'warning_sending',
      'warned',
      'archived',
      'completed',
      'cancelled'
    )
  ),
  constraint director_inactivity_attempts_non_negative check (
    warning_attempt_count >= 0 and deletion_attempt_count >= 0
  ),
  constraint director_inactivity_warning_shape check (
    (status in ('warned', 'archived', 'completed')
      and warning_sent_at is not null
      and deletion_due_at is not null)
    or status not in ('warned', 'archived', 'completed')
  ),
  constraint director_inactivity_archive_shape check (
    (status in ('archived', 'completed') and archived_at is not null)
    or status not in ('archived', 'completed')
  ),
  constraint director_inactivity_completion_shape check (
    (status = 'completed' and auth_deleted_at is not null)
    or status <> 'completed'
  )
);

create index director_inactivity_warning_queue_idx
  on public.director_inactivity_lifecycle (
    status,
    warning_claimed_at,
    updated_at
  )
  where status in ('pending_warning', 'warning_sending');

create index director_inactivity_deletion_queue_idx
  on public.director_inactivity_lifecycle (
    status,
    deletion_due_at,
    deletion_claimed_at
  )
  where status in ('warned', 'archived');

create index sporting_directors_inactivity_candidates_idx
  on public.sporting_directors (created_at, auth_user_id)
  where status = 'active'
    and onboarding_completed
    and auth_user_id is not null;

alter table public.director_inactivity_lifecycle enable row level security;

revoke all on table public.director_inactivity_lifecycle
from public, anon, authenticated;

grant all on table public.director_inactivity_lifecycle to service_role;

create or replace function public.claim_due_director_inactivity_warnings(
  p_limit integer default 25
)
returns table (
  sporting_director_id uuid,
  auth_user_id uuid,
  display_name text,
  team_name text,
  last_activity_at timestamptz,
  warning_attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  -- Une reconnexion intervenue pendant un envoi ou le delai de grace annule
  -- immediatement le cycle. Le prochain cycle ne pourra recommencer qu'apres
  -- trente nouveaux jours sans activite.
  with latest_activity as (
    select
      lifecycle.sporting_director_id,
      coalesce(
        presence.last_activity_at,
        director.created_at
      ) as last_activity_at
    from public.director_inactivity_lifecycle as lifecycle
    join public.sporting_directors as director
      on director.id = lifecycle.sporting_director_id
    left join lateral (
      select coalesce(
        activity.last_seen_at,
        activity.activity_on::timestamp at time zone 'Europe/Paris'
      ) as last_activity_at
      from public.player_daily_activity as activity
      where activity.auth_user_id = lifecycle.auth_user_id
      order by activity.activity_on desc
      limit 1
    ) as presence on true
    where lifecycle.status in ('pending_warning', 'warning_sending', 'warned')
  )
  update public.director_inactivity_lifecycle as lifecycle
  set
    status = 'cancelled',
    last_activity_at = latest.last_activity_at,
    warning_claimed_at = null,
    deletion_claimed_at = null,
    last_error = null,
    updated_at = now()
  from latest_activity as latest
  where lifecycle.sporting_director_id = latest.sporting_director_id
    and latest.last_activity_at > coalesce(
      lifecycle.warning_sent_at,
      lifecycle.last_activity_at
    );

  -- L'index primaire (auth_user_id, activity_on) rend le lateral O(log n) par
  -- Directeur Sportif. Ce travail n'est execute qu'une fois par jour.
  insert into public.director_inactivity_lifecycle (
    sporting_director_id,
    auth_user_id,
    last_activity_at,
    status,
    created_at,
    updated_at
  )
  select
    director.id,
    director.auth_user_id,
    coalesce(presence.last_activity_at, director.created_at),
    'pending_warning',
    now(),
    now()
  from public.sporting_directors as director
  left join lateral (
    select coalesce(
      activity.last_seen_at,
      activity.activity_on::timestamp at time zone 'Europe/Paris'
    ) as last_activity_at
    from public.player_daily_activity as activity
    where activity.auth_user_id = director.auth_user_id
    order by activity.activity_on desc
    limit 1
  ) as presence on true
  where director.status = 'active'
    and director.onboarding_completed
    and director.auth_user_id is not null
    and coalesce(presence.last_activity_at, director.created_at)
      <= now() - interval '30 days'
    and not exists (
      select 1
      from public.alpha_bot_managers as bot
      where bot.sporting_director_id = director.id
         or bot.auth_user_id = director.auth_user_id
    )
  on conflict (sporting_director_id) do update
  set
    auth_user_id = excluded.auth_user_id,
    last_activity_at = excluded.last_activity_at,
    status = 'pending_warning',
    warning_attempt_count = 0,
    warning_claimed_at = null,
    warning_sent_at = null,
    deletion_due_at = null,
    deletion_attempt_count = 0,
    deletion_claimed_at = null,
    last_error = null,
    archived_at = null,
    auth_deleted_at = null,
    updated_at = now()
  where director_inactivity_lifecycle.status = 'cancelled'
    and excluded.last_activity_at
      > director_inactivity_lifecycle.last_activity_at;

  return query
  with due as (
    select lifecycle.sporting_director_id
    from public.director_inactivity_lifecycle as lifecycle
    join public.sporting_directors as director
      on director.id = lifecycle.sporting_director_id
    where lifecycle.status in ('pending_warning', 'warning_sending')
      and director.status = 'active'
      and director.auth_user_id = lifecycle.auth_user_id
      and lifecycle.last_activity_at <= now() - interval '30 days'
      and (
        lifecycle.warning_claimed_at is null
        or lifecycle.warning_claimed_at < now() - interval '2 hours'
      )
    order by lifecycle.last_activity_at, lifecycle.updated_at
    for update of lifecycle skip locked
    limit v_limit
  ), claimed as (
    update public.director_inactivity_lifecycle as lifecycle
    set
      status = 'warning_sending',
      warning_attempt_count = lifecycle.warning_attempt_count + 1,
      warning_claimed_at = now(),
      last_error = null,
      updated_at = now()
    from due
    where lifecycle.sporting_director_id = due.sporting_director_id
    returning lifecycle.*
  )
  select
    claimed.sporting_director_id,
    claimed.auth_user_id,
    director.display_name,
    coalesce(team_season.display_name, team.amateur_name, team.internal_name),
    claimed.last_activity_at,
    claimed.warning_attempt_count
  from claimed
  join public.sporting_directors as director
    on director.id = claimed.sporting_director_id
  left join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  left join public.teams as team on team.id = assignment.team_id
  left join public.seasons as season on season.status = 'active'
  left join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  order by claimed.last_activity_at;
end;
$$;

create or replace function public.mark_director_inactivity_warning_sent(
  p_sporting_director_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifecycle public.director_inactivity_lifecycle%rowtype;
  v_latest_activity_at timestamptz;
begin
  select * into v_lifecycle
  from public.director_inactivity_lifecycle
  where sporting_director_id = p_sporting_director_id
  for update;

  if not found or v_lifecycle.status <> 'warning_sending' then
    return false;
  end if;

  select coalesce(
    presence.last_activity_at,
    director.created_at
  )
  into v_latest_activity_at
  from public.sporting_directors as director
  left join lateral (
    select coalesce(
      activity.last_seen_at,
      activity.activity_on::timestamp at time zone 'Europe/Paris'
    ) as last_activity_at
    from public.player_daily_activity as activity
    where activity.auth_user_id = v_lifecycle.auth_user_id
    order by activity.activity_on desc
    limit 1
  ) as presence on true
  where director.id = p_sporting_director_id;

  if v_latest_activity_at > v_lifecycle.last_activity_at then
    update public.director_inactivity_lifecycle
    set
      status = 'cancelled',
      last_activity_at = v_latest_activity_at,
      warning_claimed_at = null,
      last_error = null,
      updated_at = now()
    where sporting_director_id = p_sporting_director_id;
    return false;
  end if;

  update public.director_inactivity_lifecycle
  set
    status = 'warned',
    warning_sent_at = now(),
    deletion_due_at = now() + interval '14 days',
    warning_claimed_at = null,
    last_error = null,
    updated_at = now()
  where sporting_director_id = p_sporting_director_id;

  return true;
end;
$$;

create or replace function public.mark_director_inactivity_warning_failed(
  p_sporting_director_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.director_inactivity_lifecycle
  set
    status = 'pending_warning',
    warning_claimed_at = null,
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Echec inconnu'), 1000),
    updated_at = now()
  where sporting_director_id = p_sporting_director_id
    and status = 'warning_sending';
$$;

create or replace function public.claim_due_director_inactivity_deletions(
  p_limit integer default 10
)
returns table (
  sporting_director_id uuid,
  auth_user_id uuid,
  status text,
  deletion_due_at timestamptz,
  deletion_attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
begin
  with latest_activity as (
    select
      lifecycle.sporting_director_id,
      coalesce(presence.last_activity_at, director.created_at) as last_activity_at
    from public.director_inactivity_lifecycle as lifecycle
    join public.sporting_directors as director
      on director.id = lifecycle.sporting_director_id
    left join lateral (
      select coalesce(
        activity.last_seen_at,
        activity.activity_on::timestamp at time zone 'Europe/Paris'
      ) as last_activity_at
      from public.player_daily_activity as activity
      where activity.auth_user_id = lifecycle.auth_user_id
      order by activity.activity_on desc
      limit 1
    ) as presence on true
    where lifecycle.status = 'warned'
  )
  update public.director_inactivity_lifecycle as lifecycle
  set
    status = 'cancelled',
    last_activity_at = latest.last_activity_at,
    deletion_claimed_at = null,
    last_error = null,
    updated_at = now()
  from latest_activity as latest
  where lifecycle.sporting_director_id = latest.sporting_director_id
    and latest.last_activity_at > lifecycle.warning_sent_at;

  return query
  with due as (
    select lifecycle.sporting_director_id
    from public.director_inactivity_lifecycle as lifecycle
    where (
      (
        lifecycle.status = 'warned'
        and lifecycle.deletion_due_at <= now()
      )
      or lifecycle.status = 'archived'
    )
    and (
      lifecycle.deletion_claimed_at is null
      or lifecycle.deletion_claimed_at < now() - interval '2 hours'
    )
    order by lifecycle.deletion_due_at, lifecycle.updated_at
    for update of lifecycle skip locked
    limit v_limit
  ), claimed as (
    update public.director_inactivity_lifecycle as lifecycle
    set
      deletion_attempt_count = lifecycle.deletion_attempt_count + 1,
      deletion_claimed_at = now(),
      last_error = null,
      updated_at = now()
    from due
    where lifecycle.sporting_director_id = due.sporting_director_id
    returning lifecycle.*
  )
  select
    claimed.sporting_director_id,
    claimed.auth_user_id,
    claimed.status,
    claimed.deletion_due_at,
    claimed.deletion_attempt_count
  from claimed
  order by claimed.deletion_due_at;
end;
$$;

create or replace function public.archive_inactive_sporting_director(
  p_sporting_director_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lifecycle public.director_inactivity_lifecycle%rowtype;
  v_director public.sporting_directors%rowtype;
  v_team_id uuid;
  v_season_id uuid;
  v_day_number integer;
  v_latest_activity_at timestamptz;
  v_rider_ids uuid[] := array[]::uuid[];
  v_released_rider_count integer := 0;
begin
  select * into v_lifecycle
  from public.director_inactivity_lifecycle
  where sporting_director_id = p_sporting_director_id
  for update;

  if not found then
    raise exception 'Cycle d inactivite introuvable.';
  end if;

  if v_lifecycle.status = 'archived' then
    return jsonb_build_object(
      'archived', true,
      'authUserId', v_lifecycle.auth_user_id,
      'releasedRiderCount', 0
    );
  end if;

  if v_lifecycle.status <> 'warned'
    or v_lifecycle.deletion_due_at > now()
  then
    raise exception 'Le delai de grace n est pas termine.';
  end if;

  select * into v_director
  from public.sporting_directors
  where id = p_sporting_director_id
  for update;

  if not found then
    raise exception 'Directeur Sportif introuvable.';
  end if;

  select coalesce(presence.last_activity_at, v_director.created_at)
  into v_latest_activity_at
  from (select 1) as anchor
  left join lateral (
    select coalesce(
      activity.last_seen_at,
      activity.activity_on::timestamp at time zone 'Europe/Paris'
    ) as last_activity_at
    from public.player_daily_activity as activity
    where activity.auth_user_id = v_lifecycle.auth_user_id
    order by activity.activity_on desc
    limit 1
  ) as presence on true;

  if v_latest_activity_at > v_lifecycle.warning_sent_at then
    update public.director_inactivity_lifecycle
    set
      status = 'cancelled',
      last_activity_at = v_latest_activity_at,
      deletion_claimed_at = null,
      last_error = null,
      updated_at = now()
    where sporting_director_id = p_sporting_director_id;

    return jsonb_build_object('archived', false, 'cancelled', true);
  end if;

  select season.id, coalesce(season.current_day_number, 1)
  into v_season_id, v_day_number
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_season_id is null then
    raise exception 'Aucune saison active ne permet l archivage.';
  end if;

  select assignment.team_id
  into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = p_sporting_director_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  order by assignment.created_at desc
  limit 1
  for update;

  if v_team_id is not null then
    perform 1 from public.teams where id = v_team_id for update;

    select coalesce(array_agg(distinct contract.rider_id), array[]::uuid[])
    into v_rider_ids
    from public.rider_contracts as contract
    where contract.team_id = v_team_id
      and contract.status in ('active', 'planned');

    -- Plus aucune operation sportive ou commerciale ne doit rester active.
    update public.direct_transfer_offers
    set
      status = 'cancelled',
      responded_at = coalesce(responded_at, now()),
      response_note = coalesce(response_note, 'Equipe archivee pour inactivite.')
    where status = 'pending'
      and (buyer_team_id = v_team_id or seller_team_id = v_team_id);

    delete from public.transfer_market_bids
    where team_id = v_team_id
       or sporting_director_id = p_sporting_director_id;

    update public.transfer_market_listings
    set
      status = 'cancelled',
      winning_team_id = null,
      winning_bid = null,
      settled_at = null
    where seller_team_id = v_team_id
      and status = 'open';

    update public.race_registrations as registration
    set
      status = 'withdrawn',
      decided_at = coalesce(registration.decided_at, now())
    from public.team_seasons as team_season,
      public.race_editions as edition
    where registration.team_season_id = team_season.id
      and registration.race_edition_id = edition.id
      and team_season.team_id = v_team_id
      and registration.status in ('pending', 'accepted')
      and edition.status not in ('completed', 'cancelled');

    update public.development_race_registrations as registration
    set status = 'withdrawn', updated_at = now()
    from public.development_teams as development_team
    where registration.development_team_id = development_team.id
      and development_team.team_id = v_team_id
      and registration.status = 'registered';

    update public.development_teams
    set status = 'completed', updated_at = now()
    where team_id = v_team_id and status = 'active';

    update public.rider_form_camps as camp
    set status = 'cancelled'
    from public.team_seasons as team_season
    where camp.team_season_id = team_season.id
      and team_season.team_id = v_team_id
      and camp.status in ('planned', 'active');

    update public.equipment_rnd_projects
    set status = 'cancelled'
    where team_id = v_team_id and status = 'active';

    update public.infrastructure_projects
    set status = 'cancelled', updated_at = now()
    where team_id = v_team_id and status = 'active';

    update public.staff_academy_trainings
    set status = 'cancelled', updated_at = now()
    where team_id = v_team_id and status = 'active';

    update public.youth_scouting_missions
    set status = 'cancelled', updated_at = now()
    where team_id = v_team_id and status = 'active';

    update public.youth_academy_riders
    set status = 'free_agent', updated_at = now()
    where team_id = v_team_id
      and status in ('active', 'recruited');

    update public.staff_rider_assignments as staff_assignment
    set status = 'ended', ended_at = now()
    from public.staff_contracts as staff_contract
    where staff_assignment.staff_contract_id = staff_contract.id
      and staff_contract.team_id = v_team_id
      and staff_assignment.status = 'active';

    update public.staff_contracts
    set
      status = 'terminated',
      terminated_at = now(),
      termination_compensation = 0,
      termination_season_id = v_season_id,
      termination_day_number = v_day_number
    where team_id = v_team_id and status = 'active';

    update public.team_sponsor_contracts
    set
      status = 'terminated',
      terminated_at = now(),
      termination_reason = 'Archivage de l equipe pour inactivite du Directeur Sportif.',
      reputation_penalty = 0,
      termination_season_id = v_season_id
    where team_id = v_team_id and status = 'active';

    update public.rider_contracts
    set
      status = case when status = 'active' then 'terminated' else 'cancelled' end,
      left_season_id = v_season_id,
      left_day_number = v_day_number
    where team_id = v_team_id
      and status in ('active', 'planned');

    update public.riders as rider
    set status = 'free_agent'
    where rider.id = any(v_rider_ids)
      and rider.status not in ('retired', 'suspended')
      and not exists (
        select 1
        from public.rider_contracts as remaining_contract
        where remaining_contract.rider_id = rider.id
          and remaining_contract.status = 'active'
      );

    get diagnostics v_released_rider_count = row_count;

    update public.team_manager_assignments
    set
      status = 'terminated',
      end_season_id = coalesce(end_season_id, v_season_id)
    where team_id = v_team_id
      and sporting_director_id = p_sporting_director_id
      and status in ('active', 'planned');

    -- La saison d'arret est conservee comme archive ; les saisons futures
    -- restent en base mais sont retirees des vues publiques.
    update public.team_seasons
    set status = case
      when season_id = v_season_id then 'completed'
      else 'withdrawn'
    end
    where team_id = v_team_id
      and status in ('active', 'planned');

    update public.teams
    set
      status = 'inactive',
      inactivated_at = now(),
      inactivated_season_id = v_season_id,
      inactivated_day_number = v_day_number,
      inactivation_reason = 'director_inactivity'
    where id = v_team_id;
  end if;

  update public.sporting_directors
  set status = 'retired'
  where id = p_sporting_director_id;

  update public.director_inactivity_lifecycle
  set
    status = 'archived',
    archived_at = now(),
    last_error = null,
    updated_at = now()
  where sporting_director_id = p_sporting_director_id;

  return jsonb_build_object(
    'archived', true,
    'authUserId', v_lifecycle.auth_user_id,
    'teamId', v_team_id,
    'releasedRiderCount', v_released_rider_count
  );
end;
$$;

create or replace function public.mark_director_inactivity_deletion_failed(
  p_sporting_director_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.director_inactivity_lifecycle
  set
    deletion_claimed_at = null,
    last_error = left(coalesce(nullif(btrim(p_error), ''), 'Echec inconnu'), 1000),
    updated_at = now()
  where sporting_director_id = p_sporting_director_id
    and status in ('warned', 'archived');
$$;

create or replace function public.mark_director_inactivity_auth_deleted(
  p_sporting_director_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.director_inactivity_lifecycle
  set
    status = 'completed',
    auth_deleted_at = now(),
    deletion_claimed_at = null,
    last_error = null,
    updated_at = now()
  where sporting_director_id = p_sporting_director_id
    and status = 'archived';

  return found;
end;
$$;

revoke all on function public.claim_due_director_inactivity_warnings(integer)
from public, anon, authenticated;
revoke all on function public.mark_director_inactivity_warning_sent(uuid)
from public, anon, authenticated;
revoke all on function public.mark_director_inactivity_warning_failed(uuid, text)
from public, anon, authenticated;
revoke all on function public.claim_due_director_inactivity_deletions(integer)
from public, anon, authenticated;
revoke all on function public.archive_inactive_sporting_director(uuid)
from public, anon, authenticated;
revoke all on function public.mark_director_inactivity_deletion_failed(uuid, text)
from public, anon, authenticated;
revoke all on function public.mark_director_inactivity_auth_deleted(uuid)
from public, anon, authenticated;

grant execute on function public.claim_due_director_inactivity_warnings(integer)
to service_role;
grant execute on function public.mark_director_inactivity_warning_sent(uuid)
to service_role;
grant execute on function public.mark_director_inactivity_warning_failed(uuid, text)
to service_role;
grant execute on function public.claim_due_director_inactivity_deletions(integer)
to service_role;
grant execute on function public.archive_inactive_sporting_director(uuid)
to service_role;
grant execute on function public.mark_director_inactivity_deletion_failed(uuid, text)
to service_role;
grant execute on function public.mark_director_inactivity_auth_deleted(uuid)
to service_role;

comment on table public.director_inactivity_lifecycle is
  'File quotidienne idempotente : avertissement a J+30, archivage et suppression Auth quatorze jours apres un email effectivement envoye.';

notify pgrst, 'reload schema';

commit;
