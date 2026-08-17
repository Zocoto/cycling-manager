begin;

-- ============================================================
-- CHAMPIONNATS NATIONAUX : CLASSEMENT NATIONAL ET CHOIX DU DS
-- Le classement est calculé séparément dans chaque pays. En l'absence de
-- choix explicite du manager, les 200 premiers nationaux sont engagés.
-- ============================================================

create table public.national_championship_rider_preferences (
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  rider_id uuid not null
    references public.riders(id)
    on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  is_selected boolean not null,
  updated_at timestamptz not null default now(),
  primary key (race_edition_id, rider_id)
);

create index national_championship_preferences_team_idx
  on public.national_championship_rider_preferences (
    team_season_id,
    updated_at desc
  );

alter table public.national_championship_rider_preferences
  enable row level security;

create policy national_championship_preferences_select_managed
on public.national_championship_rider_preferences
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons as team_season
    where team_season.id = national_championship_rider_preferences.team_season_id
      and public.current_user_manages_team(team_season.team_id)
  )
);

grant select
on table public.national_championship_rider_preferences
to authenticated;

grant all privileges
on table public.national_championship_rider_preferences
to service_role;

-- Les retraits déjà demandés restent des refus explicites dans la nouvelle
-- grille unifiée.
insert into public.national_championship_rider_preferences (
  race_edition_id,
  rider_id,
  team_season_id,
  is_selected,
  updated_at
)
select
  withdrawal.race_edition_id,
  withdrawal.rider_id,
  withdrawal.team_season_id,
  false,
  withdrawal.withdrawn_at
from public.national_championship_rider_withdrawals as withdrawal
on conflict (race_edition_id, rider_id)
do update set
  team_season_id = excluded.team_season_id,
  is_selected = false,
  updated_at = excluded.updated_at;

create or replace function public.get_national_championship_country_rankings(
  p_season_id uuid
)
returns table (
  rider_id uuid,
  country_id uuid,
  team_season_id uuid,
  national_rank integer,
  uci_points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rider.id as rider_id,
    rider.country_id,
    ownership.team_season_id,
    row_number() over (
      partition by rider.country_id
      order by
        coalesce(summary.points, 0) desc,
        round(((
          rating.mountain
          + rating.hills
          + rating.flat
          + rating.time_trial
          + rating.cobbles
          + rating.sprint
          + rating.acceleration
          + rating.downhill
          + rating.endurance
          + rating.resistance
          + rating.recovery
          + rating.breakaway
          + rating.prologue
        )::numeric / 13), 2) desc,
        rider.last_name,
        rider.first_name,
        rider.id
    )::integer as national_rank,
    coalesce(summary.points, 0)::integer as uci_points
  from public.riders as rider
  join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = p_season_id
  left join public.rider_season_summaries as summary
    on summary.rider_id = rider.id
   and summary.season_id = p_season_id
  left join lateral (
    select team_season.id as team_season_id
    from public.rider_contracts as contract
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = p_season_id
     and team_season.status in ('planned', 'active')
    where contract.rider_id = rider.id
      and contract.status = 'active'
    order by contract.created_at desc, team_season.id
    limit 1
  ) as ownership on true
  where rider.status in ('active', 'free_agent')
    and rider.country_id is not null;
$$;

revoke all
on function public.get_national_championship_country_rankings(uuid)
from public, anon, authenticated;

grant execute
on function public.get_national_championship_country_rankings(uuid)
to service_role;

comment on function public.get_national_championship_country_rankings(uuid)
  is 'Classe les coureurs séparément dans leur pays pour déterminer les 200 engagés par défaut aux CN.';

create or replace function public.sync_national_championship_registrations(
  p_season_id uuid,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_registration_id uuid;
  v_synced integer := 0;
begin
  -- Un choix explicite du DS prime sur le classement. Sans préférence, seuls
  -- les 200 premiers du pays sont retenus.
  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as edition,
       public.races as race,
       public.stages as stage
  where registration.id = roster.race_registration_id
    and edition.id = registration.race_edition_id
    and race.id = edition.race_id
    and stage.race_edition_id = edition.id
    and stage.stage_number = 1
    and edition.season_id = p_season_id
    and edition.status not in ('completed', 'cancelled')
    and stage.departure_at > p_now
    and race.competition_type in ('national_road', 'national_time_trial')
    and roster.status in ('selected', 'confirmed')
    and not exists (
      select 1
      from public.get_national_championship_country_rankings(p_season_id) as candidate
      left join public.national_championship_rider_preferences as preference
        on preference.race_edition_id = edition.id
       and preference.rider_id = candidate.rider_id
      left join public.national_championship_rider_withdrawals as withdrawal
        on withdrawal.race_edition_id = edition.id
       and withdrawal.rider_id = candidate.rider_id
      where candidate.rider_id = roster.rider_id
        and candidate.country_id = race.country_id
        and (
          preference.is_selected = true
          or (
            preference.rider_id is null
            and withdrawal.rider_id is null
            and candidate.national_rank <= 200
          )
        )
    );

  for v_entry in
    select
      edition.id as race_edition_id,
      candidate.rider_id,
      candidate.team_season_id,
      candidate.national_rank
    from public.get_national_championship_country_rankings(p_season_id) as candidate
    join public.races as race
      on race.country_id = candidate.country_id
     and race.competition_type in ('national_road', 'national_time_trial')
    join public.race_editions as edition
      on edition.race_id = race.id
     and edition.season_id = p_season_id
     and edition.status not in ('completed', 'cancelled')
    join public.stages as stage
      on stage.race_edition_id = edition.id
     and stage.stage_number = 1
     and stage.departure_at > p_now
    left join public.national_championship_rider_preferences as preference
      on preference.race_edition_id = edition.id
     and preference.rider_id = candidate.rider_id
    left join public.national_championship_rider_withdrawals as withdrawal
      on withdrawal.race_edition_id = edition.id
     and withdrawal.rider_id = candidate.rider_id
    where preference.is_selected = true
       or (
         preference.rider_id is null
         and withdrawal.rider_id is null
         and candidate.national_rank <= 200
       )
    order by edition.id, candidate.national_rank
  loop
    v_registration_id := null;

    if v_entry.team_season_id is not null then
      insert into public.race_registrations (
        race_edition_id,
        team_season_id,
        historical_team_name,
        entry_method,
        status,
        registered_at,
        decided_at
      )
      values (
        v_entry.race_edition_id,
        v_entry.team_season_id,
        null,
        'automatic',
        'accepted',
        p_now,
        p_now
      )
      on conflict (race_edition_id, team_season_id)
      do update set
        historical_team_name = null,
        entry_method = 'automatic',
        status = 'accepted',
        decided_at = p_now
      returning id into v_registration_id;
    else
      select registration.id
      into v_registration_id
      from public.race_registrations as registration
      where registration.race_edition_id = v_entry.race_edition_id
        and registration.team_season_id is null
        and registration.historical_team_name = 'Coureurs libres'
      for update;

      if v_registration_id is null then
        insert into public.race_registrations (
          race_edition_id,
          team_season_id,
          historical_team_name,
          entry_method,
          status,
          registered_at,
          decided_at
        )
        values (
          v_entry.race_edition_id,
          null,
          'Coureurs libres',
          'automatic',
          'accepted',
          p_now,
          p_now
        )
        returning id into v_registration_id;
      else
        update public.race_registrations
        set
          entry_method = 'automatic',
          status = 'accepted',
          decided_at = p_now
        where id = v_registration_id;
      end if;
    end if;

    insert into public.race_rosters (
      race_registration_id,
      rider_id,
      race_role,
      status,
      selected_at
    )
    values (
      v_registration_id,
      v_entry.rider_id,
      'auto',
      'confirmed',
      p_now
    )
    on conflict (race_registration_id, rider_id)
    do update set
      race_role = 'auto',
      status = 'confirmed',
      selected_at = p_now;

    v_synced := v_synced + 1;
  end loop;

  insert into public.national_championship_notifications (
    team_season_id,
    race_edition_id,
    notification_type,
    title,
    message,
    created_at
  )
  select
    registration.team_season_id,
    edition.id,
    'selection',
    case race.competition_type
      when 'national_time_trial' then 'Sélection aux CN contre-la-montre'
      else 'Sélection aux CN sur route'
    end,
    format(
      '%s : %s. La sélection par défaut retient le top 200 national ; votre choix dans la grille reste prioritaire jusqu’au départ.',
      country.name,
      string_agg(
        rider.first_name || ' ' || rider.last_name,
        ', '
        order by rider.last_name, rider.first_name
      )
    ),
    p_now
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
   and edition.season_id = p_season_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in ('national_road', 'national_time_trial')
  join public.countries as country on country.id = race.country_id
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.riders as rider on rider.id = roster.rider_id
  where registration.team_season_id is not null
    and registration.status = 'accepted'
  group by
    registration.team_season_id,
    edition.id,
    race.competition_type,
    country.name
  on conflict (team_season_id, race_edition_id, notification_type)
  do update set
    title = excluded.title,
    message = excluded.message;

  return v_synced;
end;
$$;

revoke all
on function public.sync_national_championship_registrations(uuid, timestamptz)
from public, anon, authenticated;

grant execute
on function public.sync_national_championship_registrations(uuid, timestamptz)
to service_role;

create or replace function public.process_due_national_championships(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_synced integer := 0;
  v_cancelled_without_field integer := 0;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    v_synced := v_synced
      + public.sync_national_championship_registrations(v_season_id, p_now);
  end loop;

  -- Une épreuve sans aucun partant, équipe ou agent libre, est annulée dès
  -- son horaire de départ. Elle ne produit ni classement ni titre national.
  update public.stages as stage
  set status = 'cancelled'
  from public.race_editions as edition,
       public.races as race
  where edition.id = stage.race_edition_id
    and race.id = edition.race_id
    and race.competition_type in ('national_road', 'national_time_trial')
    and edition.status not in ('completed', 'cancelled')
    and stage.status not in ('completed', 'cancelled')
    and stage.departure_at <= p_now
    and not exists (
      select 1
      from public.race_registrations as registration
      join public.race_rosters as roster
        on roster.race_registration_id = registration.id
       and roster.status in ('selected', 'confirmed')
      where registration.race_edition_id = edition.id
        and registration.status = 'accepted'
    );

  get diagnostics v_cancelled_without_field = row_count;

  update public.race_editions as edition
  set status = 'cancelled'
  from public.races as race
  where race.id = edition.race_id
    and race.competition_type in ('national_road', 'national_time_trial')
    and edition.status not in ('completed', 'cancelled')
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = edition.id
        and stage.status = 'cancelled'
        and stage.departure_at <= p_now
    )
    and not exists (
      select 1
      from public.race_registrations as registration
      join public.race_rosters as roster
        on roster.race_registration_id = registration.id
       and roster.status in ('selected', 'confirmed')
      where registration.race_edition_id = edition.id
        and registration.status = 'accepted'
    );

  return v_synced + v_cancelled_without_field;
end;
$$;

revoke all
on function public.process_due_national_championships(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_national_championships(timestamptz)
to service_role;

-- Répare aussi les épreuves vides qu'une ancienne version aurait clôturées
-- sans classement au lieu de les annuler.
update public.stages as stage
set status = 'cancelled'
from public.race_editions as edition,
     public.races as race
where edition.id = stage.race_edition_id
  and race.id = edition.race_id
  and race.competition_type in ('national_road', 'national_time_trial')
  and stage.status = 'completed'
  and not exists (
    select 1
    from public.race_results as result
    where result.race_edition_id = edition.id
  )
  and not exists (
    select 1
    from public.race_registrations as registration
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.status in ('selected', 'confirmed')
    where registration.race_edition_id = edition.id
      and registration.status = 'accepted'
  );

update public.race_editions as edition
set status = 'cancelled'
from public.races as race
where race.id = edition.race_id
  and race.competition_type in ('national_road', 'national_time_trial')
  and edition.status = 'completed'
  and not exists (
    select 1
    from public.race_results as result
    where result.race_edition_id = edition.id
  )
  and exists (
    select 1
    from public.stages as stage
    where stage.race_edition_id = edition.id
      and stage.status = 'cancelled'
  );

create or replace function public.save_current_team_national_championship_selections(
  p_selections jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team_id uuid;
  v_team_season_id uuid;
  v_season_id uuid;
  v_managed_rider_count integer;
  v_expected_entry_count integer;
  v_found_entry_count integer := 0;
  v_changed integer := 0;
  v_entry record;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour gérer les inscriptions aux CN.';
  end if;

  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then
    raise exception using
      errcode = 'P0001',
      message = 'La grille d inscriptions transmise est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_selections) as entry(value)
    where coalesce(entry.value ->> 'rider_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'road', '') not in ('true', 'false')
      or coalesce(entry.value ->> 'time_trial', '') not in ('true', 'false')
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Une ligne de la grille d inscriptions est invalide.';
  end if;

  select
    assignment.team_id,
    team_season.id,
    season.id
  into
    v_team_id,
    v_team_season_id,
    v_season_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.status in ('planned', 'active')
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  limit 1;

  if v_team_season_id is null then
    raise exception using
      errcode = '42501',
      message = 'Aucune équipe active ne peut être gérée pour cette saison.';
  end if;

  select count(distinct rider.id)::integer
  into v_managed_rider_count
  from public.rider_contracts as contract
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  where contract.team_id = v_team_id
    and contract.status = 'active';

  if jsonb_array_length(p_selections) <> v_managed_rider_count
    or jsonb_array_length(p_selections) <> (
      select count(distinct (entry.value ->> 'rider_id')::uuid)
      from jsonb_array_elements(p_selections) as entry(value)
    )
    or exists (
      select 1
      from jsonb_array_elements(p_selections) as entry(value)
      where not exists (
        select 1
        from public.rider_contracts as contract
        join public.riders as rider
          on rider.id = contract.rider_id
         and rider.status = 'active'
        where contract.team_id = v_team_id
          and contract.status = 'active'
          and rider.id = (entry.value ->> 'rider_id')::uuid
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'La grille ne correspond plus à l effectif actif. Rechargez la page.';
  end if;

  v_expected_entry_count := v_managed_rider_count * 2;

  for v_entry in
    select
      (entry.value ->> 'rider_id')::uuid as rider_id,
      discipline.competition_type,
      discipline.is_selected,
      edition.id as race_edition_id,
      stage.departure_at
    from jsonb_array_elements(p_selections) as entry(value)
    cross join lateral (
      values
        ('national_road'::text, (entry.value ->> 'road')::boolean),
        ('national_time_trial'::text, (entry.value ->> 'time_trial')::boolean)
    ) as discipline(competition_type, is_selected)
    join public.riders as rider
      on rider.id = (entry.value ->> 'rider_id')::uuid
    join public.races as race
      on race.country_id = rider.country_id
     and race.competition_type = discipline.competition_type
    join public.race_editions as edition
      on edition.race_id = race.id
     and edition.season_id = v_season_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
     and stage.stage_number = 1
    order by rider.id, discipline.competition_type
  loop
    v_found_entry_count := v_found_entry_count + 1;

    -- Une discipline déjà partie reste figée ; l'autre colonne peut encore
    -- être enregistrée jusqu'à son propre départ en J8.
    if now() >= v_entry.departure_at then
      continue;
    end if;

    insert into public.national_championship_rider_preferences (
      race_edition_id,
      rider_id,
      team_season_id,
      is_selected,
      updated_at
    )
    values (
      v_entry.race_edition_id,
      v_entry.rider_id,
      v_team_season_id,
      v_entry.is_selected,
      now()
    )
    on conflict (race_edition_id, rider_id)
    do update set
      team_season_id = excluded.team_season_id,
      is_selected = excluded.is_selected,
      updated_at = excluded.updated_at;

    if v_entry.is_selected then
      delete from public.national_championship_rider_withdrawals
      where race_edition_id = v_entry.race_edition_id
        and rider_id = v_entry.rider_id;
    else
      insert into public.national_championship_rider_withdrawals (
        race_edition_id,
        rider_id,
        team_season_id,
        withdrawn_at
      )
      values (
        v_entry.race_edition_id,
        v_entry.rider_id,
        v_team_season_id,
        now()
      )
      on conflict (race_edition_id, rider_id)
      do update set
        team_season_id = excluded.team_season_id,
        withdrawn_at = excluded.withdrawn_at;
    end if;

    v_changed := v_changed + 1;
  end loop;

  if v_found_entry_count <> v_expected_entry_count then
    raise exception using
      errcode = 'P0002',
      message = 'Un championnat national est absent pour un pays de l effectif.';
  end if;

  perform public.sync_national_championship_registrations(v_season_id, now());
  return v_changed;
end;
$$;

revoke all
on function public.save_current_team_national_championship_selections(jsonb)
from public, anon;

grant execute
on function public.save_current_team_national_championship_selections(jsonb)
to authenticated, service_role;

-- ============================================================
-- COUVERTURE COMPLÈTE DES PAYS ET CRÉNEAUX UNIQUES
-- La fonction de provisionnement centrale impose déjà J8, 14 h pour le CLM
-- et 18 h pour la route. Elle est désormais appelée pour chaque pays actif,
-- même s'il ne compte encore aucun coureur.
-- ============================================================

create or replace function public.ensure_active_season_national_championships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country_id uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  for v_country_id in
    select country.id
    from public.countries as country
    where country.is_active = true
    order by country.iso_alpha2
  loop
    perform public.ensure_national_championship_editions(v_country_id, new.id);
  end loop;

  perform public.sync_national_championship_registrations(new.id, now());
  return new;
end;
$$;

create or replace function public.ensure_country_national_championships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  if new.is_active <> true then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_active = true then
      return new;
    end if;
  end if;

  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status in ('active', 'planned')
  loop
    perform public.ensure_national_championship_editions(new.id, v_season_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists ensure_country_national_championships
on public.countries;

create trigger ensure_country_national_championships
after insert or update of is_active
on public.countries
for each row
execute function public.ensure_country_national_championships();

do $$
declare
  v_season_id uuid;
  v_country_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status in ('active', 'planned')
  loop
    for v_country_id in
      select country.id
      from public.countries as country
      where country.is_active = true
      order by country.iso_alpha2
    loop
      perform public.ensure_national_championship_editions(
        v_country_id,
        v_season_id
      );
    end loop;

    if exists (
      select 1
      from public.seasons as season
      where season.id = v_season_id
        and season.status = 'active'
    ) then
      perform public.sync_national_championship_registrations(
        v_season_id,
        now()
      );
    end if;
  end loop;
end;
$$;

update public.season_events
set
  title = 'Championnats nationaux',
  description = 'Une seule grille regroupe le CN contre-la-montre à 14 h et le CN en ligne à 18 h pour tous les coureurs de l’effectif.',
  href = '/jeu/championnats-nationaux'
where event_type in (
  'national_time_trial_championships',
  'national_road_championships'
);

commit;
