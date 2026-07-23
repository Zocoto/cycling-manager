begin;

alter table public.race_rosters
add column withdrawn_by_injury_id uuid
  references public.rider_injuries(id) on delete set null;

create index race_rosters_withdrawn_by_injury_idx
  on public.race_rosters (withdrawn_by_injury_id)
  where withdrawn_by_injury_id is not null;

create table public.race_roster_notifications (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  race_registration_id uuid not null
    references public.race_registrations(id) on delete cascade,
  rider_id uuid not null
    references public.riders(id) on delete cascade,
  injury_id uuid not null
    references public.rider_injuries(id) on delete cascade,
  title text not null,
  message text not null,
  requires_action boolean not null default false,
  active_roster_count smallint not null,
  minimum_roster_size smallint not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_roster_notifications_injury_unique
    unique (race_registration_id, rider_id, injury_id),
  constraint race_roster_notifications_counts_valid check (
    active_roster_count >= 0
    and minimum_roster_size > 0
  )
);

create index race_roster_notifications_team_action_idx
  on public.race_roster_notifications (
    team_season_id,
    requires_action,
    created_at desc
  );

alter table public.race_roster_notifications enable row level security;

create policy race_roster_notifications_read_managed_team
on public.race_roster_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons as team_season
    where team_season.id = race_roster_notifications.team_season_id
      and public.current_user_manages_team(team_season.team_id)
  )
);

grant select on table public.race_roster_notifications to authenticated;
grant all privileges on table public.race_roster_notifications to service_role;

create or replace function public.withdraw_injured_rider_from_future_races()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_active_roster_count integer;
  v_minimum_roster_size integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  for v_entry in
    select
      roster.id as roster_id,
      registration.id as registration_id,
      registration.team_season_id,
      edition.id as race_edition_id,
      edition.display_name as race_name,
      rider.first_name || ' ' || rider.last_name as rider_name,
      race.competition_type as national_championship_type,
      category.minimum_roster_size,
      first_stage.departure_at
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
     and edition.status not in ('completed', 'cancelled', 'in_progress')
    join public.races as race
      on race.id = edition.race_id
    join public.riders as rider
      on rider.id = roster.rider_id
    left join public.race_categories as category
      on category.id = edition.race_category_id
    join lateral (
      select coalesce(
        stage.departure_at,
        ((season_day.calendar_date::timestamp + time '12:00') at time zone 'Europe/Paris')
      ) as departure_at
      from public.stages as stage
      join public.season_days as season_day
        on season_day.id = stage.season_day_id
      where stage.race_edition_id = edition.id
      order by stage.stage_number, stage.id
      limit 1
    ) as first_stage on true
    where roster.rider_id = new.rider_id
      and roster.status in ('selected', 'confirmed')
      and first_stage.departure_at > now()
      and new.started_at < first_stage.departure_at
      and new.expected_recovery_at > first_stage.departure_at
    order by first_stage.departure_at, roster.id
  loop
    update public.race_rosters
    set
      status = 'withdrawn',
      withdrawn_by_injury_id = new.id
    where id = v_entry.roster_id;

    select count(*)::integer
    into v_active_roster_count
    from public.race_rosters as roster
    where roster.race_registration_id = v_entry.registration_id
      and roster.status in ('selected', 'confirmed');

    v_minimum_roster_size := case
      when v_entry.national_championship_type in (
        'national_road',
        'national_time_trial'
      ) then 1
      else greatest(coalesce(v_entry.minimum_roster_size, 1), 1)
    end;

    insert into public.race_roster_notifications (
      team_season_id,
      race_registration_id,
      rider_id,
      injury_id,
      title,
      message,
      requires_action,
      active_roster_count,
      minimum_roster_size,
      read_at,
      updated_at
    )
    values (
      v_entry.team_season_id,
      v_entry.registration_id,
      new.rider_id,
      new.id,
      'Coureur retiré de ' || v_entry.race_name,
      v_entry.rider_name || ' est indisponible au départ de ' ||
        v_entry.race_name || ' et a été retiré automatiquement de la start-list.',
      v_active_roster_count < v_minimum_roster_size,
      v_active_roster_count,
      v_minimum_roster_size,
      case
        when v_active_roster_count < v_minimum_roster_size then null
        else now()
      end,
      now()
    )
    on conflict (race_registration_id, rider_id, injury_id)
    do update set
      title = excluded.title,
      message = excluded.message,
      requires_action = excluded.requires_action,
      active_roster_count = excluded.active_roster_count,
      minimum_roster_size = excluded.minimum_roster_size,
      read_at = excluded.read_at,
      updated_at = now();
  end loop;

  return new;
end;
$$;

drop trigger if exists withdraw_injured_rider_from_future_races
on public.rider_injuries;

create trigger withdraw_injured_rider_from_future_races
after insert or update of rider_id, status, started_at, expected_recovery_at
on public.rider_injuries
for each row
execute function public.withdraw_injured_rider_from_future_races();

-- Applique la règle aux blessures déjà actives au moment de la migration.
update public.rider_injuries
set expected_recovery_at = expected_recovery_at
where status = 'active'
  and expected_recovery_at > now();

create or replace function public.replace_current_team_injured_race_roster(
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
   and registration.status = 'accepted'
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = team_season.season_id
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  for update of registration;

  if not found then
    raise exception using errcode = '42501', message = 'Aucune inscription à corriger pour cette course.';
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

  if not exists (
    select 1
    from public.race_rosters as roster
    where roster.race_registration_id = v_registration.id
      and roster.withdrawn_by_injury_id is not null
  ) then
    raise exception 'Aucun retrait médical ne justifie une modification de cette composition.';
  end if;

  select
    case when v_competition_type in ('national_road', 'national_time_trial')
      then 1 else category.minimum_roster_size end,
    case when v_competition_type in ('national_road', 'national_time_trial')
      then 8 else category.maximum_roster_size end
  into v_minimum_roster_size, v_maximum_roster_size
  from public.race_categories as category
  where category.id = v_edition.race_category_id;

  if v_selected_count < v_minimum_roster_size
    or v_selected_count > v_maximum_roster_size
  then
    raise exception 'Vous devez sélectionner entre % et % coureurs.',
      v_minimum_roster_size, v_maximum_roster_size;
  end if;

  select count(*) into v_existing_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed');

  select count(*) into v_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_registration.id
    and roster.status in ('selected', 'confirmed')
    and roster.rider_id = any(v_rider_ids);

  if v_active_count <> v_existing_active_count then
    raise exception 'Les coureurs toujours valides doivent rester dans la composition.';
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
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
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
  join public.riders as rider on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = rider.id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status = 'accepted'
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.season_id = v_edition.season_id
   and other_edition.id <> v_edition.id
  join public.races as other_race on other_race.id = other_edition.race_id
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
on function public.replace_current_team_injured_race_roster(uuid, jsonb)
from public, anon;

grant execute
on function public.replace_current_team_injured_race_roster(uuid, jsonb)
to authenticated;

comment on column public.race_rosters.withdrawn_by_injury_id is
  'Blessure ayant provoqué le retrait automatique avant le départ.';
comment on table public.race_roster_notifications is
  'Alertes de retrait médical et de remplacement requis sur les futures start-lists.';
comment on function public.replace_current_team_injured_race_roster(uuid, jsonb) is
  'Autorise uniquement l ajout de remplaçants après un retrait médical, jusqu au départ réel.';

commit;
