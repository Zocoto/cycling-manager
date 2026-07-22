-- ============================================================
-- CYCLO STRATÈGE — Centre de formation
-- ============================================================

begin;

alter table public.rider_contracts
  drop constraint if exists rider_contracts_acquisition_type_allowed;
alter table public.rider_contracts
  add constraint rider_contracts_acquisition_type_allowed
    check (acquisition_type in (
      'initial', 'daily_auction', 'director_auction', 'free_agent', 'renewal',
      'academy'
    ));

create table public.country_cycling_development (
  country_id uuid primary key references public.countries(id) on delete cascade,
  facility_level smallint not null default 1,
  updated_at timestamptz not null default now(),
  constraint country_cycling_development_facility_range
    check (facility_level between 1 and 10)
);

insert into public.country_cycling_development (country_id)
select country.id
from public.countries as country
where country.is_active
on conflict (country_id) do nothing;

create table public.youth_scouting_missions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  scout_contract_id uuid not null references public.staff_contracts(id) on delete restrict,
  country_id uuid not null references public.countries(id) on delete restrict,
  start_day_number smallint not null,
  duration_days smallint not null,
  completes_day_number smallint not null,
  status text not null default 'active',
  report_ready_at timestamptz,
  report_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youth_scouting_missions_start_day_range check (start_day_number between 1 and 28),
  constraint youth_scouting_missions_duration_range check (duration_days between 1 and 7),
  constraint youth_scouting_missions_complete_day_range check (completes_day_number between 1 and 28),
  constraint youth_scouting_missions_day_order check (
    completes_day_number = start_day_number + duration_days
  ),
  constraint youth_scouting_missions_status_allowed check (
    status in ('active', 'completed', 'cancelled')
  ),
  constraint youth_scouting_missions_report_shape check (
    (status = 'completed' and report_ready_at is not null)
    or (status <> 'completed')
  )
);

create unique index youth_scouting_missions_one_active_per_scout_idx
  on public.youth_scouting_missions (scout_contract_id)
  where status = 'active';
create index youth_scouting_missions_team_status_idx
  on public.youth_scouting_missions (team_id, status, completes_day_number);

create table public.youth_scouting_candidates (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.youth_scouting_missions(id) on delete cascade,
  report_slot smallint not null,
  country_id uuid not null references public.countries(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  age smallint not null,
  archetype text not null,
  potential_steps smallint not null,
  avatar_profile_key text not null,
  avatar_seed bigint not null,
  mountain numeric(3, 1) not null,
  hills numeric(3, 1) not null,
  flat numeric(3, 1) not null,
  time_trial numeric(3, 1) not null,
  cobbles numeric(3, 1) not null,
  sprint numeric(3, 1) not null,
  acceleration numeric(3, 1) not null,
  downhill numeric(3, 1) not null,
  endurance numeric(3, 1) not null,
  resistance numeric(3, 1) not null,
  recovery numeric(3, 1) not null,
  breakaway numeric(3, 1) not null,
  prologue numeric(3, 1) not null,
  signing_fee numeric(12, 2) not null,
  tuition_per_season numeric(12, 2) not null,
  status text not null default 'spotted',
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint youth_scouting_candidates_slot_unique unique (mission_id, report_slot),
  constraint youth_scouting_candidates_name_not_empty check (
    btrim(first_name) <> '' and btrim(last_name) <> ''
  ),
  constraint youth_scouting_candidates_age_range check (age between 15 and 18),
  constraint youth_scouting_candidates_archetype_allowed check (
    archetype in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter', 'all_rounder'
    )
  ),
  constraint youth_scouting_candidates_potential_range check (potential_steps between 1 and 8),
  constraint youth_scouting_candidates_ratings_range check (
    mountain between 1 and 6 and hills between 1 and 6 and flat between 1 and 6
    and time_trial between 1 and 6 and cobbles between 1 and 6 and sprint between 1 and 6
    and acceleration between 1 and 6 and downhill between 1 and 6
    and endurance between 1 and 6 and resistance between 1 and 6
    and recovery between 1 and 6 and breakaway between 1 and 6 and prologue between 1 and 6
  ),
  constraint youth_scouting_candidates_costs_positive check (
    signing_fee > 0 and tuition_per_season > 0
  ),
  constraint youth_scouting_candidates_status_allowed check (
    status in ('spotted', 'signed', 'expired')
  )
);

create index youth_scouting_candidates_mission_status_idx
  on public.youth_scouting_candidates (mission_id, status, report_slot);

create table public.youth_academy_riders (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.youth_scouting_candidates(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete cascade,
  joined_season_id uuid not null references public.seasons(id) on delete restrict,
  joined_day_number smallint not null,
  country_id uuid not null references public.countries(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  birth_game_year integer not null,
  archetype text not null,
  potential_steps smallint not null,
  avatar_profile_key text not null,
  avatar_seed bigint not null,
  mountain numeric(5, 3) not null,
  hills numeric(5, 3) not null,
  flat numeric(5, 3) not null,
  time_trial numeric(5, 3) not null,
  cobbles numeric(5, 3) not null,
  sprint numeric(5, 3) not null,
  acceleration numeric(5, 3) not null,
  downhill numeric(5, 3) not null,
  endurance numeric(5, 3) not null,
  resistance numeric(5, 3) not null,
  recovery numeric(5, 3) not null,
  breakaway numeric(5, 3) not null,
  prologue numeric(5, 3) not null,
  training_priority text not null default 'stage_racer',
  tuition_per_season numeric(12, 2) not null,
  status text not null default 'active',
  promotion_game_year integer,
  promoted_rider_id uuid references public.riders(id) on delete set null,
  signed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint youth_academy_riders_join_day_range check (joined_day_number between 1 and 28),
  constraint youth_academy_riders_potential_range check (potential_steps between 1 and 8),
  constraint youth_academy_riders_ratings_range check (
    mountain between 1 and 6 and hills between 1 and 6 and flat between 1 and 6
    and time_trial between 1 and 6 and cobbles between 1 and 6 and sprint between 1 and 6
    and acceleration between 1 and 6 and downhill between 1 and 6
    and endurance between 1 and 6 and resistance between 1 and 6
    and recovery between 1 and 6 and breakaway between 1 and 6 and prologue between 1 and 6
  ),
  constraint youth_academy_riders_training_allowed check (
    training_priority in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter'
    )
  ),
  constraint youth_academy_riders_status_allowed check (
    status in ('active', 'recruited', 'promoted', 'free_agent')
  ),
  constraint youth_academy_riders_promotion_shape check (
    (status = 'recruited' and promotion_game_year is not null)
    or status <> 'recruited'
  )
);

create index youth_academy_riders_team_status_idx
  on public.youth_academy_riders (team_id, status, signed_at);

create table public.youth_academy_training_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_rider_id uuid not null references public.youth_academy_riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  day_number smallint not null,
  training_priority text not null,
  rating_changes jsonb not null default '{}'::jsonb,
  ratings_after jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  constraint youth_academy_training_sessions_unique unique (academy_rider_id, season_day_id),
  constraint youth_academy_training_sessions_day_range check (day_number between 1 and 28)
);

create index youth_academy_training_sessions_rider_day_idx
  on public.youth_academy_training_sessions (academy_rider_id, day_number desc);

create table public.youth_development_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  source_reference text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint youth_development_notifications_type_allowed check (
    notification_type in ('promotion_scheduled', 'promoted', 'contract_expired')
  ),
  constraint youth_development_notifications_source_unique unique (team_id, source_reference)
);

create index youth_development_notifications_team_unread_idx
  on public.youth_development_notifications (team_id, read_at, created_at desc);

alter table public.country_cycling_development enable row level security;
alter table public.youth_scouting_missions enable row level security;
alter table public.youth_scouting_candidates enable row level security;
alter table public.youth_academy_riders enable row level security;
alter table public.youth_academy_training_sessions enable row level security;
alter table public.youth_development_notifications enable row level security;

create or replace function public.current_user_manages_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
      and assignment.team_id = p_team_id
  );
$$;

create policy country_cycling_development_read_authenticated
on public.country_cycling_development for select to authenticated using (true);

create policy youth_scouting_missions_read_managed
on public.youth_scouting_missions for select to authenticated
using (public.current_user_manages_team(team_id));

create policy youth_scouting_candidates_read_managed
on public.youth_scouting_candidates for select to authenticated
using (
  exists (
    select 1 from public.youth_scouting_missions as mission
    where mission.id = youth_scouting_candidates.mission_id
      and public.current_user_manages_team(mission.team_id)
  )
);

create policy youth_academy_riders_read_managed
on public.youth_academy_riders for select to authenticated
using (public.current_user_manages_team(team_id));

create policy youth_academy_training_sessions_read_managed
on public.youth_academy_training_sessions for select to authenticated
using (
  exists (
    select 1 from public.youth_academy_riders as academy
    where academy.id = youth_academy_training_sessions.academy_rider_id
      and public.current_user_manages_team(academy.team_id)
  )
);

create policy youth_development_notifications_read_managed
on public.youth_development_notifications for select to authenticated
using (public.current_user_manages_team(team_id));

create or replace function public.start_current_team_youth_scouting(
  p_scout_contract_id uuid,
  p_country_id uuid,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_mission_id uuid;
begin
  if p_scout_contract_id is null or p_country_id is null then
    raise exception 'Le scout et le pays sont obligatoires.';
  end if;
  if p_duration_days not between 1 and 7 then
    raise exception 'La mission doit durer entre 1 et 7 jours.';
  end if;

  perform public.sync_active_season_day();

  select
    assignment.team_id,
    season.id as season_id,
    season.current_day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;
  if v_context.current_day_number + p_duration_days > 28 then
    raise exception 'Cette mission se terminerait après la fin de la saison.';
  end if;
  if not exists (
    select 1 from public.countries
    where id = p_country_id and is_active
  ) then
    raise exception 'Ce pays ne peut pas être scouté.';
  end if;
  if not exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member on member.id = contract.staff_member_id
    where contract.id = p_scout_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
      and member.role = 'scout'
  ) then
    raise exception 'Ce scout ne fait pas partie du staff actif de votre équipe.';
  end if;
  if exists (
    select 1 from public.youth_scouting_missions
    where scout_contract_id = p_scout_contract_id and status = 'active'
  ) then
    raise exception 'Ce scout est déjà en mission.';
  end if;

  insert into public.youth_scouting_missions (
    team_id,
    season_id,
    scout_contract_id,
    country_id,
    start_day_number,
    duration_days,
    completes_day_number
  ) values (
    v_context.team_id,
    v_context.season_id,
    p_scout_contract_id,
    p_country_id,
    v_context.current_day_number,
    p_duration_days,
    v_context.current_day_number + p_duration_days
  ) returning id into v_mission_id;

  return v_mission_id;
end;
$$;

create or replace function public.mark_current_team_scouting_report_viewed(
  p_mission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.youth_scouting_missions as mission
  set report_viewed_at = coalesce(report_viewed_at, now()), updated_at = now()
  where mission.id = p_mission_id
    and mission.status = 'completed'
    and public.current_user_manages_team(mission.team_id);

  if not found then
    raise exception 'Ce rapport est introuvable ou ne vous appartient pas.';
  end if;
end;
$$;

create or replace function public.sign_current_team_youth_candidate(
  p_candidate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_candidate record;
  v_academy_id uuid;
begin
  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
    and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1 from public.team_seasons where id = v_context.team_season_id for update;

  select candidate.*, mission.team_id
  into v_candidate
  from public.youth_scouting_candidates as candidate
  join public.youth_scouting_missions as mission on mission.id = candidate.mission_id
  where candidate.id = p_candidate_id
  for update of candidate;

  if v_candidate is null
    or v_candidate.team_id <> v_context.team_id
    or v_candidate.status <> 'spotted' then
    raise exception 'Ce jeune n’est plus disponible dans vos rapports.';
  end if;
  if v_context.cash_balance < v_candidate.signing_fee then
    raise exception 'Trésorerie insuffisante pour accueillir ce jeune.';
  end if;

  insert into public.youth_academy_riders (
    candidate_id,
    team_id,
    joined_season_id,
    joined_day_number,
    country_id,
    first_name,
    last_name,
    birth_game_year,
    archetype,
    potential_steps,
    avatar_profile_key,
    avatar_seed,
    mountain,
    hills,
    flat,
    time_trial,
    cobbles,
    sprint,
    acceleration,
    downhill,
    endurance,
    resistance,
    recovery,
    breakaway,
    prologue,
    training_priority,
    tuition_per_season
  ) values (
    v_candidate.id,
    v_context.team_id,
    v_context.season_id,
    v_context.current_day_number,
    v_candidate.country_id,
    v_candidate.first_name,
    v_candidate.last_name,
    v_context.game_year - v_candidate.age,
    v_candidate.archetype,
    v_candidate.potential_steps,
    v_candidate.avatar_profile_key,
    v_candidate.avatar_seed,
    v_candidate.mountain,
    v_candidate.hills,
    v_candidate.flat,
    v_candidate.time_trial,
    v_candidate.cobbles,
    v_candidate.sprint,
    v_candidate.acceleration,
    v_candidate.downhill,
    v_candidate.endurance,
    v_candidate.resistance,
    v_candidate.recovery,
    v_candidate.breakaway,
    v_candidate.prologue,
    case when v_candidate.archetype = 'all_rounder' then 'stage_racer' else v_candidate.archetype end,
    v_candidate.tuition_per_season
  ) returning id into v_academy_id;

  update public.youth_scouting_candidates
  set status = 'signed', signed_at = now()
  where id = v_candidate.id;

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
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_candidate.signing_fee,
    'training',
    'posted',
    'Accueil de ' || v_candidate.first_name || ' ' || v_candidate.last_name || ' à l’école de cyclisme',
    'youth-signing:' || v_academy_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_candidate.signing_fee
  where id = v_context.team_season_id;

  return v_academy_id;
end;
$$;

create or replace function public.save_current_youth_training_priority(
  p_academy_rider_id uuid,
  p_training_priority text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_training_priority not in (
    'climber', 'puncheur', 'stage_racer', 'northern_classics',
    'rouleur', 'breakaway', 'sprinter'
  ) then
    raise exception 'La priorité d’entraînement est invalide.';
  end if;

  update public.youth_academy_riders as academy
  set training_priority = p_training_priority, updated_at = now()
  where academy.id = p_academy_rider_id
    and academy.status in ('active', 'recruited')
    and public.current_user_manages_team(academy.team_id);

  if not found then
    raise exception 'Ce jeune ne fait pas partie de votre école.';
  end if;
end;
$$;

create or replace function public.recruit_current_youth_rider(
  p_academy_rider_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_academy record;
  v_game_year integer;
begin
  select game_year into v_game_year
  from public.seasons where status = 'active';

  select academy.* into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and public.current_user_manages_team(academy.team_id)
  for update;

  if v_academy is null or v_academy.status <> 'active' then
    raise exception 'Ce jeune n’est pas disponible pour un recrutement.';
  end if;
  if v_game_year - v_academy.birth_game_year < 17 then
    raise exception 'Un jeune ne peut être recruté qu’à partir de 17 ans.';
  end if;

  update public.youth_academy_riders
  set status = 'recruited', promotion_game_year = v_game_year + 1, updated_at = now()
  where id = v_academy.id;

  insert into public.youth_development_notifications (
    team_id,
    notification_type,
    title,
    message,
    source_reference
  ) values (
    v_academy.team_id,
    'promotion_scheduled',
    'Recrutement programmé',
    v_academy.first_name || ' ' || v_academy.last_name || ' rejoindra l’équipe première la saison prochaine.',
    'youth-promotion-scheduled:' || v_academy.id::text
  ) on conflict (team_id, source_reference) do nothing;

  return v_game_year + 1;
end;
$$;

create or replace function public.mark_current_youth_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.youth_development_notifications as notification
  set read_at = now()
  where notification.read_at is null
    and public.current_user_manages_team(notification.team_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant select on table public.country_cycling_development to authenticated;
grant select on table public.youth_scouting_missions to authenticated;
grant select on table public.youth_scouting_candidates to authenticated;
grant select on table public.youth_academy_riders to authenticated;
grant select on table public.youth_academy_training_sessions to authenticated;
grant select on table public.youth_development_notifications to authenticated;

grant all privileges on table public.country_cycling_development to service_role;
grant all privileges on table public.youth_scouting_missions to service_role;
grant all privileges on table public.youth_scouting_candidates to service_role;
grant all privileges on table public.youth_academy_riders to service_role;
grant all privileges on table public.youth_academy_training_sessions to service_role;
grant all privileges on table public.youth_development_notifications to service_role;

revoke all on function public.current_user_manages_team(uuid) from public, anon;
grant execute on function public.current_user_manages_team(uuid) to authenticated, service_role;

revoke all on function public.start_current_team_youth_scouting(uuid, uuid, integer) from public, anon;
grant execute on function public.start_current_team_youth_scouting(uuid, uuid, integer) to authenticated, service_role;
revoke all on function public.mark_current_team_scouting_report_viewed(uuid) from public, anon;
grant execute on function public.mark_current_team_scouting_report_viewed(uuid) to authenticated, service_role;
revoke all on function public.sign_current_team_youth_candidate(uuid) from public, anon;
grant execute on function public.sign_current_team_youth_candidate(uuid) to authenticated, service_role;
revoke all on function public.save_current_youth_training_priority(uuid, text) from public, anon;
grant execute on function public.save_current_youth_training_priority(uuid, text) to authenticated, service_role;
revoke all on function public.recruit_current_youth_rider(uuid) from public, anon;
grant execute on function public.recruit_current_youth_rider(uuid) to authenticated, service_role;
revoke all on function public.mark_current_youth_notifications_read() from public, anon;
grant execute on function public.mark_current_youth_notifications_read() to authenticated, service_role;

commit;
