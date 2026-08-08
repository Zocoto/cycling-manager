begin;

-- ============================================================
-- CHAMPIONNATS NATIONAUX AUTOMATIQUES
-- Les 200 premiers coureurs du classement mondial sont engagés dans les deux
-- disciplines de leur pays. Le DS ne compose plus de sélection : il peut
-- uniquement retirer, jusqu'au départ, un coureur automatiquement retenu.
-- ============================================================

create table public.national_championship_rider_withdrawals (
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  rider_id uuid not null
    references public.riders(id)
    on delete cascade,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  withdrawn_at timestamptz not null default now(),
  primary key (race_edition_id, rider_id)
);

create index national_championship_withdrawals_team_idx
  on public.national_championship_rider_withdrawals (
    team_season_id,
    withdrawn_at desc
  );

alter table public.national_championship_rider_withdrawals
  enable row level security;

create policy national_championship_withdrawals_select_managed
on public.national_championship_rider_withdrawals
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons as team_season
    where team_season.id = national_championship_rider_withdrawals.team_season_id
      and public.current_user_manages_team(team_season.team_id)
  )
);

grant select
on table public.national_championship_rider_withdrawals
to authenticated;

grant all privileges
on table public.national_championship_rider_withdrawals
to service_role;

create table public.national_championship_notifications (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  notification_type text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint national_championship_notifications_type_allowed
    check (notification_type in ('selection', 'results')),
  constraint national_championship_notifications_text_present
    check (btrim(title) <> '' and btrim(message) <> ''),
  constraint national_championship_notifications_source_unique
    unique (team_season_id, race_edition_id, notification_type)
);

create index national_championship_notifications_team_unread_idx
  on public.national_championship_notifications (
    team_season_id,
    read_at,
    created_at desc
  );

alter table public.national_championship_notifications
  enable row level security;

create policy national_championship_notifications_select_managed
on public.national_championship_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.team_seasons as team_season
    where team_season.id = national_championship_notifications.team_season_id
      and public.current_user_manages_team(team_season.team_id)
  )
);

grant select
on table public.national_championship_notifications
to authenticated;

grant all privileges
on table public.national_championship_notifications
to service_role;

-- Une seule inscription neutre rassemble les coureurs libres de chaque CN.
create unique index race_registrations_national_free_agents_unique_idx
  on public.race_registrations (race_edition_id)
  where team_season_id is null
    and historical_team_name = 'Coureurs libres';

-- Toutes les nations courent en J8 : CLM à 14 h, route à 18 h. La politique
-- fermée empêche l'interface générique de
-- présenter une inscription manuelle.
create or replace function public.ensure_national_championship_editions(
  p_country_id uuid,
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_category_id uuid;
  v_kind text;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_day_number integer;
  v_departure_time time;
  v_day_slot text;
  v_day_id uuid;
  v_day_date date;
  v_departure_at timestamptz;
  v_slug text;
  v_name text;
  v_short_name text;
  v_profile_type text;
  v_stage_type text;
  v_distance numeric(6, 2);
begin
  select country.*
  into v_country
  from public.countries as country
  where country.id = p_country_id
    and country.is_active = true;

  if not found then
    return;
  end if;

  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found then
    return;
  end if;

  select category.id
  into v_category_id
  from public.race_categories as category
  where category.code = 'national'
    and category.is_active = true;

  if v_category_id is null then
    raise exception 'La catégorie Nationale est introuvable.';
  end if;

  foreach v_kind in array array['national_time_trial', 'national_road']
  loop
    if v_kind = 'national_time_trial' then
      v_day_number := 8;
      v_departure_time := time '14:00';
      v_day_slot := 'early';
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-clm';
      v_name := 'Championnat de ' || v_country.name || ' - Contre-la-montre';
      v_short_name := 'CN ' || v_country.iso_alpha2 || ' CLM';
      v_profile_type := 'time_trial';
      v_stage_type := 'individual_time_trial';
      v_distance := 38;
    else
      v_day_number := 8;
      v_departure_time := time '18:00';
      v_day_slot := 'late';
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-route';
      v_name := 'Championnat de ' || v_country.name || ' - Route';
      v_short_name := 'CN ' || v_country.iso_alpha2;
      v_profile_type := 'hilly';
      v_stage_type := 'road';
      v_distance := 178;
    end if;

    select day.id, day.calendar_date
    into v_day_id, v_day_date
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number = v_day_number;

    if v_day_id is null then
      raise exception 'La journée J% est absente de la saison %.', v_day_number, v_season.name;
    end if;

    v_departure_at := (
      v_day_date::timestamp + v_departure_time
    ) at time zone 'Europe/Paris';

    insert into public.races (
      country_id,
      name,
      short_name,
      race_format,
      status,
      slug,
      competition_type
    )
    values (
      v_country.id,
      v_name,
      v_short_name,
      'one_day',
      'active',
      v_slug,
      v_kind
    )
    on conflict (slug)
    do update set
      country_id = excluded.country_id,
      name = excluded.name,
      short_name = excluded.short_name,
      race_format = excluded.race_format,
      status = excluded.status,
      competition_type = excluded.competition_type
    returning id into v_race_id;

    insert into public.race_editions (
      race_id,
      season_id,
      race_category_id,
      edition_number,
      display_name,
      status,
      registration_closes_at,
      withdrawal_closes_at,
      minimum_reputation,
      registration_policy,
      field_limit
    )
    values (
      v_race_id,
      v_season.id,
      v_category_id,
      greatest(1, v_season.game_year),
      v_name,
      'registration_open',
      v_departure_at,
      v_departure_at,
      0,
      'closed',
      200
    )
    on conflict (race_id, season_id)
    do update set
      race_category_id = excluded.race_category_id,
      edition_number = excluded.edition_number,
      display_name = excluded.display_name,
      registration_closes_at = excluded.registration_closes_at,
      withdrawal_closes_at = excluded.withdrawal_closes_at,
      minimum_reputation = excluded.minimum_reputation,
      registration_policy = excluded.registration_policy,
      field_limit = excluded.field_limit
    returning id into v_edition_id;

    insert into public.stages (
      race_edition_id,
      season_day_id,
      stage_number,
      name,
      stage_type,
      distance_km,
      status,
      departure_at,
      profile_type,
      day_slot
    )
    values (
      v_edition_id,
      v_day_id,
      1,
      v_name,
      v_stage_type,
      v_distance,
      'planned',
      v_departure_at,
      v_profile_type,
      v_day_slot
    )
    on conflict (race_edition_id, stage_number)
    do update set
      season_day_id = excluded.season_day_id,
      name = excluded.name,
      stage_type = excluded.stage_type,
      distance_km = excluded.distance_km,
      departure_at = excluded.departure_at,
      profile_type = excluded.profile_type,
      day_slot = excluded.day_slot
    returning id into v_stage_id;

    if v_kind = 'national_time_trial' then
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 3, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 4, 8, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 4;
    else
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 25, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 12, 'climb', 'asphalt', 4.5),
        (v_stage_id, 3, 10, 'descent', 'asphalt', -4),
        (v_stage_id, 4, 30, 'flat', 'asphalt', 0),
        (v_stage_id, 5, 8, 'climb', 'asphalt', 6.5),
        (v_stage_id, 6, 8, 'descent', 'asphalt', -6),
        (v_stage_id, 7, 35, 'flat', 'asphalt', 0),
        (v_stage_id, 8, 12, 'climb', 'asphalt', 5),
        (v_stage_id, 9, 38, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 9;
    end if;
  end loop;
end;
$$;

revoke all
on function public.ensure_national_championship_editions(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_national_championship_editions(uuid, uuid)
to service_role;

comment on function public.ensure_national_championship_editions(uuid, uuid)
  is 'Provisionne tous les CN en J8 : CLM à 14 h et route à 18 h, sans inscription manuelle.';

-- Recale uniquement les CN à venir afin de ne jamais réécrire une épreuve
-- déjà disputée ou en cours de consolidation.
with upcoming_national_editions as (
  select
    edition.id as edition_id,
    stage.id as stage_id,
    target_day.id as season_day_id,
    (
      target_day.calendar_date::timestamp
      + case race.competition_type
          when 'national_time_trial' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris' as departure_at,
    case race.competition_type
      when 'national_time_trial' then 'early'
      else 'late'
    end as day_slot
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.season_days as target_day
    on target_day.season_id = edition.season_id
   and target_day.day_number = 8
  where race.competition_type in ('national_road', 'national_time_trial')
    and edition.status not in ('completed', 'cancelled')
    and stage.departure_at > now()
)
update public.stages as stage
set
  season_day_id = target.season_day_id,
  departure_at = target.departure_at,
  day_slot = target.day_slot
from upcoming_national_editions as target
where stage.id = target.stage_id;

with upcoming_national_editions as (
  select
    edition.id as edition_id,
    (
      target_day.calendar_date::timestamp
      + case race.competition_type
          when 'national_time_trial' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris' as departure_at
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.season_days as target_day
    on target_day.season_id = edition.season_id
   and target_day.day_number = 8
  where race.competition_type in ('national_road', 'national_time_trial')
    and edition.status not in ('completed', 'cancelled')
    and stage.departure_at > now()
)
update public.race_editions as edition
set
  registration_policy = 'closed',
  registration_closes_at = target.departure_at,
  withdrawal_closes_at = target.departure_at,
  field_limit = 200
from upcoming_national_editions as target
where edition.id = target.edition_id;

create or replace function public.get_national_championship_world_top_200(
  p_season_id uuid
)
returns table (
  rider_id uuid,
  country_id uuid,
  team_season_id uuid,
  world_rank integer,
  uci_points integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      rider.id as rider_id,
      rider.country_id,
      ownership.team_season_id,
      row_number() over (
        order by
          coalesce(summary.points, 0) desc,
          (
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
          ) desc,
          rider.last_name,
          rider.first_name,
          rider.id
      )::integer as world_rank,
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
      and rider.country_id is not null
  )
  select
    ranked.rider_id,
    ranked.country_id,
    ranked.team_season_id,
    ranked.world_rank,
    ranked.uci_points
  from ranked
  where ranked.world_rank <= 200
  order by ranked.world_rank;
$$;

revoke all
on function public.get_national_championship_world_top_200(uuid)
from public, anon, authenticated;

grant execute
on function public.get_national_championship_world_top_200(uuid)
to service_role;

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
  -- Retire les anciennes sélections manuelles, les coureurs sortis du top 200
  -- et tous les retraits explicites. Un retrait utilisateur reste donc durable
  -- même si la synchronisation est rejouée par le cron.
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
    and (
      exists (
        select 1
        from public.national_championship_rider_withdrawals as withdrawal
        where withdrawal.race_edition_id = edition.id
          and withdrawal.rider_id = roster.rider_id
      )
      or not exists (
        select 1
        from public.get_national_championship_world_top_200(p_season_id) as candidate
        where candidate.rider_id = roster.rider_id
          and candidate.country_id = race.country_id
      )
    );

  for v_entry in
    select
      edition.id as race_edition_id,
      candidate.rider_id,
      candidate.team_season_id,
      candidate.world_rank
    from public.get_national_championship_world_top_200(p_season_id) as candidate
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
    where not exists (
      select 1
      from public.national_championship_rider_withdrawals as withdrawal
      where withdrawal.race_edition_id = edition.id
        and withdrawal.rider_id = candidate.rider_id
    )
    order by edition.id, candidate.world_rank
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
      '%s : %s. Les engagements sont automatiques ; vous pouvez retirer individuellement un coureur jusqu’au départ.',
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
  v_resolved_without_field integer := 0;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    v_synced := v_synced
      + public.sync_national_championship_registrations(v_season_id, p_now);
  end loop;

  -- Une nation sans représentant dans le top 200 ne doit jamais rester en
  -- attente. Dès son horaire passé, l'épreuve est clôturée sans classement.
  update public.stages as stage
  set status = 'completed'
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

  get diagnostics v_resolved_without_field = row_count;

  update public.race_editions as edition
  set status = 'completed'
  from public.races as race
  where race.id = edition.race_id
    and race.competition_type in ('national_road', 'national_time_trial')
    and edition.status not in ('completed', 'cancelled')
    and exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = edition.id
        and stage.status = 'completed'
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

  return v_synced + v_resolved_without_field;
end;
$$;

revoke all
on function public.process_due_national_championships(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_national_championships(timestamptz)
to service_role;

-- L'ancien RPC de composition reste le point d'entrée de toutes les fiches de
-- course. Il délègue les courses ordinaires et refuse explicitement les CN.
create or replace function public.save_current_team_competition_roster_with_roles(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registration_status text,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition_type text;
begin
  select race.competition_type
  into v_competition_type
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if v_competition_type is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cette édition de course est introuvable.';
  end if;

  if v_competition_type in (
    'national_road',
    'national_time_trial'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Les engagements aux championnats sont automatiques. Consultez le menu CN pour retirer un coureur.';
  end if;

  return query
  select saved.*
  from public.save_current_team_race_roster_with_roles(
    p_race_edition_id,
    p_roster
  ) as saved;
end;
$$;

revoke all
on function public.save_current_team_competition_roster_with_roles(uuid, jsonb)
from public, anon;

grant execute
on function public.save_current_team_competition_roster_with_roles(uuid, jsonb)
to authenticated;

create or replace function public.withdraw_current_team_national_championship_rider(
  p_race_edition_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team_season_id uuid;
  v_registration_id uuid;
  v_roster_id uuid;
  v_departure_at timestamptz;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour retirer un coureur.';
  end if;

  select
    team_season.id,
    registration.id,
    roster.id,
    stage.departure_at
  into
    v_team_season_id,
    v_registration_id,
    v_roster_id,
    v_departure_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
  join public.race_editions as edition
    on edition.id = p_race_edition_id
   and edition.season_id = team_season.season_id
   and edition.status not in ('completed', 'cancelled')
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in ('national_road', 'national_time_trial')
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.team_season_id = team_season.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.rider_id = p_rider_id
   and roster.status in ('selected', 'confirmed')
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  for update of roster;

  if v_roster_id is null then
    raise exception using
      errcode = '42501',
      message = 'Ce coureur ne fait pas partie de votre sélection automatique.';
  end if;

  if v_departure_at is null or now() >= v_departure_at then
    raise exception using
      errcode = 'P0001',
      message = 'Le championnat a déjà débuté : ce coureur ne peut plus être retiré.';
  end if;

  insert into public.national_championship_rider_withdrawals (
    race_edition_id,
    rider_id,
    team_season_id,
    withdrawn_at
  )
  values (
    p_race_edition_id,
    p_rider_id,
    v_team_season_id,
    now()
  )
  on conflict (race_edition_id, rider_id)
  do update set
    team_season_id = excluded.team_season_id,
    withdrawn_at = excluded.withdrawn_at;

  update public.race_rosters
  set status = 'withdrawn'
  where id = v_roster_id;
end;
$$;

revoke all
on function public.withdraw_current_team_national_championship_rider(uuid, uuid)
from public, anon;

grant execute
on function public.withdraw_current_team_national_championship_rider(uuid, uuid)
to authenticated, service_role;

-- Les RPC de startlist conservent leur signature UUID. Pour les libres, l'id
-- du pays sert d'identité visuelle neutre sans créer une fausse équipe.
create or replace function public.get_active_calendar_engaged_riders()
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    coalesce(team.id, race.country_id),
    coalesce(team_season.display_name, registration.historical_team_name),
    coalesce(team.amateur_jersey_primary_color, '#6B7280'),
    coalesce(team.amateur_jersey_secondary_color, '#E5E7EB'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.races as race on race.id = edition.race_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  left join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  left join lateral (
    select jsonb_agg(resolved.effect_payload order by resolved.slot_type) as effects
    from (
      select
        assignment.slot_type,
        (
          case
            when item.acquisition_channel = 'commercial' then item.effect_payload
            else partner_effect.effect_payload
          end
        ) || jsonb_build_object('_slotType', assignment.slot_type) as effect_payload
      from public.rider_equipment_assignments as assignment
      join public.equipment_catalog_items as item
        on item.id = assignment.equipment_item_id
       and item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
         and contract.team_id = team.id
         and contract.supplier_key = item.supplier_key
         and contract.status = 'active'
        join public.seasons as contract_start
          on contract_start.id = contract.start_season_id
        join public.seasons as contract_end
          on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      where assignment.rider_id = rider.id
        and (
          item.acquisition_channel = 'commercial'
          or partner_effect.effect_payload is not null
        )
    ) as resolved
  ) as equipment on true
  where edition.status <> 'cancelled'
  order by
    edition.id,
    coalesce(team_season.display_name, registration.historical_team_name),
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

create or replace function public.get_race_edition_engaged_riders(
  p_race_edition_id uuid
)
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select engaged.*
  from public.get_active_calendar_engaged_riders() as engaged
  where engaged.race_edition_id = p_race_edition_id
  order by engaged.team_name, engaged.rider_last_name, engaged.rider_first_name;
$$;

-- Les libres doivent produire un classement et un titre, mais aucun gain ne
-- peut être crédité à une équipe inexistante. Le service de règlement détecte
-- cette identité historique et ignore seulement l'étape économique.

create or replace function public.publish_national_championship_results_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition_type text;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select race.competition_type
  into v_competition_type
  from public.races as race
  where race.id = new.race_id;

  if v_competition_type not in ('national_road', 'national_time_trial') then
    return new;
  end if;

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
    new.id,
    'results',
    case v_competition_type
      when 'national_time_trial' then 'Résultats des CN contre-la-montre'
      else 'Résultats des CN sur route'
    end,
    format(
      '%s : %s.',
      country.name,
      string_agg(
        rider.first_name || ' ' || rider.last_name ||
          coalesce(' (' || result.final_rank::text || 'e)', ''),
        ', '
        order by result.final_rank nulls last, rider.last_name
      )
    ),
    now()
  from public.race_results as result
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.race_registrations as registration
    on registration.id = roster.race_registration_id
  join public.riders as rider on rider.id = roster.rider_id
  join public.races as race on race.id = new.race_id
  join public.countries as country on country.id = race.country_id
  where result.race_edition_id = new.id
    and registration.team_season_id is not null
  group by registration.team_season_id, country.name
  on conflict (team_season_id, race_edition_id, notification_type)
  do update set
    title = excluded.title,
    message = excluded.message,
    created_at = excluded.created_at,
    read_at = null;

  return new;
end;
$$;

create trigger publish_national_championship_results_notification
after update of status
on public.race_editions
for each row
execute function public.publish_national_championship_results_notification();

-- Les nouvelles saisons provisionnent tous les pays puis initialisent leurs
-- sélections en une seule passe.
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
    select distinct rider.country_id
    from public.riders as rider
    where rider.country_id is not null
  loop
    perform public.ensure_national_championship_editions(v_country_id, new.id);
  end loop;

  perform public.sync_national_championship_registrations(new.id, now());
  return new;
end;
$$;

-- Initialise les saisons déjà présentes. Seules les éditions futures sont
-- touchées par la synchronisation.
do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status in ('active', 'planned')
  loop
    perform public.sync_national_championship_registrations(v_season_id, now());
  end loop;
end;
$$;

update public.season_events as event
set season_day_id = target_day.id
from public.season_days as current_day
join public.season_days as target_day
  on target_day.season_id = current_day.season_id
 and target_day.day_number = 8
where current_day.id = event.season_day_id
  and event.event_type = 'national_road_championships';

update public.season_events
set description = 'Tous les CN sont résolus en J8. Les 200 meilleurs coureurs mondiaux sont inscrits automatiquement et le DS peut retirer ses coureurs jusqu’au départ.'
where event_type in (
  'national_time_trial_championships',
  'national_road_championships'
);

commit;
