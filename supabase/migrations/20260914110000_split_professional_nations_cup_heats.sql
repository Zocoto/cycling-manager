begin;

-- Every Nations Cup table is an independent race. A nation competes against
-- the other nations frozen in its division/group, never against all active
-- countries in one oversized startlist.
create table public.national_federation_nations_cup_heats (
  season_id uuid not null references public.seasons(id) on delete cascade,
  slot_key text not null
    references public.national_federation_selection_slots(slot_key)
    on delete cascade,
  pool_key text not null,
  division smallint not null,
  group_code text,
  race_id uuid not null references public.races(id) on delete cascade,
  race_edition_id uuid not null unique
    references public.race_editions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_id, slot_key, pool_key),
  constraint nations_cup_heats_division_valid check (division between 1 and 4),
  constraint nations_cup_heats_group_valid check (
    (division = 1 and group_code is null and pool_key = 'd1')
    or (division in (2, 3) and group_code in ('A', 'B')
      and pool_key = 'd' || division::text || '-' || lower(group_code))
    or (division = 4 and group_code in ('A', 'B', 'C')
      and pool_key = 'd4-' || lower(group_code))
  ),
  constraint nations_cup_heats_race_per_season_unique
    unique (season_id, race_id)
);

create index nations_cup_heats_pool_idx
  on public.national_federation_nations_cup_heats (
    season_id, division, group_code, slot_key
  );

alter table public.national_federation_nations_cup_heats
  enable row level security;
create policy nations_cup_heats_read_authenticated
on public.national_federation_nations_cup_heats
for select to authenticated
using (true);
revoke all on table public.national_federation_nations_cup_heats
  from public, anon, authenticated;
grant select on table public.national_federation_nations_cup_heats
  to authenticated;
grant all on table public.national_federation_nations_cup_heats
  to service_role;

create or replace function public.get_professional_nations_cup_profile_segments(
  p_slot_key text
)
returns table (
  segment_number smallint,
  distance_km numeric,
  terrain_type text,
  surface_type text,
  average_gradient_pct numeric
)
language sql
immutable
set search_path = ''
as $$
  select authored.segment_number, authored.distance_km,
    authored.terrain_type, authored.surface_type,
    authored.average_gradient_pct
  from (values
    ('nc-mountain', 1::smallint, 36::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-mountain', 2::smallint, 4::numeric, 'climb', 'asphalt', 5::numeric),
    ('nc-mountain', 3::smallint, 10::numeric, 'climb', 'asphalt', 10::numeric),
    ('nc-hills', 1::smallint, 10::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-hills', 2::smallint, 3::numeric, 'climb', 'asphalt', 7.5::numeric),
    ('nc-hills', 3::smallint, 3::numeric, 'descent', 'asphalt', -6::numeric),
    ('nc-hills', 4::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-hills', 5::smallint, 2::numeric, 'climb', 'asphalt', 10::numeric),
    ('nc-hills', 6::smallint, 2::numeric, 'descent', 'asphalt', -7::numeric),
    ('nc-hills', 7::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-hills', 8::smallint, 2::numeric, 'climb', 'asphalt', 11::numeric),
    ('nc-hills', 9::smallint, 2::numeric, 'descent', 'asphalt', -7::numeric),
    ('nc-hills', 10::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-hills', 11::smallint, 7::numeric, 'climb', 'asphalt', 7.5::numeric),
    ('nc-sprint', 1::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-sprint', 2::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-sprint', 3::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-sprint', 4::smallint, 10::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-cobbles', 1::smallint, 7::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-cobbles', 2::smallint, 7::numeric, 'flat', 'cobbles', 0::numeric),
    ('nc-cobbles', 3::smallint, 4::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-cobbles', 4::smallint, 6::numeric, 'climb', 'cobbles', 3::numeric),
    ('nc-cobbles', 5::smallint, 4::numeric, 'descent', 'asphalt', -3::numeric),
    ('nc-cobbles', 6::smallint, 8::numeric, 'flat', 'cobbles', 0::numeric),
    ('nc-cobbles', 7::smallint, 4::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-cobbles', 8::smallint, 7::numeric, 'climb', 'cobbles', 2.5::numeric),
    ('nc-cobbles', 9::smallint, 8::numeric, 'flat', 'cobbles', 0::numeric),
    ('nc-time-trial', 1::smallint, 6::numeric, 'flat', 'asphalt', 0::numeric),
    ('nc-time-trial', 2::smallint, 4::numeric, 'climb', 'asphalt', 4.5::numeric),
    ('nc-time-trial', 3::smallint, 3::numeric, 'descent', 'asphalt', -4::numeric),
    ('nc-time-trial', 4::smallint, 7::numeric, 'flat', 'asphalt', 0::numeric)
  ) as authored(
    slot_key, segment_number, distance_km, terrain_type,
    surface_type, average_gradient_pct
  )
  where authored.slot_key = p_slot_key
  order by authored.segment_number
$$;

revoke all on function public.get_professional_nations_cup_profile_segments(text)
  from public, anon, authenticated;
grant execute on function public.get_professional_nations_cup_profile_segments(text)
  to service_role;

create or replace function public.ensure_professional_nations_cup(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_season public.seasons%rowtype;
  v_default_country_id uuid;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_definition record;
  v_pool record;
  v_pool_key text;
  v_pool_label text;
  v_slug text;
  v_name text;
  v_short_name text;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_created integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.id = p_season_id;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  perform public.seed_nations_cup_assignments_for_season(v_season.id);

  select country.id into v_default_country_id
  from public.countries as country
  where country.iso_alpha2 = 'CH' and country.is_active = true;
  select award.country_id into v_host_country_id
  from public.national_federation_hosting_awards as award
  where award.target_game_year = v_season.game_year
    and award.event_type = 'nations_cup_pro'
    and award.status in ('scheduled', 'settled')
  order by award.selected_at desc
  limit 1;
  v_host_country_id := coalesce(v_host_country_id, v_default_country_id);

  select category.id into v_category_id
  from public.race_categories as category
  where category.code = 'world' and category.is_active = true;
  select day.id,
    (day.calendar_date::timestamp + time '18:00') at time zone 'Europe/Paris'
  into v_day_id, v_departure_at
  from public.season_days as day
  where day.season_id = v_season.id and day.day_number = 24;
  if v_default_country_id is null or v_host_country_id is null
     or v_category_id is null or v_day_id is null then
    raise exception 'Impossible de préparer la Nations Cup professionnelle S%.',
      v_season.game_year;
  end if;

  for v_definition in
    select * from (values
      ('nc-mountain', 'nations-cup-montagne', 'Nations Cup · Montagne', 'NC Montagne', 'mountain', 'road', 50::numeric),
      ('nc-hills', 'nations-cup-vallons', 'Nations Cup · Vallons', 'NC Vallons', 'hilly', 'road', 55::numeric),
      ('nc-sprint', 'nations-cup-sprint', 'Nations Cup · Sprint', 'NC Sprint', 'sprint', 'road', 55::numeric),
      ('nc-cobbles', 'nations-cup-paves', 'Nations Cup · Pavés', 'NC Pavés', 'cobbles', 'road', 55::numeric),
      ('nc-time-trial', 'nations-cup-contre-la-montre', 'Nations Cup · Contre-la-montre', 'NC CLM', 'time_trial', 'individual_time_trial', 20::numeric)
    ) as definition(
      slot_key, base_slug, base_name, base_short_name,
      profile_type, stage_type, distance_km
    )
  loop
    for v_pool in
      select assignment.division, assignment.group_code,
        count(*)::integer as field_limit
      from public.national_federation_nations_cup_assignments as assignment
      where assignment.season_id = v_season.id
      group by assignment.division, assignment.group_code
      order by assignment.division, assignment.group_code nulls first
    loop
      v_pool_key := 'd' || v_pool.division::text
        || case when v_pool.group_code is null then ''
          else '-' || lower(v_pool.group_code) end;
      v_pool_label := 'D' || v_pool.division::text
        || coalesce(v_pool.group_code, '');
      v_slug := v_definition.base_slug
        || case when v_pool.division = 1 then '' else '-' || v_pool_key end;
      v_name := v_definition.base_name
        || case when v_pool.division = 1 then '' else ' · ' || v_pool_label end;
      v_short_name := v_definition.base_short_name
        || case when v_pool.division = 1 then '' else ' ' || v_pool_label end;

      insert into public.races (
        country_id, name, short_name, race_format, status, slug,
        competition_type, championship_continent_code
      ) values (
        v_default_country_id, v_name, v_short_name,
        'one_day', 'active', v_slug, 'nations_cup', null
      )
      on conflict (slug) do update set
        name = excluded.name,
        short_name = excluded.short_name,
        race_format = excluded.race_format,
        status = excluded.status,
        competition_type = excluded.competition_type,
        championship_continent_code = null
      returning id into v_race_id;

      insert into public.race_editions (
        race_id, season_id, race_category_id, edition_number, display_name,
        status, registration_closes_at, withdrawal_closes_at,
        minimum_reputation, registration_policy, field_limit, host_country_id
      ) values (
        v_race_id, v_season.id, v_category_id, greatest(1, v_season.game_year),
        v_definition.base_name || ' · ' || v_pool_label,
        'registration_open', v_departure_at - interval '24 hours',
        v_departure_at - interval '24 hours', 0, 'closed',
        v_pool.field_limit, v_host_country_id
      )
      on conflict (race_id, season_id) do update set
        race_category_id = excluded.race_category_id,
        edition_number = excluded.edition_number,
        display_name = excluded.display_name,
        registration_closes_at = excluded.registration_closes_at,
        withdrawal_closes_at = excluded.withdrawal_closes_at,
        minimum_reputation = excluded.minimum_reputation,
        registration_policy = excluded.registration_policy,
        field_limit = excluded.field_limit,
        host_country_id = excluded.host_country_id
      returning id into v_edition_id;

      insert into public.national_federation_nations_cup_heats (
        season_id, slot_key, pool_key, division, group_code,
        race_id, race_edition_id
      ) values (
        v_season.id, v_definition.slot_key, v_pool_key,
        v_pool.division, v_pool.group_code, v_race_id, v_edition_id
      )
      on conflict (season_id, slot_key, pool_key) do update set
        division = excluded.division,
        group_code = excluded.group_code,
        race_id = excluded.race_id,
        race_edition_id = excluded.race_edition_id;

      v_stage_id := null;
      insert into public.stages as target (
        race_edition_id, season_day_id, stage_number, name, stage_type,
        distance_km, status, departure_at, profile_type, day_slot
      ) values (
        v_edition_id, v_day_id, 1,
        v_definition.base_name || ' · ' || v_pool_label,
        v_definition.stage_type, v_definition.distance_km,
        'planned', v_departure_at, v_definition.profile_type, 'late'
      )
      on conflict (race_edition_id, stage_number) do update set
        season_day_id = excluded.season_day_id,
        name = excluded.name,
        stage_type = excluded.stage_type,
        distance_km = excluded.distance_km,
        departure_at = excluded.departure_at,
        profile_type = excluded.profile_type,
        day_slot = excluded.day_slot
      where target.status = 'planned'
      returning id into v_stage_id;

      if v_stage_id is not null then
        delete from public.stage_segments where stage_id = v_stage_id;
        insert into public.stage_segments (
          stage_id, segment_number, distance_km, terrain_type,
          surface_type, average_gradient_pct
        )
        select v_stage_id, profile.segment_number, profile.distance_km,
          profile.terrain_type, profile.surface_type,
          profile.average_gradient_pct
        from public.get_professional_nations_cup_profile_segments(
          v_definition.slot_key
        ) as profile;
      end if;
      v_created := v_created + 1;
    end loop;
  end loop;
  return v_created;
end;
$$;

revoke all on function public.ensure_professional_nations_cup(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_professional_nations_cup(uuid)
  to service_role;

-- One authoritative resolver is shared by schedules, automatic selections
-- and roster synchronization. For Nations Cup it resolves the caller's own
-- frozen table; other international competitions retain their current rules.
create or replace function public.get_national_federation_selection_target(
  p_country_id uuid,
  p_season_id uuid,
  p_slot_key text
)
returns table (
  race_edition_id uuid,
  race_slug text,
  edition_status text,
  departure_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select edition.id, race.slug, edition.status,
    min(stage.departure_at) as departure_at
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.race_editions as edition on edition.season_id = p_season_id
  join public.races as race on race.id = edition.race_id
    and race.competition_type = slot.competition_code
  join public.stages as stage on stage.race_edition_id = edition.id
  where slot.slot_key = p_slot_key
    and slot.rider_category = 'professional'
    and edition.status <> 'cancelled'
    and (
      (slot.competition_code = 'nations_cup' and exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        join public.national_federation_nations_cup_heats as heat
          on heat.season_id = assignment.season_id
         and heat.division = assignment.division
         and heat.group_code is not distinct from assignment.group_code
         and heat.slot_key = slot.slot_key
         and heat.race_edition_id = edition.id
        where assignment.country_id = p_country_id
          and assignment.season_id = p_season_id
      ))
      or (
        slot.competition_code <> 'nations_cup'
        and (
          slot.competition_code <> 'continental_championship'
          or race.championship_continent_code = country.continent_code
        )
        and stage.stage_type = case when slot.profile_label = 'Chrono'
          then 'individual_time_trial' else 'road' end
      )
    )
  group by edition.id, race.slug
  order by (edition.status = 'cancelled'), min(stage.departure_at), edition.id
  limit 1
$$;

revoke all on function public.get_national_federation_selection_target(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_selection_target(uuid,uuid,text)
  to authenticated, service_role;

-- Le format est volontairement individuel : une nation aligne exactement un
-- coureur différent sur chacune des cinq épreuves de son tableau.
update public.national_federation_selection_slots
set rider_limit = 1
where rider_category = 'professional'
  and competition_code = 'nations_cup';

create or replace function public.get_national_federation_selection_schedule(
  p_country_id uuid, p_season_id uuid
)
returns table (
  slot_key text, label text, rider_category text, race_edition_id uuid,
  race_href text, departure_at timestamptz, closes_at timestamptz,
  is_open boolean
)
language sql stable security definer set search_path = ''
as $$
  select slot.slot_key, slot.label, slot.rider_category,
    coalesce(pro.race_edition_id, junior.id),
    case when pro.race_edition_id is not null
      then '/jeu/courses/' || pro.race_slug
      when junior.id is not null
      then '/jeu/resultats-juniors/' || junior.slug end,
    coalesce(pro.departure_at, junior.departure_at),
    deadline.closes_at,
    coalesce(season.status = 'active' and season.game_year >= 3
      and coalesce(pro.edition_status, junior.status)
        not in ('completed', 'cancelled')
      and now() < deadline.closes_at, false)
  from public.national_federation_selection_slots as slot
  join public.countries as country on country.id = p_country_id
  join public.seasons as season on season.id = p_season_id
    and season.game_year >= slot.active_from_game_year
  left join lateral public.get_national_federation_selection_target(
    country.id, season.id, slot.slot_key
  ) as pro on slot.rider_category = 'professional'
  left join lateral (
    select edition.id, edition.slug, edition.status,
      day.calendar_date::timestamp at time zone 'Europe/Paris' as departure_at
    from public.development_race_editions as edition
    join public.season_days as day on day.season_id = edition.season_id
      and day.day_number = edition.start_day_number
    where slot.rider_category = 'junior' and edition.season_id = season.id
      and edition.competition_type = case slot.slot_key
        when 'cc-junior-road' then 'continental_road'
        when 'cc-junior-itt' then 'continental_time_trial'
        when 'world-junior-road' then 'world_road'
        when 'world-junior-itt' then 'world_time_trial'
        when 'nc-junior-road' then 'nations_cup_junior' end
      and (slot.competition_code <> 'continental_championship_junior'
        or edition.championship_continent_code = country.continent_code)
    order by (edition.status = 'cancelled'), edition.start_day_number,
      edition.id limit 1
  ) as junior on true
  cross join lateral (
    select case when pro.race_edition_id is not null
      then pro.departure_at - interval '1 hour'
      else junior.departure_at end as closes_at
  ) as deadline;
$$;

revoke all on function public.get_national_federation_selection_schedule(uuid,uuid)
  from public, anon;
grant execute on function public.get_national_federation_selection_schedule(uuid,uuid)
  to authenticated, service_role;

create or replace function public.prepare_due_automatic_federation_professional_lineups(
  p_now timestamptz default now()
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
declare
  v_season public.seasons%rowtype;
  v_slot record;
  v_country record;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_automatic boolean;
  v_list public.national_federation_selection_lists%rowtype;
  v_selected integer;
  v_candidate record;
  v_total integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;
  perform public.ensure_professional_nations_cup(v_season.id);

  for v_slot in
    select slot.*
    from public.national_federation_selection_slots as slot
    where slot.rider_category = 'professional'
      and slot.competition_code in (
        'continental_championship', 'world_championship', 'nations_cup'
      )
      and slot.active_from_game_year <= v_season.game_year
      and slot.day_number between v_season.current_day_number
        and v_season.current_day_number + 4
    order by slot.day_number, slot.slot_key
  loop
    for v_country in
      select country.id, country.name, country.continent_code
      from public.countries as country
      where country.is_active = true
        and exists (
          select 1 from public.riders as rider
          join public.rider_season_ratings as rating
            on rating.rider_id = rider.id and rating.season_id = v_season.id
          where rider.country_id = country.id
            and rider.status in ('active', 'free_agent')
        )
      order by country.id
    loop
      select target.race_edition_id, target.departure_at
      into v_edition_id, v_departure_at
      from public.get_national_federation_selection_target(
        v_country.id, v_season.id, v_slot.slot_key
      ) as target;
      if v_edition_id is null then continue; end if;
      if public.federation_professional_call_up_is_due(
        v_slot.competition_code, v_departure_at, p_now
      ) is not true then continue; end if;

      select coalesce(preference.automatic_selection, true)
      into v_automatic
      from (select 1) as singleton
      left join public.national_federation_selection_preferences as preference
        on preference.country_id = v_country.id
       and preference.season_id = v_season.id;
      if not v_automatic and v_departure_at > p_now + interval '1 hour' then
        continue;
      end if;

      select * into v_list
      from public.national_federation_selection_lists as selection_list
      where selection_list.country_id = v_country.id
        and selection_list.season_id = v_season.id
        and selection_list.slot_key = v_slot.slot_key
      for update;

      if v_list.id is null then
        insert into public.national_federation_selection_lists (
          country_id, season_id, slot_key, status, revision,
          created_by_director_id, published_at, updated_at
        ) values (
          v_country.id, v_season.id, v_slot.slot_key, 'finalized', 1,
          null, p_now, p_now
        ) returning * into v_list;
      elsif v_automatic then
        update public.national_federation_selection_members
        set response_status = 'declined', responded_at = p_now
        where selection_list_id = v_list.id
          and response_status in ('draft', 'pending');
        update public.national_federation_selection_lists
        set status = 'finalized', created_by_director_id = null,
            published_at = coalesce(published_at, p_now), updated_at = p_now
        where id = v_list.id
        returning * into v_list;
      else
        update public.national_federation_selection_members
        set response_status = 'declined', responded_at = p_now
        where selection_list_id = v_list.id
          and response_status in ('draft', 'pending');
        update public.national_federation_selection_lists
        set status = 'finalized', published_at = coalesce(published_at, p_now),
            updated_at = p_now
        where id = v_list.id
        returning * into v_list;
      end if;

      select count(*)::integer into v_selected
      from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.response_status = 'confirmed';

      while v_selected < v_slot.rider_limit loop
        select rider.id as rider_id, ownership.team_id,
          ownership.sporting_director_id
        into v_candidate
        from public.riders as rider
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id and rating.season_id = v_season.id
        left join lateral (
          select contract.team_id, assignment.sporting_director_id
          from public.rider_contracts as contract
          left join public.team_manager_assignments as assignment
            on assignment.team_id = contract.team_id
           and assignment.role = 'general_manager'
           and assignment.status = 'active'
          where contract.rider_id = rider.id and contract.status = 'active'
          order by (assignment.sporting_director_id is not null) desc,
            contract.created_at desc, contract.id desc
          limit 1
        ) as ownership on true
        where rider.country_id = v_country.id
          and rider.status in ('active', 'free_agent')
          and not exists (
            select 1 from public.national_federation_selection_members as member
            where member.selection_list_id = v_list.id
              and member.professional_rider_id = rider.id
          )
          and not exists (
            select 1 from public.rider_injuries as injury
            where injury.rider_id = rider.id and injury.status = 'active'
              and injury.started_at < v_departure_at
              and injury.expected_recovery_at > v_departure_at
          )
          and (
            v_slot.competition_code <> 'nations_cup'
            or not exists (
              select 1
              from public.national_federation_selection_members as other_member
              join public.national_federation_selection_lists as other_list
                on other_list.id = other_member.selection_list_id
              join public.national_federation_selection_slots as other_slot
                on other_slot.slot_key = other_list.slot_key
              where other_list.country_id = v_country.id
                and other_list.season_id = v_season.id
                and other_list.id <> v_list.id
                and other_slot.competition_code = 'nations_cup'
                and other_member.professional_rider_id = rider.id
                and other_member.response_status = 'confirmed'
            )
          )
        order by
          case v_slot.profile_label
            when 'Montagne' then rating.mountain * .42 + rating.endurance * .18 + rating.recovery * .15 + rating.hills * .15 + rating.resistance * .10
            when 'Vallons' then rating.hills * .42 + rating.acceleration * .18 + rating.endurance * .15 + rating.mountain * .15 + rating.resistance * .10
            when 'Sprint' then rating.sprint * .40 + rating.acceleration * .25 + rating.flat * .15 + rating.endurance * .10 + rating.resistance * .10
            when 'Pavés' then rating.cobbles * .40 + rating.flat * .18 + rating.resistance * .17 + rating.endurance * .15 + rating.acceleration * .10
            when 'Chrono' then rating.time_trial * .55 + rating.prologue * .15 + rating.flat * .12 + rating.endurance * .10 + rating.resistance * .08
            else (rating.mountain + rating.hills + rating.flat + rating.sprint + rating.cobbles + rating.endurance + rating.resistance) / 7.0
          end desc,
          rider.id
        limit 1;
        if v_candidate.rider_id is null then exit; end if;

        insert into public.national_federation_selection_members (
          selection_list_id, professional_rider_id, owner_team_id,
          owner_director_id, response_status, responded_at
        ) values (
          v_list.id, v_candidate.rider_id, v_candidate.team_id,
          v_candidate.sporting_director_id, 'confirmed', p_now
        );
        v_selected := v_selected + 1;
        v_total := v_total + 1;
      end loop;

      insert into public.national_federation_journal_entries (
        country_id, season_id, day_number, category, title, detail,
        source_reference
      ) values (
        v_country.id, v_season.id, v_season.current_day_number,
        'selection', 'Liste sécurisée automatiquement',
        v_slot.label || ' · ' || v_selected::text || '/'
          || v_slot.rider_limit::text || ' places confirmées.',
        'federation-auto-fill:' || v_list.id::text || ':revision:'
          || v_list.revision::text
      ) on conflict (source_reference) do nothing;
    end loop;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.prepare_due_automatic_federation_professional_lineups(timestamptz)
  from public, anon, authenticated;
grant execute on function public.prepare_due_automatic_federation_professional_lineups(timestamptz)
  to service_role;

create or replace function public.sync_national_federation_championship_lineup(
  p_selection_list_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_list public.national_federation_selection_lists%rowtype;
  v_slot public.national_federation_selection_slots%rowtype;
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_edition_id uuid;
  v_departure_at timestamptz;
  v_linked_edition_id uuid;
  v_registration_id uuid;
  v_member record;
  v_roster_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-startlist:' || p_selection_list_id::text, 0
    )
  );
  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id for update;
  if v_list.id is null
     or v_list.status not in ('pending_confirmation', 'finalized') then
    return 0;
  end if;
  select * into v_slot from public.national_federation_selection_slots
  where slot_key = v_list.slot_key;
  select * into v_country from public.countries where id = v_list.country_id;
  select * into v_season from public.seasons where id = v_list.season_id;
  if v_season.game_year < 3 or v_slot.rider_category <> 'professional'
     or v_slot.competition_code not in (
       'world_championship', 'continental_championship', 'nations_cup'
     ) then return 0; end if;

  select target.race_edition_id, target.departure_at
  into v_edition_id, v_departure_at
  from public.get_national_federation_selection_target(
    v_list.country_id, v_list.season_id, v_list.slot_key
  ) as target;
  if v_edition_id is null or v_departure_at <= now() then return 0; end if;

  select link.race_registration_id, link.race_edition_id
  into v_registration_id, v_linked_edition_id
  from public.national_federation_selection_race_links as link
  where link.selection_list_id = v_list.id;

  -- Rehome pre-existing global Nations Cup registrations into the country's
  -- exact division/group heat. The old registration remains as an auditable
  -- withdrawn row and can no longer leak riders into D1.
  if v_registration_id is not null
     and v_linked_edition_id is distinct from v_edition_id then
    update public.race_rosters
    set status = 'withdrawn'
    where race_registration_id = v_registration_id
      and status in ('selected', 'confirmed');
    update public.race_registrations
    set status = 'withdrawn', decided_at = now()
    where id = v_registration_id;
    v_registration_id := null;
  end if;

  if v_registration_id is null then
    insert into public.race_registrations (
      race_edition_id, team_season_id, historical_team_name,
      entry_method, status, registered_at, decided_at
    ) values (
      v_edition_id, null, v_country.name,
      'automatic', 'accepted', now(), now()
    ) returning id into v_registration_id;
    insert into public.national_federation_selection_race_links (
      selection_list_id, race_edition_id, race_registration_id, synced_at
    ) values (v_list.id, v_edition_id, v_registration_id, now())
    on conflict (selection_list_id) do update set
      race_edition_id = excluded.race_edition_id,
      race_registration_id = excluded.race_registration_id,
      synced_at = excluded.synced_at;
  else
    update public.race_registrations
    set status = 'accepted', historical_team_name = v_country.name,
        decided_at = now()
    where id = v_registration_id;
    update public.national_federation_selection_race_links
    set race_edition_id = v_edition_id, synced_at = now()
    where selection_list_id = v_list.id;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration, public.riders as rider
  where registration.id = roster.race_registration_id
    and rider.id = roster.rider_id
    and registration.race_edition_id = v_edition_id
    and registration.id <> v_registration_id
    and rider.country_id = v_list.country_id
    and roster.status in ('selected', 'confirmed');
  update public.race_rosters as roster
  set status = 'withdrawn'
  where roster.race_registration_id = v_registration_id
    and roster.status in ('selected', 'confirmed')
    and not exists (
      select 1 from public.national_federation_selection_members as member
      where member.selection_list_id = v_list.id
        and member.professional_rider_id = roster.rider_id
        and member.response_status = 'confirmed'
    );

  for v_member in
    select member.professional_rider_id as rider_id
    from public.national_federation_selection_members as member
    join public.riders as rider on rider.id = member.professional_rider_id
    where member.selection_list_id = v_list.id
      and member.response_status = 'confirmed'
      and rider.country_id = v_list.country_id
      and rider.status in ('active', 'free_agent')
    order by member.created_at, member.id
    limit v_slot.rider_limit
  loop
    begin
      perform public.prioritize_federation_championship_rider(
        v_edition_id, v_member.rider_id
      );
      insert into public.race_rosters (
        race_registration_id, rider_id, race_role, status, selected_at
      ) values (
        v_registration_id, v_member.rider_id, 'auto', 'confirmed', now()
      ) on conflict (race_registration_id, rider_id) do update set
        race_role = 'auto', status = 'confirmed',
        selected_at = excluded.selected_at;
    exception when sqlstate 'P0001' then
      raise warning 'Coureur % absent de la startlist fédérale: %',
        v_member.rider_id, sqlerrm;
    end;
  end loop;

  update public.race_registrations as registration
  set status = 'withdrawn', decided_at = now()
  where registration.race_edition_id = v_edition_id
    and registration.entry_method = 'automatic'
    and not exists (
      select 1 from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );
  select count(*)::integer into v_roster_count
  from public.race_rosters
  where race_registration_id = v_registration_id
    and status in ('selected', 'confirmed');
  return v_roster_count;
end;
$$;

revoke all on function public.sync_national_federation_championship_lineup(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_national_federation_championship_lineup(uuid)
  to service_role;

select public.ensure_due_professional_nations_cup();
select public.sync_due_national_federation_championship_lineups(now(), true);

-- Defensive cleanup for any historical global registration that was not
-- linked to a selection list. Only future, unsimulated Nations Cup heats are
-- touched; every other race and every official result remains immutable.
update public.race_rosters as roster
set status = 'withdrawn'
from public.race_registrations as registration,
  public.national_federation_nations_cup_heats as heat,
  public.riders as rider,
  public.national_federation_nations_cup_assignments as assignment,
  public.stages as stage
where registration.id = roster.race_registration_id
  and heat.race_edition_id = registration.race_edition_id
  and stage.race_edition_id = heat.race_edition_id
  and stage.status = 'planned'
  and rider.id = roster.rider_id
  and assignment.country_id = rider.country_id
  and assignment.season_id = heat.season_id
  and (
    assignment.division is distinct from heat.division
    or assignment.group_code is distinct from heat.group_code
  )
  and roster.status in ('selected', 'confirmed');

update public.race_registrations as registration
set status = 'withdrawn', decided_at = now()
where registration.entry_method = 'automatic'
  and exists (
    select 1
    from public.national_federation_nations_cup_heats as heat
    join public.stages as stage
      on stage.race_edition_id = heat.race_edition_id
     and stage.status = 'planned'
    where heat.race_edition_id = registration.race_edition_id
  )
  and not exists (
    select 1 from public.race_rosters as roster
    where roster.race_registration_id = registration.id
      and roster.status in ('selected', 'confirmed')
  );

comment on table public.national_federation_nations_cup_heats is
  'Five independent professional races per Nations Cup division/group table; each nation contributes at most one rider per race.';
comment on function public.get_national_federation_selection_target(uuid,uuid,text) is
  'Resolves an international selection to its exact race, including the country Nations Cup division/group heat.';

notify pgrst, 'reload schema';

commit;
