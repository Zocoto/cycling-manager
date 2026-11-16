begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

create table public.fan_club_international_trip_allocations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  award_id uuid not null references public.national_federation_hosting_awards(id) on delete restrict,
  race_edition_id uuid references public.race_editions(id) on delete restrict,
  development_race_edition_id uuid references public.development_race_editions(id) on delete restrict,
  rider_ids uuid[] not null check (cardinality(rider_ids) > 0),
  model_code text not null check (model_code in ('regional', 'grand-tourisme', 'double-etage')),
  car_count integer not null check (car_count between 1 and 30),
  mobilized_supporters integer not null check (mobilized_supporters between 1 and 2640),
  trip_cost numeric(14, 2) not null check (trip_cost > 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(race_edition_id, development_race_edition_id) = 1)
);

create unique index fan_club_international_trips_pro_uidx
  on public.fan_club_international_trip_allocations (team_id, race_edition_id) where race_edition_id is not null;
create unique index fan_club_international_trips_junior_uidx
  on public.fan_club_international_trip_allocations (team_id, development_race_edition_id) where development_race_edition_id is not null;
create index fan_club_international_trips_award_idx
  on public.fan_club_international_trip_allocations (award_id);
create index fan_club_international_trips_team_history_idx
  on public.fan_club_international_trip_allocations (team_id, created_at desc);

alter table public.fan_club_international_trip_allocations enable row level security;
revoke all on table public.fan_club_international_trip_allocations from public, anon, authenticated;

create function private.get_international_fan_club_trip_context()
returns table (team_id uuid, season_id uuid, team_season_id uuid, season_day_id uuid, day_number integer)
language sql stable set search_path = '' as $$
  select assignment.team_id, season.id, team_season.id, day.id, day.day_number::integer
  from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.team_infrastructures headquarters on headquarters.team_id = assignment.team_id
    and headquarters.infrastructure_code = 'fan_club_headquarters' and headquarters.level > 0
  join public.seasons season on season.status = 'active' and season.game_year >= 6
  join public.team_seasons team_season on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  join public.season_days day on day.season_id = season.id and day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;
$$;

create function private.get_international_fan_club_departures(
  p_team_id uuid, p_season_id uuid, p_current_day integer, p_now timestamptz
)
returns table (award_id uuid, edition_id uuid, is_junior boolean, edition_name text, day_number integer, distance_km numeric, rider_ids uuid[])
language sql stable set search_path = '' as $$
  with awarded_editions as (
    select award.id as award_id, award.country_id, edition.*
    from public.seasons season
    join public.national_federation_hosting_awards award on award.target_game_year = season.game_year
      and award.status = 'scheduled' and award.economics_version = 2
    cross join lateral private.get_federation_hosting_editions(season.id, award.event_type, award.continent_code) edition
    where season.id = p_season_id and edition.edition_status not in ('running', 'completed', 'cancelled')
  )
  select hosted.award_id, edition.id, false, edition.display_name, route.day_number, route.distance_km, selected.rider_ids
  from awarded_editions hosted
  join public.race_editions edition on not hosted.is_junior and edition.id = hosted.edition_id
    and edition.host_country_id = hosted.country_id and not edition.is_neutral_host
  cross join lateral (
    select sum(stage.distance_km) as distance_km, min(stage.departure_at) as departure_at,
      min(day.day_number)::integer as day_number
    from public.stages stage
    join public.season_days day on day.id = stage.season_day_id
    where stage.race_edition_id = edition.id
  ) route
  cross join lateral (
    select array_agg(distinct member.professional_rider_id) as rider_ids
    from public.national_federation_selection_race_links link
    join public.race_registrations registration on registration.id = link.race_registration_id
      and registration.status = 'accepted'
    join public.national_federation_selection_members member on member.selection_list_id = link.selection_list_id
      and member.owner_team_id = p_team_id and member.response_status = 'confirmed'
    join public.race_rosters roster on roster.race_registration_id = registration.id
      and roster.rider_id = member.professional_rider_id and roster.status in ('selected', 'confirmed')
    where link.race_edition_id = edition.id and exists (
      select 1 from public.rider_contracts contract
      where contract.rider_id = member.professional_rider_id and contract.team_id = p_team_id and contract.status = 'active'
    )
  ) selected
  where route.day_number >= p_current_day and route.departure_at > p_now
    and route.distance_km > 0 and cardinality(selected.rider_ids) > 0

  union all

  select hosted.award_id, edition.id, true, edition.name, edition.start_day_number::integer, route.distance_km, selected.rider_ids
  from awarded_editions hosted
  join public.development_race_editions edition on hosted.is_junior and edition.id = hosted.edition_id
    and edition.host_country_id = hosted.country_id and not edition.is_neutral_host
  join public.season_days day on day.season_id = edition.season_id and day.day_number = edition.start_day_number
  cross join lateral (
    select sum(stage.distance_km) as distance_km
    from public.development_race_stages stage where stage.race_edition_id = edition.id
  ) route
  cross join lateral (
    select array_agg(distinct member.junior_rider_id) as rider_ids
    from public.national_federation_junior_race_registrations registration
    join public.national_federation_selection_members member on member.selection_list_id = registration.selection_list_id
      and member.owner_team_id = p_team_id and member.response_status = 'confirmed'
    join public.national_federation_junior_race_registration_riders roster on roster.registration_id = registration.id
      and roster.academy_rider_id = member.junior_rider_id
    join public.youth_academy_riders rider on rider.id = member.junior_rider_id and rider.team_id = p_team_id
    where registration.race_edition_id = edition.id and registration.status = 'registered'
  ) selected
  where edition.start_day_number > p_current_day and day.calendar_date > (p_now at time zone 'Europe/Paris')::date
    and route.distance_km > 0 and cardinality(selected.rider_ids) > 0;
$$;

create function public.get_current_team_international_fan_club_trips()
returns table (
  id uuid, edition_id uuid, is_junior boolean, edition_name text, day_number integer, distance_km numeric,
  edition_status text, model_code text, car_count integer, mobilized_supporters integer, trip_cost numeric
)
language sql stable security definer set search_path = '' set statement_timeout = '4s' as $$
  with context as materialized (select * from private.get_international_fan_club_trip_context()),
  booked as materialized (
    select trip.* from context
    join public.fan_club_international_trip_allocations trip using (team_id)
    order by trip.created_at desc, trip.id
    limit 30
  )
  select null::uuid, departure.edition_id, departure.is_junior, departure.edition_name,
    departure.day_number, departure.distance_km, 'available'::text, null::text, null::integer, null::integer, null::numeric
  from context
  cross join lateral private.get_international_fan_club_departures(context.team_id, context.season_id, context.day_number, statement_timestamp()) departure
  where not exists (
    select 1 from public.fan_club_international_trip_allocations existing
    where existing.team_id = context.team_id and (
      (departure.is_junior and existing.development_race_edition_id = departure.edition_id)
      or (not departure.is_junior and existing.race_edition_id = departure.edition_id)
    )
  )
  union all
  select trip.id, coalesce(trip.race_edition_id, trip.development_race_edition_id),
    trip.development_race_edition_id is not null, coalesce(edition.display_name, junior.name),
    junior.start_day_number::integer, null::numeric, coalesce(edition.status, junior.status),
    trip.model_code, trip.car_count, trip.mobilized_supporters, trip.trip_cost
  from booked trip
  left join public.race_editions edition on edition.id = trip.race_edition_id
  left join public.development_race_editions junior on junior.id = trip.development_race_edition_id;
$$;

create function public.charter_current_team_international_fan_club_cars(
  p_edition_id uuid, p_is_junior boolean, p_model_code text, p_car_count integer
)
returns uuid
language plpgsql volatile security definer set search_path = '' set statement_timeout = '5s' as $$
declare
  v_context record;
  v_trip public.fan_club_international_trip_allocations%rowtype;
  v_departure record;
  v_capacity integer;
  v_capacity_multiplier numeric;
  v_operating_cost numeric;
  v_owned integer;
  v_supporters integer;
  v_seats integer;
  v_cash numeric;
  v_cost numeric(14,2);
begin
  if p_edition_id is null or p_is_junior is null or p_car_count is null or p_car_count not between 1 and 30 then
    raise exception 'Choisissez une épreuve et un nombre de cars valide.';
  end if;
  select model.capacity, model.operating_cost into v_capacity, v_operating_cost
  from (values ('regional', 40, 1.35), ('grand-tourisme', 55, 1.75), ('double-etage', 80, 2.40))
    as model(code, capacity, operating_cost)
  where model.code = p_model_code;
  if not found then raise exception 'Ce modèle de car n’existe pas.'; end if;

  select * into v_context from private.get_international_fan_club_trip_context();
  if not found then raise exception 'Votre Fan Club ne peut pas organiser ce déplacement.'; end if;
  perform public.settle_current_team_finances();

  select quantity into v_owned from public.fan_club_fleet
  where team_id = v_context.team_id and model_code = p_model_code for update;
  select cash_balance into v_cash from public.team_seasons where id = v_context.team_season_id for update;

  select trip.* into v_trip from public.fan_club_international_trip_allocations trip
  where trip.team_id = v_context.team_id and trip.season_id = v_context.season_id
    and case when p_is_junior then trip.development_race_edition_id = p_edition_id else trip.race_edition_id = p_edition_id end;
  if found then
    if v_trip.model_code = p_model_code and v_trip.car_count = p_car_count then return v_trip.id; end if;
    raise exception 'Votre Fan Club a déjà confirmé un déplacement pour cette épreuve.';
  end if;
  if coalesce(v_owned, 0) < p_car_count then raise exception 'Votre Fan Club ne dispose pas de suffisamment de cars de ce modèle.'; end if;

  select * into v_departure
  from private.get_international_fan_club_departures(v_context.team_id, v_context.season_id, v_context.day_number, clock_timestamp()) departure
  where departure.edition_id = p_edition_id and departure.is_junior = p_is_junior;
  if not found then raise exception 'Cette épreuve n’est plus disponible pour un déplacement.'; end if;

  select supporter_count into v_supporters from public.fan_club_profiles where team_id = v_context.team_id;
  select case when specialization.active_specialization_code = 'loyalty_program'
    then case headquarters.level when 3 then 1.06 when 4 then 1.08 when 5 then 1.10 else 1 end else 1 end
  into v_capacity_multiplier
  from public.team_infrastructures headquarters
  left join public.team_infrastructure_specializations specialization using (team_id, infrastructure_code)
  where headquarters.team_id = v_context.team_id and headquarters.infrastructure_code = 'fan_club_headquarters';
  v_seats := least(floor(coalesce(v_supporters, 0) * 0.4)::integer, round(v_capacity * coalesce(v_capacity_multiplier, 1))::integer * p_car_count);
  if v_seats <= 0 then raise exception 'Aucun supporter ne peut effectuer ce déplacement.'; end if;
  v_cost := round(p_car_count * (v_departure.distance_km * 2 * v_operating_cost + 250), 2);
  if coalesce(v_cash, 0) < v_cost then raise exception 'Trésorerie insuffisante pour ce déplacement.'; end if;

  insert into public.fan_club_international_trip_allocations (
    team_id, season_id, award_id, race_edition_id, development_race_edition_id, rider_ids,
    model_code, car_count, mobilized_supporters, trip_cost
  ) values (
    v_context.team_id, v_context.season_id, v_departure.award_id,
    case when not p_is_junior then p_edition_id end, case when p_is_junior then p_edition_id end,
    v_departure.rider_ids, p_model_code, p_car_count, v_seats, v_cost
  ) returning * into v_trip;

  update public.team_seasons set cash_balance = cash_balance - v_cost where id = v_context.team_season_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status, description, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.season_day_id, v_context.day_number, -v_cost, 'other', 'posted',
    'Fan Club — affrètement international', 'fan-club:international-trip:' || v_trip.id, now()
  );
  return v_trip.id;
end;
$$;

create function private.get_federation_hosting_charter_totals(p_award_id uuid)
returns table (car_count integer, seat_count integer)
language sql stable set search_path = '' as $$
  select coalesce(sum(trip.car_count), 0)::integer, coalesce(sum(trip.mobilized_supporters), 0)::integer
  from public.fan_club_international_trip_allocations trip
  where trip.award_id = p_award_id and (
    exists (
      select 1 from public.race_editions edition
      join public.stages stage on stage.race_edition_id = edition.id and stage.status = 'completed'
      join public.seasons season on season.id = trip.season_id
      join public.season_days day on day.id = stage.season_day_id
      join public.stage_results result on result.stage_id = stage.id and result.status <> 'did_not_start'
      join public.race_rosters roster on roster.id = result.race_roster_id and roster.rider_id = any(trip.rider_ids)
      -- Resolve the club at the actual start even when a rider has transferred
      -- between the booking and the organized competition.
      join lateral (
        select contract.team_id
        from public.rider_contracts contract
        join public.seasons first_season on first_season.id = contract.start_season_id
        join public.seasons last_season on last_season.id = coalesce(contract.left_season_id, contract.end_season_id)
        where contract.rider_id = roster.rider_id and contract.status in ('active', 'completed', 'terminated')
          and coalesce(contract.signed_at, contract.created_at) <= stage.departure_at
          and (first_season.game_year, coalesce(contract.joined_day_number, 1)) <= (season.game_year, day.day_number)
          and (last_season.game_year, coalesce(contract.left_day_number, 28)) >= (season.game_year, day.day_number)
        order by first_season.game_year desc, coalesce(contract.joined_day_number, 1) desc,
          coalesce(contract.signed_at, contract.created_at) desc, contract.id
        limit 1
      ) affiliation on affiliation.team_id = trip.team_id
      where edition.id = trip.race_edition_id and edition.status = 'completed'
    ) or exists (
      select 1 from public.development_race_editions edition
      join public.development_race_results result on result.race_edition_id = edition.id
        and result.result_scope = 'stage' and result.academy_rider_id = any(trip.rider_ids)
      left join public.development_teams team on team.id = result.development_team_id
      join public.youth_academy_riders rider on rider.id = result.academy_rider_id
      where edition.id = trip.development_race_edition_id and edition.status = 'completed'
        and coalesce(team.team_id, rider.team_id) = trip.team_id
    )
  );
$$;

revoke all on function private.get_international_fan_club_trip_context() from public, anon, authenticated;
revoke all on function private.get_international_fan_club_departures(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function private.get_federation_hosting_charter_totals(uuid) from public, anon, authenticated;
revoke all on function public.get_current_team_international_fan_club_trips() from public, anon, authenticated;
revoke all on function public.charter_current_team_international_fan_club_cars(uuid, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.get_current_team_international_fan_club_trips() to authenticated;
grant execute on function public.charter_current_team_international_fan_club_cars(uuid, boolean, text, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
