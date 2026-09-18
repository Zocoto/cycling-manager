begin;

-- A pending entry is preparable only when it is an actual Elite WildCard
-- request. The official simulation still reads accepted entries exclusively.
create or replace function public.is_race_registration_preparable(
  p_registration_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select registration.status = 'accepted'
      or (
        registration.status = 'pending'
        and registration.entry_method = 'requested'
        and category.code = 'elite'
      )
    from public.race_registrations as registration
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.race_categories as category
      on category.id = edition.race_category_id
    where registration.id = p_registration_id
  ), false);
$$;

revoke all on function public.is_race_registration_preparable(uuid)
  from public, anon, authenticated;

-- Preserve the later rating, availability, CLM and international-selection
-- changes in these RPCs while widening their single registration gate.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_old constant text := 'registration.status = ''accepted''';
  v_new constant text :=
    'public.is_race_registration_preparable(registration.id)';
  v_count integer;
begin
  foreach v_signature in array array[
    'public.get_current_team_race_preparation()'::regprocedure,
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure,
    'public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)'::regprocedure,
    'public.get_current_team_stage_role_plan(uuid)'::regprocedure,
    'public.save_current_team_stage_role_plan(uuid,uuid,jsonb)'::regprocedure,
    'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'::regprocedure,
    'public.prevent_reserved_race_equipment_inventory_reduction()'::regprocedure,
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],uuid)'::regprocedure,
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)'::regprocedure
  ] loop
    select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
    into v_definition;
    v_count := (length(v_definition) - length(replace(v_definition, v_old, '')))
      / length(v_old);
    if v_count <> 1 then
      raise exception 'Filtre d inscription inattendu dans % : % occurrences.',
        v_signature, v_count;
    end if;
    execute replace(v_definition, v_old, v_new);
  end loop;
end;
$migration$;

-- The reconnaissance must target the very riders proposed in that entry.
create or replace function public.assert_reconnaissance_riders_registered(
  p_edition_id uuid,
  p_team_season_id uuid,
  p_rider_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registered_count integer;
begin
  select count(distinct roster.rider_id)
  into v_registered_count
  from public.race_registrations as registration
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where registration.race_edition_id = p_edition_id
    and registration.team_season_id = p_team_season_id
    and public.is_race_registration_preparable(registration.id)
    and roster.rider_id = any(p_rider_ids);

  if v_registered_count <> cardinality(p_rider_ids) then
    raise exception
      'Tous les coureurs doivent figurer sur la liste acceptée ou la demande de WildCard Élite en attente.';
  end if;
end;
$$;

-- An organizer refusal invalidates all plans. Reconnaissance costs are
-- deliberately untouched: the original debit remains posted. Voluntary or
-- federation-driven withdrawal follows its separate cancellation/refund rules.
create or replace function public.cancel_unawarded_elite_wildcard_preparations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_day_number integer;
begin
  if old.status <> 'pending'
    or new.status <> 'rejected'
    or old.entry_method <> 'requested'
    or not exists (
      select 1
      from public.race_editions as edition
      join public.race_categories as category
        on category.id = edition.race_category_id
      where edition.id = new.race_edition_id
        and category.code = 'elite'
    )
  then
    return new;
  end if;

  select coalesce(season.current_day_number, 1)
  into v_current_day_number
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.id = new.team_season_id;

  delete from public.race_stage_strategies
  where race_registration_id = new.id;
  delete from public.race_roster_stage_roles
  where race_registration_id = new.id;
  delete from public.race_time_trial_rider_plans
  where race_registration_id = new.id;
  delete from public.race_stage_equipment_assignments
  where team_season_id = new.team_season_id
    and race_edition_id = new.race_edition_id;

  -- A future camp is released immediately. An active camp keeps the effects
  -- of the current day, but ends no later than that day. Past work is not
  -- retroactively erased; only the race bonus is cancelled below.
  update public.rider_form_camps as camp
  set
    status = case when camp.status = 'planned' then 'cancelled'
      else camp.status end,
    end_day_number = case
      when camp.status = 'active'
        and v_current_day_number < camp.end_day_number
        then v_current_day_number
      else camp.end_day_number
    end,
    interruption_requested_at = case
      when camp.status = 'active'
        and v_current_day_number < camp.end_day_number
        then now()
      else camp.interruption_requested_at
    end,
    interruption_effective_day_number = case
      when camp.status = 'active'
        and v_current_day_number < camp.end_day_number
        then v_current_day_number + 1
      else camp.interruption_effective_day_number
    end
  where camp.status in ('planned', 'active')
    and camp.id in (
      select participant.form_camp_id
      from public.stage_reconnaissance_riders as participant
      join public.stage_reconnaissances as reconnaissance
        on reconnaissance.id = participant.reconnaissance_id
       and reconnaissance.team_season_id = new.team_season_id
      join public.stages as stage
        on stage.id = reconnaissance.target_stage_id
       and stage.race_edition_id = new.race_edition_id
    );

  update public.stage_reconnaissances as reconnaissance
  set status = 'cancelled'
  from public.stages as stage
  where stage.id = reconnaissance.target_stage_id
    and stage.race_edition_id = new.race_edition_id
    and reconnaissance.team_season_id = new.team_season_id
    and reconnaissance.status <> 'cancelled';

  return new;
end;
$$;

drop trigger if exists cancel_unawarded_elite_wildcard_preparations
  on public.race_registrations;
create trigger cancel_unawarded_elite_wildcard_preparations
after update of status on public.race_registrations
for each row execute function public.cancel_unawarded_elite_wildcard_preparations();

revoke all on function public.cancel_unawarded_elite_wildcard_preparations()
  from public, anon, authenticated;

comment on function public.is_race_registration_preparable(uuid) is
  'Préparation autorisée pour une inscription acceptée ou une vraie demande de WildCard Élite encore en attente.';
comment on function public.cancel_unawarded_elite_wildcard_preparations() is
  'Annule les plans et bonus d une WildCard Élite refusée, sans rembourser la reconnaissance.';
comment on function public.assert_reconnaissance_riders_registered(uuid,uuid,uuid[]) is
  'Exige que chaque coureur figure sur la liste acceptée ou la demande de WildCard Élite encore en attente.';

notify pgrst, 'reload schema';
commit;
