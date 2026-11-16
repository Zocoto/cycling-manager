begin;

set local lock_timeout = '2s';
set local statement_timeout = '10s';

create table public.development_race_stage_plans (
  stage_id uuid not null references public.development_race_stages(id) on delete cascade,
  academy_rider_id uuid not null references public.youth_academy_riders(id) on delete cascade,
  development_registration_id uuid references public.development_race_registrations(id) on delete cascade,
  federation_registration_id uuid references public.national_federation_junior_race_registrations(id) on delete cascade,
  instruction text not null check (instruction in ('leader', 'domestique', 'attack', 'progressive', 'aggressive')),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(development_registration_id, federation_registration_id) = 1)
);

-- A neutral instruction is represented by the absence of a plan row. A
-- registration may rebuild its rider list, so callers only read plans by
-- joining the rider to the registration's current selection.
create unique index development_race_stage_plans_club_idx
  on public.development_race_stage_plans (development_registration_id, stage_id, academy_rider_id)
  where development_registration_id is not null;
create unique index development_race_stage_plans_federation_idx
  on public.development_race_stage_plans (federation_registration_id, stage_id, academy_rider_id)
  where federation_registration_id is not null;
create index development_race_stage_plans_stage_idx on public.development_race_stage_plans (stage_id);
create index development_race_stage_plans_rider_idx on public.development_race_stage_plans (academy_rider_id);

alter table public.development_race_stage_plans enable row level security;
revoke all on public.development_race_stage_plans from public, anon, authenticated;
grant select on public.development_race_stage_plans to service_role;

create function private.junior_race_preparation_registrations(p_scope text, p_registration_id uuid)
returns table (scope text, registration_id uuid, race_edition_id uuid, country_code text)
language sql stable set search_path = ''
as $$
  with manager as (
    select director.id, assignment.team_id
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.teams as team on team.id = assignment.team_id and team.status = 'active'
    where director.auth_user_id = (select auth.uid()) and director.status = 'active'
  )
  select 'club'::text, registration.id, edition.id, null::text
  from manager
  join public.development_teams as junior_team on junior_team.team_id = manager.team_id
    and junior_team.status = 'active'
  join public.seasons as season on season.id = junior_team.season_id and season.status = 'active'
  join public.development_race_registrations as registration
    on registration.development_team_id = junior_team.id and registration.status = 'registered'
  join public.development_race_editions as edition on edition.id = registration.race_edition_id
    and edition.season_id = season.id and edition.status = 'planned'
    and edition.competition_type = 'open'
  where (p_scope is null or p_scope = 'club')
    and (p_registration_id is null or registration.id = p_registration_id)
  union all
  select 'federation'::text, registration.id, edition.id, country.iso_alpha2::text
  from manager
  join public.team_seasons as team_season on team_season.team_id = manager.team_id
    and team_season.status in ('planned', 'active')
  join public.seasons as season on season.id = team_season.season_id and season.status = 'active'
  join public.countries as country on country.id = team_season.registration_country_id and country.is_active
  join lateral (
    select current_term.president_director_id, current_term.governance_mode
    from public.national_federation_terms as current_term
    where current_term.country_id = country.id
      and season.game_year between current_term.start_game_year and current_term.end_game_year
    order by current_term.start_game_year desc
    limit 1
  ) as term on term.president_director_id = manager.id and term.governance_mode = 'elected'
  join public.national_federation_selection_lists as selection on selection.country_id = country.id
    and selection.season_id = season.id and selection.status in ('pending_confirmation', 'finalized')
  join public.national_federation_selection_slots as slot on slot.slot_key = selection.slot_key
    and slot.rider_category = 'junior'
  join public.national_federation_junior_race_registrations as registration
    on registration.selection_list_id = selection.id and registration.country_id = country.id
    and registration.status = 'registered'
  join public.development_race_editions as edition on edition.id = registration.race_edition_id
    and edition.season_id = season.id and edition.status = 'planned'
    and edition.competition_type in ('continental_road', 'continental_time_trial', 'world_road', 'world_time_trial')
  where (p_scope is null or p_scope = 'federation')
    and (p_registration_id is null or registration.id = p_registration_id);
$$;

create function private.junior_race_preparation_roster(p_scope text, p_registration_id uuid)
returns table (rider_id uuid, first_name text, last_name text, country_code text)
language sql stable set search_path = ''
as $$
  select rider.id, rider.first_name, rider.last_name, country.iso_alpha2::text
  from (
    select selected.academy_rider_id
    from public.development_race_registration_riders as selected
    where p_scope = 'club' and selected.registration_id = p_registration_id
    union all
    select selected.academy_rider_id
    from public.national_federation_junior_race_registration_riders as selected
    where p_scope = 'federation' and selected.registration_id = p_registration_id
  ) as selection
  join public.youth_academy_riders as rider on rider.id = selection.academy_rider_id
  join public.countries as country on country.id = rider.country_id;
$$;

create function private.open_junior_race_preparation_stages(p_race_edition_id uuid)
returns table (stage_id uuid, preparation_closes_at timestamptz)
language sql stable set search_path = ''
as $$
  select stage.id, deadline.closes_at
  from public.development_race_editions as edition
  join public.seasons as season on season.id = edition.season_id and season.status = 'active'
  join public.development_race_stages as stage on stage.race_edition_id = edition.id
  cross join lateral (
    select (season.starts_on + (stage.day_number::integer - 1))::timestamp
      at time zone 'Europe/Paris' as closes_at
  ) as deadline
  where edition.id = p_race_edition_id and edition.status = 'planned'
    and stage.day_number > coalesce(season.current_day_number, 1)
    and deadline.closes_at > statement_timestamp()
    and not exists (
      select 1 from public.development_race_results as result
      where result.race_edition_id = edition.id and result.result_scope = 'stage' and result.stage_id = stage.id
    );
$$;

revoke all on function private.junior_race_preparation_registrations(text, uuid),
  private.junior_race_preparation_roster(text, uuid), private.open_junior_race_preparation_stages(uuid)
from public, anon, authenticated, service_role;

create function public.get_current_junior_race_preparations()
returns table (
  race_edition_id uuid, race_name text, race_slug text, stage_id uuid, stage_number integer,
  stage_day_number integer, stage_name text, stage_type text, profile_type text, distance_km numeric,
  preparation_closes_at timestamptz, registration_id uuid, scope text, country_code text, riders jsonb
)
language sql stable security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  select edition.id, edition.name, edition.slug, stage.id, stage.stage_number::integer,
    stage.day_number::integer, stage.name, stage.stage_type, stage.profile_type, stage.distance_km,
    available.preparation_closes_at, registration.registration_id, registration.scope, registration.country_code,
    roster.riders
  from private.junior_race_preparation_registrations(null, null) as registration
  join public.development_race_editions as edition on edition.id = registration.race_edition_id
  cross join lateral private.open_junior_race_preparation_stages(edition.id) as available
  join public.development_race_stages as stage on stage.id = available.stage_id
  cross join lateral (
    select jsonb_agg(jsonb_build_object(
      'riderId', rider.rider_id, 'firstName', rider.first_name, 'lastName', rider.last_name,
      'countryCode', rider.country_code,
      'instruction', coalesce(club_plan.instruction, federation_plan.instruction,
        case when stage.stage_type = 'individual_time_trial' then 'steady' else 'free' end)
    ) order by rider.last_name, rider.first_name, rider.rider_id) as riders
    from private.junior_race_preparation_roster(registration.scope, registration.registration_id) as rider
    left join public.development_race_stage_plans as club_plan on registration.scope = 'club'
      and club_plan.development_registration_id = registration.registration_id
      and club_plan.stage_id = stage.id and club_plan.academy_rider_id = rider.rider_id
    left join public.development_race_stage_plans as federation_plan on registration.scope = 'federation'
      and federation_plan.federation_registration_id = registration.registration_id
      and federation_plan.stage_id = stage.id and federation_plan.academy_rider_id = rider.rider_id
  ) as roster
  where roster.riders is not null
  order by stage.day_number, edition.name, stage.stage_number, registration.scope, registration.registration_id;
$$;

create function public.save_current_junior_race_preparation(
  p_stage_id uuid, p_registration_id uuid, p_scope text, p_instructions jsonb
)
returns void
language plpgsql volatile security definer
set search_path = ''
set statement_timeout = '5s'
set lock_timeout = '500ms'
as $$
declare
  v_edition_id uuid;
  v_stage_type text;
  v_closes_at timestamptz;
  v_rider_ids uuid[];
  v_allowed text[];
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_scope is null or p_scope not in ('club', 'federation')
     or p_stage_id is null or p_registration_id is null
     or jsonb_typeof(p_instructions) is distinct from 'array' then
    raise exception 'Le plan de course transmis est invalide.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_instructions) not between 1 and 20 then
    raise exception 'Le plan de course transmis est invalide.' using errcode = '22023';
  end if;

  select context.race_edition_id into v_edition_id
  from private.junior_race_preparation_registrations(p_scope, p_registration_id) as context;
  if v_edition_id is null then
    raise exception 'Cette inscription ne peut pas être préparée par ce compte.' using errcode = '42501';
  end if;

  -- Follow the edition-then-registration lock order used by settlement and
  -- club signup. The federation synchronizer also writes its parent row before
  -- it replaces members, so saving sees an entire roster revision.
  perform 1 from public.development_race_editions as edition
  where edition.id = v_edition_id for no key update;
  if p_scope = 'club' then
    perform 1 from public.development_race_registrations as registration
    where registration.id = p_registration_id for no key update;
  else
    perform 1 from public.national_federation_junior_race_registrations as registration
    where registration.id = p_registration_id for no key update;
  end if;

  if not exists (
    select 1 from private.junior_race_preparation_registrations(p_scope, p_registration_id) as context
    where context.race_edition_id = v_edition_id
  ) then
    raise exception 'Cette inscription ne peut pas être préparée par ce compte.' using errcode = '42501';
  end if;

  select stage.stage_type, available.preparation_closes_at into v_stage_type, v_closes_at
  from private.open_junior_race_preparation_stages(v_edition_id) as available
  join public.development_race_stages as stage on stage.id = available.stage_id
  where available.stage_id = p_stage_id;
  if v_stage_type is null or v_closes_at <= clock_timestamp() then
    raise exception 'Le départ est passé : les consignes sont verrouillées.' using errcode = '22023';
  end if;

  v_allowed := case when v_stage_type = 'individual_time_trial'
    then array['steady', 'progressive', 'aggressive']
    else array['free', 'leader', 'domestique', 'attack'] end;

  if exists (
    select 1 from jsonb_array_elements(p_instructions) as instruction(value)
    where case when jsonb_typeof(instruction.value) = 'object' then
      instruction.value - array['riderId', 'instruction'] <> '{}'::jsonb
      or coalesce(instruction.value->>'riderId', '') !~* v_uuid
      or not (coalesce(instruction.value->>'instruction', '') = any(v_allowed))
    else true end
  ) then
    raise exception 'Le plan de course transmis est invalide.' using errcode = '22023';
  end if;

  select array_agg(roster.rider_id order by roster.rider_id) into v_rider_ids
  from private.junior_race_preparation_roster(p_scope, p_registration_id) as roster;
  if v_rider_ids is distinct from (
    select array_agg(instruction."riderId" order by instruction."riderId")
    from jsonb_to_recordset(p_instructions) as instruction("riderId" uuid)
  ) then
    raise exception 'La composition a changé. Rechargez la page avant de valider.' using errcode = '40001';
  end if;
  if (
    select count(*) from jsonb_array_elements(p_instructions) as instruction(value)
    where instruction.value->>'instruction' = 'leader'
  ) > 1 then
    raise exception 'Choisissez un seul leader pour cette étape.' using errcode = '22023';
  end if;

  if p_scope = 'club' then
    delete from public.development_race_stage_plans
    where development_registration_id = p_registration_id and stage_id = p_stage_id;
  else
    delete from public.development_race_stage_plans
    where federation_registration_id = p_registration_id and stage_id = p_stage_id;
  end if;

  insert into public.development_race_stage_plans (
    stage_id, academy_rider_id, development_registration_id, federation_registration_id, instruction
  )
  select p_stage_id, instruction."riderId", case when p_scope = 'club' then p_registration_id end,
    case when p_scope = 'federation' then p_registration_id end, instruction.instruction
  from jsonb_to_recordset(p_instructions) as instruction("riderId" uuid, instruction text)
  where instruction.instruction not in ('free', 'steady');
end;
$$;

revoke all on function public.get_current_junior_race_preparations(),
  public.save_current_junior_race_preparation(uuid, uuid, text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.get_current_junior_race_preparations(),
  public.save_current_junior_race_preparation(uuid, uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
