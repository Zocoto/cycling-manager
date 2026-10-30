begin;
set local statement_timeout = '8s';
set local lock_timeout = '500ms';
set local application_name = 'empty-team-roster-recovery-20261030';

-- This is a roster rescue, not a new career: no opening cash, sponsor, staff,
-- infrastructure, reputation, initial-generation or newcomer-reward changes.
-- A separate receipt caps both the club and its DS at one rescue per season.
create table private.empty_team_roster_recoveries (
  id uuid primary key default gen_random_uuid(),
  sporting_director_id uuid not null references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  country_id uuid not null references public.countries(id) on delete restrict,
  rider_ids uuid[] not null check (cardinality(rider_ids) = 7),
  created_at timestamptz not null default now(),
  unique (team_id, season_id),
  unique (sporting_director_id, season_id)
);
alter table private.empty_team_roster_recoveries enable row level security;
revoke all on private.empty_team_roster_recoveries from public, anon, authenticated, service_role;

-- Shared by the read-only eligibility RPC, the existing assistant payload and
-- the mutation after acquiring the same roster lock as transfers/recruitment.
create function private.can_recover_empty_team_roster(
  p_director_id uuid, p_team_id uuid, p_season_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.sporting_directors director
    join public.team_manager_assignments assignment
      on assignment.sporting_director_id = director.id
      and assignment.team_id = p_team_id
      and assignment.role = 'general_manager' and assignment.status = 'active'
    join public.teams team on team.id = assignment.team_id and team.status = 'active'
    join public.seasons season on season.id = p_season_id and season.status = 'active'
    join public.team_seasons team_season
      on team_season.team_id = team.id and team_season.season_id = season.id and team_season.status = 'active'
    join public.countries country on country.id = team_season.registration_country_id and country.is_active
    join public.country_rider_generation_profiles profile on profile.country_id = country.id
    where director.id = p_director_id and director.status = 'active'
      and exists (select 1 from public.initial_career_generations generation where generation.team_id = team.id)
      -- A loan/selection/unavailable rider still belongs to the current squad.
      -- Pure future-season commitments do not stop a currently empty club.
      and not exists (select 1 from public.rider_contracts contract
        join public.seasons starts on starts.id=contract.start_season_id
        join public.seasons ends on ends.id=contract.end_season_id
        where contract.team_id = team.id and contract.status in ('active', 'planned')
          and season.game_year between starts.game_year and ends.game_year)
      and not exists (select 1 from private.empty_team_roster_recoveries recovery
        where recovery.season_id = season.id and recovery.team_id = team.id)
      and not exists (select 1 from private.empty_team_roster_recoveries recovery
        where recovery.season_id = season.id and recovery.sporting_director_id = director.id)
  );
$$;
revoke all on function private.can_recover_empty_team_roster(uuid,uuid,uuid) from public, anon, authenticated, service_role;

create function public.get_current_empty_roster_recovery_state()
returns table (
  available boolean,
  team_country_id uuid,
  team_country_name text,
  team_country_iso_alpha2 text,
  name_profile_code text,
  recovered_this_season boolean,
  has_committed_riders boolean
)
language sql stable security definer set search_path = '' set statement_timeout = '3000ms' as $$
  select private.can_recover_empty_team_roster(director.id,team.id,season.id),
    country.id,country.name,country.iso_alpha2,profile.name_profile_code,
    exists (select 1 from private.empty_team_roster_recoveries recovery
      where recovery.season_id = season.id and recovery.team_id = team.id)
      or exists (select 1 from private.empty_team_roster_recoveries recovery
      where recovery.season_id = season.id and recovery.sporting_director_id = director.id),
    exists (select 1 from public.rider_contracts contract
      join public.seasons starts on starts.id=contract.start_season_id
      join public.seasons ends on ends.id=contract.end_season_id
      where contract.team_id = team.id and contract.status in ('active','planned')
        and season.game_year between starts.game_year and ends.game_year)
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams team on team.id = assignment.team_id and team.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = team.id and team_season.season_id = season.id and team_season.status = 'active'
  join public.countries country on country.id = team_season.registration_country_id and country.is_active
  left join public.country_rider_generation_profiles profile on profile.country_id = country.id
  where director.auth_user_id = auth.uid() and director.status = 'active'
  order by season.starts_on desc,team.id limit 1;
$$;
revoke all on function public.get_current_empty_roster_recovery_state() from public, anon, service_role;
grant execute on function public.get_current_empty_roster_recovery_state() to authenticated;

create function public.recover_current_empty_team_roster(
  p_rider_identities jsonb, p_expected_country_id uuid
)
returns jsonb language plpgsql security definer set search_path = ''
set statement_timeout = '5000ms' set lock_timeout = '500ms' as $$
declare
  v_context record;
  v_profile record;
  v_identity record;
  v_rider_id uuid;
  v_rider_ids uuid[] := array[]::uuid[];
  v_age_offset integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Votre session a expiré. Reconnectez-vous pour continuer.';
  end if;
  select director.id as director_id,assignment.team_id,season.id as season_id,season.game_year,season.current_day_number,
    team_season.registration_country_id as country_id
  into v_context
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams team on team.id = assignment.team_id and team.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = team.id and team_season.season_id = season.id and team_season.status = 'active'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  order by season.starts_on desc,team.id limit 1;
  if v_context is null then
    raise exception using errcode = '42501', message = 'Aucune équipe active ne permet de relancer votre effectif.';
  end if;

  -- Compatible with every existing contract-capacity trigger and the trade
  -- locks. Fail fast rather than waiting in a cycle with older auction jobs.
  perform private.lock_direct_transfer_scope(v_context.season_id,array[v_context.team_id],array[]::uuid[]);
  select season.game_year,season.current_day_number into v_context.game_year,v_context.current_day_number
  from public.seasons season
    where season.id = v_context.season_id and season.status = 'active' for share nowait;
  if not found then raise exception 'La saison a changé. Actualisez la page avant de relancer votre effectif.'; end if;
  perform 1
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams team on team.id = assignment.team_id and team.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = team.id and team_season.season_id = v_context.season_id and team_season.status = 'active'
  where director.id = v_context.director_id and director.auth_user_id = auth.uid() and director.status = 'active'
    and team.id = v_context.team_id and team_season.registration_country_id = v_context.country_id
  for update of director,assignment,team,team_season nowait;
  if not found then raise exception 'Votre équipe a changé. Actualisez la page avant de relancer votre effectif.'; end if;
  if p_expected_country_id is distinct from v_context.country_id then
    raise exception 'Le pays de votre équipe a changé. Actualisez la page avant de relancer votre effectif.';
  end if;

  if exists (select 1 from private.empty_team_roster_recoveries recovery
      where recovery.season_id = v_context.season_id
        and (recovery.team_id = v_context.team_id or recovery.sporting_director_id = v_context.director_id)) then
    return jsonb_build_object('status','already_recovered','rider_count',0);
  end if;
  if not private.can_recover_empty_team_roster(v_context.director_id,v_context.team_id,v_context.season_id) then
    raise exception 'La relance est réservée aux équipes fondées sans contrat de coureur pour la saison en cours.';
  end if;
  if p_rider_identities is null or jsonb_typeof(p_rider_identities) <> 'array' then
    raise exception 'La relance exige exactement sept identités de coureurs.';
  end if;
  if jsonb_array_length(p_rider_identities) <> 7 then
    raise exception 'La relance exige exactement sept identités de coureurs.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rider_identities) item(value)
    where jsonb_typeof(item.value) <> 'object'
      or char_length(btrim(coalesce(item.value ->> 'first_name',''))) not between 1 and 80
      or char_length(btrim(coalesce(item.value ->> 'last_name',''))) not between 1 and 80
      or coalesce(item.value ->> 'first_name','') ~ '[[:cntrl:]<>]'
      or coalesce(item.value ->> 'last_name','') ~ '[[:cntrl:]<>]'
      or coalesce(item.value ->> 'avatar_seed','') !~ '^[0-9]{1,18}$'
  ) or exists (
    select 1 from jsonb_array_elements(p_rider_identities) item(value)
    group by lower(btrim(item.value ->> 'first_name')),lower(btrim(item.value ->> 'last_name')) having count(*) > 1
  ) then raise exception 'Les identités de l’effectif de relance sont invalides.'; end if;

  select profile.name_profile_code,profile.avatar_profile_key into strict v_profile
  from public.country_rider_generation_profiles profile
  join public.countries country on country.id = profile.country_id and country.is_active
  where country.id = v_context.country_id;
  v_age_offset := (((hashtextextended(v_context.director_id::text,0) % 7) + 7) % 7)::integer;

  for v_identity in
    select item.value as identity_data,item.ordinality::integer as slot,profile.*
    from jsonb_array_elements(p_rider_identities) with ordinality item(value,ordinality)
    join (values
      (1,64,58,45,47,40,42,50,55,57,54,58,56,44),
      (2,56,64,49,46,43,54,62,54,56,55,55,60,48),
      (3,43,48,62,64,49,50,52,49,60,58,55,48,62),
      (4,40,46,58,48,44,65,64,47,54,52,50,42,56),
      (5,42,50,60,51,65,56,58,50,59,61,53,54,52),
      (6,52,57,55,52,50,50,54,56,61,59,56,65,50),
      (7,50,52,56,53,52,51,52,54,63,62,61,55,51)
    ) profile(profile_slot,mountain,hills,flat,time_trial,cobbles,sprint,acceleration,downhill,endurance,resistance,recovery,breakaway,prologue)
      on profile.profile_slot = item.ordinality
    order by item.ordinality
  loop
    -- Only identities are supplied. Country, IDs, talent, age and every rating
    -- use locked server state and the regular initial v3 generation defaults.
    insert into public.riders(country_id,first_name,last_name,status,generated_name_profile_code,avatar_profile_key,avatar_seed)
    values(v_context.country_id,btrim(v_identity.identity_data ->> 'first_name'),btrim(v_identity.identity_data ->> 'last_name'),
      'active',v_profile.name_profile_code,v_profile.avatar_profile_key,(v_identity.identity_data ->> 'avatar_seed')::bigint)
    returning id into v_rider_id;
    v_rider_ids := array_append(v_rider_ids,v_rider_id);
    insert into public.rider_season_ratings(rider_id,season_id,age,mountain,hills,flat,time_trial,cobbles,sprint,acceleration,downhill,endurance,resistance,recovery,breakaway,prologue)
    values(v_rider_id,v_context.season_id,18+((v_identity.slot-1+v_age_offset)%7),v_identity.mountain,v_identity.hills,v_identity.flat,v_identity.time_trial,
      v_identity.cobbles,v_identity.sprint,v_identity.acceleration,v_identity.downhill,v_identity.endurance,v_identity.resistance,v_identity.recovery,v_identity.breakaway,v_identity.prologue);
    update public.rider_season_ratings rating set
      mountain=private.randomize_initial_amateur_rating(rating.mountain,v_context.team_id,v_rider_id,'mountain'),
      hills=private.randomize_initial_amateur_rating(rating.hills,v_context.team_id,v_rider_id,'hills'),
      flat=private.randomize_initial_amateur_rating(rating.flat,v_context.team_id,v_rider_id,'flat'),
      time_trial=private.randomize_initial_amateur_rating(rating.time_trial,v_context.team_id,v_rider_id,'time_trial'),
      cobbles=private.randomize_initial_amateur_rating(rating.cobbles,v_context.team_id,v_rider_id,'cobbles'),
      sprint=private.randomize_initial_amateur_rating(rating.sprint,v_context.team_id,v_rider_id,'sprint'),
      acceleration=private.randomize_initial_amateur_rating(rating.acceleration,v_context.team_id,v_rider_id,'acceleration'),
      downhill=private.randomize_initial_amateur_rating(rating.downhill,v_context.team_id,v_rider_id,'downhill'),
      endurance=private.randomize_initial_amateur_rating(rating.endurance,v_context.team_id,v_rider_id,'endurance'),
      resistance=private.randomize_initial_amateur_rating(rating.resistance,v_context.team_id,v_rider_id,'resistance'),
      recovery=private.randomize_initial_amateur_rating(rating.recovery,v_context.team_id,v_rider_id,'recovery'),
      breakaway=private.randomize_initial_amateur_rating(rating.breakaway,v_context.team_id,v_rider_id,'breakaway'),
      prologue=private.randomize_initial_amateur_rating(rating.prologue,v_context.team_id,v_rider_id,'prologue')
    where rating.rider_id=v_rider_id and rating.season_id=v_context.season_id;
  end loop;

  -- One normal batch salary quote, after the final ratings, rather than seven
  -- population scans. INSERT keeps the usual team discounts and salary-sync
  -- triggers. Rescue is not a new-career wage waiver; only installments due
  -- from today onward are payable (reuse the existing billing boundary).
  insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,salary_per_season,
    currency,currency_code,acquisition_type,status,signed_at,salary_billing_from_game_day_index)
  select quote.rider_id,v_context.team_id,v_context.season_id,v_context.season_id,quote.salary_per_season,
    'EUR','EUR','initial','active',now(),v_context.game_year*28+v_context.current_day_number-1
  from public.calculate_rider_season_salary_quotes(v_rider_ids,v_context.season_id) quote
  where quote.salary_per_season > 0;
  if cardinality(v_rider_ids) <> 7 or (select count(*) from public.rider_contracts contract
      where contract.team_id=v_context.team_id and contract.rider_id=any(v_rider_ids)
        and contract.status='active' and contract.start_season_id=v_context.season_id
        and contract.end_season_id=v_context.season_id and contract.salary_per_season>0) <> 7 then
    raise exception 'L’effectif de relance est incomplet. Aucun coureur n’a été ajouté.';
  end if;
  insert into private.empty_team_roster_recoveries(sporting_director_id,team_id,season_id,country_id,rider_ids)
  values(v_context.director_id,v_context.team_id,v_context.season_id,v_context.country_id,v_rider_ids);
  return jsonb_build_object('status','created','rider_count',7);
end;
$$;
revoke all on function public.recover_current_empty_team_roster(jsonb,uuid) from public, anon, service_role;
grant execute on function public.recover_current_empty_team_roster(jsonb,uuid) to authenticated;

-- Add one indexed eligibility check to the existing initial assistant payload;
-- preserve its columns, every existing alert and its three-second budget.
do $patch$
declare v_definition text; v_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
begin
  v_definition := pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure);
  if position('emptyRosterRecoveryAvailable' in v_definition)>0 or
    (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'Unexpected dashboard function; empty roster recovery update cancelled.';
  end if;
  execute replace(v_definition,v_anchor,$replacement$'emptyRosterRecoveryAvailable', coalesce((
        select private.can_recover_empty_team_roster(context.sporting_director_id,context.team_id,context.season_id)
        from current_context context
      ),false),
      'equipmentPartnerSignatureAvailable', ($replacement$);
end;
$patch$;
notify pgrst,'reload schema';
commit;
