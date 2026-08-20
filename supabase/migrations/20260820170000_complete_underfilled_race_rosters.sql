begin;

-- Une composition acceptée peut devenir trop courte pour plusieurs raisons :
-- blessure, départ du coureur ou priorité donnée à un championnat national.
-- La correction reste strictement additive et n'est ouverte que sous le
-- contingent minimum, jusqu'au départ réel de la course.
create or replace function public.complete_current_team_underfilled_race_roster(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_registration public.race_registrations%rowtype;
  v_edition public.race_editions%rowtype;
  v_competition_type text;
  v_team_id uuid;
  v_game_year integer;
  v_first_departure_at timestamptz;
  v_minimum_roster_size integer;
  v_maximum_roster_size integer;
  v_selected_count integer;
  v_valid_count integer;
  v_active_count integer;
  v_existing_active_count integer;
  v_rider_ids uuid[];
  v_conflict record;
  v_reopens_legacy_cn_withdrawal boolean := false;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_roster is null or jsonb_typeof(p_roster) <> 'array' then
    raise exception 'La composition transmise est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_roster) as entry(value)
    where not (entry.value ->> 'riderId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or coalesce(entry.value ->> 'role', 'auto') not in (
        'auto', 'leader', 'sprinter', 'leadout', 'free_agent', 'domestique',
        'mountain_classification'
      )
  ) then
    raise exception 'Un coureur ou un rôle transmis est invalide.';
  end if;

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_rider_ids
  from jsonb_array_elements(p_roster) with ordinality as entry(value, ordinality);

  v_selected_count := cardinality(coalesce(v_rider_ids, array[]::uuid[]));

  if v_selected_count <> (
    select count(distinct rider_id)
    from unnest(coalesce(v_rider_ids, array[]::uuid[])) as selected(rider_id)
  ) then
    raise exception 'La composition contient un coureur en double.';
  end if;

  select registration.*
  into v_registration
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.status in ('planned', 'active')
  join public.race_registrations as registration
    on registration.team_season_id = team_season.id
   and registration.race_edition_id = p_race_edition_id
   and registration.status in ('accepted', 'withdrawn')
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  for update of registration;

  if not found then
    raise exception using errcode = '42501', message = 'Aucune inscription à compléter pour cette course.';
  end if;

  select team_season.team_id, season.game_year
  into v_team_id, v_game_year
  from public.team_seasons as team_season
  join public.seasons as season
    on season.id = team_season.season_id
  where team_season.id = v_registration.team_season_id;

  select edition.*
  into v_edition
  from public.race_editions as edition
  where edition.id = p_race_edition_id;

  select race.competition_type
  into v_competition_type
  from public.races as race
  where race.id = v_edition.race_id;

  if v_competition_type is distinct from 'standard' then
    raise exception 'Les inscriptions aux championnats sont gérées depuis la grille dédiée.';
  end if;

  select min(coalesce(
    stage.departure_at,
    ((season_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
  ))
  into v_first_departure_at
  from public.stages as stage
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
  where stage.race_edition_id = p_race_edition_id;

  if v_edition.status in ('completed', 'cancelled', 'in_progress')
    or v_first_departure_at is null
    or now() >= v_first_departure_at
  then
    raise exception 'Le départ a eu lieu : la start-list ne peut plus être corrigée.';
  end if;

  select
    greatest(coalesce(category.minimum_roster_size, 1), 1),
    greatest(
      coalesce(category.maximum_roster_size, category.minimum_roster_size, 1),
      greatest(coalesce(category.minimum_roster_size, 1), 1)
    )
  into v_minimum_roster_size, v_maximum_roster_size
  from public.race_categories as category
  where category.id = v_edition.race_category_id;

  if v_minimum_roster_size is null or v_maximum_roster_size is null then
    raise exception 'Le contingent de cette course est invalide.';
  end if;

  -- Compatibilité avec les conflits CN déjà traités par l'ancienne règle,
  -- qui retirait toute l'inscription au lieu de conserver le reliquat.
  if v_registration.status = 'withdrawn' then
    select exists (
      select 1
      from public.race_rosters as withdrawn_roster
      join public.race_rosters as cn_roster
        on cn_roster.rider_id = withdrawn_roster.rider_id
       and cn_roster.status in ('selected', 'confirmed')
      join public.race_registrations as cn_registration
        on cn_registration.id = cn_roster.race_registration_id
       and cn_registration.status = 'accepted'
      join public.race_editions as cn_edition
        on cn_edition.id = cn_registration.race_edition_id
       and cn_edition.season_id = v_edition.season_id
      join public.races as cn_race
        on cn_race.id = cn_edition.race_id
       and cn_race.competition_type in ('national_road', 'national_time_trial')
      where withdrawn_roster.race_registration_id = v_registration.id
        and withdrawn_roster.status = 'withdrawn'
        and exists (
          select 1
          from public.stages as target_stage
          join public.stages as cn_stage
            on cn_stage.season_day_id = target_stage.season_day_id
           and cn_stage.race_edition_id = cn_edition.id
          where target_stage.race_edition_id = v_edition.id
        )
    ) into v_reopens_legacy_cn_withdrawal;

    if not v_reopens_legacy_cn_withdrawal then
      raise exception 'Cette inscription a été retirée volontairement et ne peut pas être rouverte après la limite habituelle.';
    end if;
  end if;

  select count(*)
  into v_existing_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed');

  if v_existing_active_count >= v_minimum_roster_size then
    raise exception 'Cette composition respecte déjà le contingent minimum et reste verrouillée.';
  end if;

  if v_selected_count < v_minimum_roster_size
    or v_selected_count > v_maximum_roster_size
  then
    raise exception 'Vous devez sélectionner entre % et % coureurs.',
      v_minimum_roster_size, v_maximum_roster_size;
  end if;

  select count(*)
  into v_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed')
    and roster.rider_id = any(v_rider_ids);

  if v_active_count <> v_existing_active_count then
    raise exception 'Les coureurs toujours engagés doivent rester dans la composition.';
  end if;

  if exists (
    select 1
    from (
      select final_role.role
      from (
        select roster.race_role as role
        from public.race_rosters as roster
        where roster.race_registration_id = v_registration.id
          and roster.status in ('selected', 'confirmed')

        union all

        select coalesce(entry.value ->> 'role', 'auto') as role
        from jsonb_array_elements(p_roster) as entry(value)
        where not exists (
          select 1
          from public.race_rosters as roster
          where roster.race_registration_id = v_registration.id
            and roster.rider_id = (entry.value ->> 'riderId')::uuid
            and roster.status in ('selected', 'confirmed')
        )
      ) as final_role
      where final_role.role in ('leader', 'sprinter')
      group by final_role.role
      having count(*) > 1
    ) as duplicate_unique_role
  ) then
    raise exception 'Un seul leader et un seul sprinteur peuvent être désignés.';
  end if;

  select count(distinct rider.id)
  into v_valid_count
  from public.riders as rider
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_team_id
   and contract.status = 'active'
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
  where rider.id = any(v_rider_ids)
    and rider.status = 'active'
    and start_season.game_year <= v_game_year
    and end_season.game_year >= v_game_year;

  if v_valid_count <> v_selected_count then
    raise exception 'Un coureur sélectionné ne fait pas partie de votre effectif actif.';
  end if;

  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = any(v_rider_ids)
      and injury.status = 'active'
      and injury.started_at < v_first_departure_at
      and injury.expected_recovery_at > v_first_departure_at
  ) then
    raise exception 'Un coureur sélectionné sera encore blessé au départ.';
  end if;

  select
    rider.first_name || ' ' || rider.last_name as rider_name,
    other_edition.display_name as race_name
  into v_conflict
  from unnest(v_rider_ids) as selected(rider_id)
  join public.riders as rider
    on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = rider.id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.season_id = v_edition.season_id
   and other_edition.id <> v_edition.id
  where exists (
    select 1
    from public.stages as target_stage
    join public.stages as other_stage
      on other_stage.season_day_id = target_stage.season_day_id
     and other_stage.race_edition_id = other_edition.id
    where target_stage.race_edition_id = v_edition.id
  )
  limit 1;

  if found then
    raise exception '% est déjà engagé sur % pendant cette course.',
      v_conflict.rider_name, v_conflict.race_name;
  end if;

  if v_reopens_legacy_cn_withdrawal then
    update public.race_registrations
    set
      status = 'accepted',
      decided_at = now()
    where id = v_registration.id;
  end if;

  insert into public.race_rosters (
    race_registration_id,
    rider_id,
    race_role,
    status,
    selected_at,
    withdrawn_by_injury_id
  )
  select
    v_registration.id,
    (entry.value ->> 'riderId')::uuid,
    coalesce(entry.value ->> 'role', 'auto'),
    'confirmed',
    now(),
    null
  from jsonb_array_elements(p_roster) as entry(value)
  on conflict (race_registration_id, rider_id)
  do update set
    race_role = case
      when race_rosters.status in ('selected', 'confirmed')
        then race_rosters.race_role
      else excluded.race_role
    end,
    status = 'confirmed',
    selected_at = excluded.selected_at,
    withdrawn_by_injury_id = null;

  select count(*)::integer
  into v_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed');

  update public.race_roster_notifications
  set
    requires_action = v_active_count < minimum_roster_size,
    active_roster_count = v_active_count,
    read_at = case
      when v_active_count >= minimum_roster_size then now()
      else null
    end,
    updated_at = now()
  where race_registration_id = v_registration.id;

  return query select v_registration.id, v_active_count;
end;
$$;

revoke all
on function public.complete_current_team_underfilled_race_roster(uuid, jsonb)
from public, anon;

grant execute
on function public.complete_current_team_underfilled_race_roster(uuid, jsonb)
to authenticated;

comment on function public.complete_current_team_underfilled_race_roster(uuid, jsonb) is
  'Complète uniquement une composition acceptée passée sous son contingent minimum, quelle que soit la cause du retrait.';

-- Compatibilité des anciennes versions du client, avec les mêmes garde-fous.
create or replace function public.replace_current_team_injured_race_roster(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registered_rider_count integer
)
language sql
security definer
set search_path = ''
as $$
  select completed.registration_id, completed.registered_rider_count
  from public.complete_current_team_underfilled_race_roster(
    p_race_edition_id,
    p_roster
  ) as completed;
$$;

revoke all
on function public.replace_current_team_injured_race_roster(uuid, jsonb)
from public, anon;

grant execute
on function public.replace_current_team_injured_race_roster(uuid, jsonb)
to authenticated;

comment on function public.replace_current_team_injured_race_roster(uuid, jsonb) is
  'Alias historique vers la réparation générique des compositions sous le minimum.';

-- Le conflit CN ne retire désormais que le coureur concerné. L'inscription et
-- les autres coureurs restent en place afin que le manager puisse la compléter.
create or replace function public.withdraw_underfilled_race_registration_after_cn_conflict(
  p_registration_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_status text;
  v_competition_type text;
  v_minimum_roster_size integer;
  v_active_roster_size integer;
begin
  select
    registration.status,
    race.competition_type,
    greatest(coalesce(category.minimum_roster_size, 1), 1)
  into
    v_registration_status,
    v_competition_type,
    v_minimum_roster_size
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  left join public.race_categories as category
    on category.id = edition.race_category_id
  where registration.id = p_registration_id
  for update of registration;

  if not found
    or v_registration_status not in ('accepted', 'pending')
    or v_competition_type in ('national_road', 'national_time_trial')
  then
    return false;
  end if;

  select count(*)::integer
  into v_active_roster_size
  from public.race_rosters as roster
  where roster.race_registration_id = p_registration_id
    and roster.status in ('selected', 'confirmed');

  -- p_now est conservé dans la signature pour les appels historiques.
  return v_active_roster_size < v_minimum_roster_size;
end;
$$;

revoke all
on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz)
from public, anon, authenticated;

grant execute
on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz)
to service_role;

comment on function public.withdraw_underfilled_race_registration_after_cn_conflict(uuid, timestamptz) is
  'Détecte une composition ordinaire sous le minimum après une priorité CN sans retirer son inscription.';

-- Répare les inscriptions de la saison active que l'ancienne règle CN avait
-- entièrement retirées : le coureur prioritaire reste au CN, les autres
-- coureurs encore actifs retrouvent leur place, puis le manager complète.
with affected_registrations as materialized (
  select distinct ordinary_registration.id
  from public.seasons as season
  join public.race_editions as ordinary_edition
    on ordinary_edition.season_id = season.id
   and ordinary_edition.status not in ('in_progress', 'completed', 'cancelled')
  join public.races as ordinary_race
    on ordinary_race.id = ordinary_edition.race_id
   and ordinary_race.competition_type = 'standard'
  join public.race_registrations as ordinary_registration
    on ordinary_registration.race_edition_id = ordinary_edition.id
   and ordinary_registration.status = 'withdrawn'
  where season.status = 'active'
    and ordinary_registration.decided_at >= timestamptz '2026-08-18 00:00:00+00'
    and exists (
      select 1
      from public.stages as future_stage
      join public.season_days as future_day
        on future_day.id = future_stage.season_day_id
      where future_stage.race_edition_id = ordinary_edition.id
        and coalesce(
          future_stage.departure_at,
          ((future_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
        ) > now()
    )
    and exists (
      select 1
      from public.race_rosters as withdrawn_roster
      join public.race_rosters as cn_roster
        on cn_roster.rider_id = withdrawn_roster.rider_id
       and cn_roster.status in ('selected', 'confirmed')
      join public.race_registrations as cn_registration
        on cn_registration.id = cn_roster.race_registration_id
       and cn_registration.status = 'accepted'
      join public.race_editions as cn_edition
        on cn_edition.id = cn_registration.race_edition_id
       and cn_edition.season_id = season.id
      join public.races as cn_race
        on cn_race.id = cn_edition.race_id
       and cn_race.competition_type in ('national_road', 'national_time_trial')
      where withdrawn_roster.race_registration_id = ordinary_registration.id
        and withdrawn_roster.status = 'withdrawn'
        and exists (
          select 1
          from public.stages as ordinary_stage
          join public.stages as cn_stage
            on cn_stage.season_day_id = ordinary_stage.season_day_id
           and cn_stage.race_edition_id = cn_edition.id
          where ordinary_stage.race_edition_id = ordinary_edition.id
        )
    )
), restored_rosters as (
  update public.race_rosters as roster
  set
    status = 'confirmed',
    withdrawn_by_injury_id = null
  from affected_registrations as affected,
       public.race_registrations as registration,
       public.team_seasons as team_season,
       public.race_editions as edition,
       public.seasons as season
  where roster.race_registration_id = affected.id
    and roster.status = 'withdrawn'
    and roster.withdrawn_by_injury_id is null
    and registration.id = affected.id
    and team_season.id = registration.team_season_id
    and edition.id = registration.race_edition_id
    and season.id = edition.season_id
    and exists (
      select 1
      from public.rider_contracts as contract
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
      where contract.rider_id = roster.rider_id
        and contract.team_id = team_season.team_id
        and contract.status = 'active'
        and start_season.game_year <= season.game_year
        and end_season.game_year >= season.game_year
    )
    and not exists (
      select 1
      from public.rider_injuries as injury
      join public.stages as target_stage
        on target_stage.race_edition_id = edition.id
      join public.season_days as target_day
        on target_day.id = target_stage.season_day_id
      where injury.rider_id = roster.rider_id
        and injury.started_at < coalesce(
          target_stage.departure_at,
          ((target_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
        ) + interval '8 hours'
        and injury.expected_recovery_at > coalesce(
          target_stage.departure_at,
          ((target_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
        )
    )
    and not exists (
      select 1
      from public.rider_form_camps as camp
      join public.stages as target_stage
        on target_stage.race_edition_id = edition.id
      join public.season_days as target_day
        on target_day.id = target_stage.season_day_id
      where camp.rider_id = roster.rider_id
        and camp.season_id = edition.season_id
        and camp.status <> 'cancelled'
        and target_day.day_number between camp.start_day_number and camp.end_day_number
    )
    and not exists (
      select 1
      from public.race_rosters as other_roster
      join public.race_registrations as other_registration
        on other_registration.id = other_roster.race_registration_id
       and other_registration.status in ('accepted', 'pending')
      join public.race_editions as other_edition
        on other_edition.id = other_registration.race_edition_id
       and other_edition.id <> edition.id
       and other_edition.season_id = edition.season_id
      where other_roster.rider_id = roster.rider_id
        and other_roster.status in ('selected', 'confirmed')
        and exists (
          select 1
          from public.stages as target_stage
          join public.stages as other_stage
            on other_stage.season_day_id = target_stage.season_day_id
           and other_stage.race_edition_id = other_edition.id
          where target_stage.race_edition_id = edition.id
        )
    )
  returning roster.race_registration_id
), reopened_registrations as (
  update public.race_registrations as registration
  set
    status = 'accepted',
    decided_at = now()
  from (
    select distinct restored.race_registration_id
    from restored_rosters as restored
  ) as repaired
  where registration.id = repaired.race_registration_id
  returning registration.id
)
select count(*)
from reopened_registrations;

notify pgrst, 'reload schema';

commit;
