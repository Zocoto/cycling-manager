begin;

alter table public.races
drop constraint races_competition_type_allowed;
alter table public.races
add constraint races_competition_type_allowed
check (
  competition_type in (
    'standard',
    'national_road',
    'national_time_trial',
    'continental_championship',
    'world_championship',
    'nations_cup'
  )
);

-- The five professional Nations Cup selection slots now point to five real,
-- independently simulated one-day races on J24.
create or replace function public.ensure_professional_nations_cup(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  v_season public.seasons%rowtype;
  v_default_country_id uuid;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_definition record;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_created integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.id = p_season_id;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

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
      ('nc-mountain', 'nations-cup-montagne', 'Nations Cup · Montagne', 'NC Montagne', 'mountain', 'road', 185::numeric),
      ('nc-hills', 'nations-cup-vallons', 'Nations Cup · Vallons', 'NC Vallons', 'hilly', 'road', 190::numeric),
      ('nc-sprint', 'nations-cup-sprint', 'Nations Cup · Sprint', 'NC Sprint', 'sprint', 'road', 175::numeric),
      ('nc-cobbles', 'nations-cup-paves', 'Nations Cup · Pavés', 'NC Pavés', 'cobbles', 'road', 170::numeric),
      ('nc-time-trial', 'nations-cup-contre-la-montre', 'Nations Cup · Contre-la-montre', 'NC CLM', 'time_trial', 'individual_time_trial', 45::numeric)
    ) as definition(
      slot_key, slug, name, short_name, profile_type, stage_type, distance_km
    )
  loop
    insert into public.races (
      country_id, name, short_name, race_format, status, slug,
      competition_type, championship_continent_code
    ) values (
      v_default_country_id, v_definition.name, v_definition.short_name,
      'one_day', 'active', v_definition.slug, 'nations_cup', null
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
      v_definition.name, 'registration_open',
      v_departure_at - interval '24 hours',
      v_departure_at - interval '24 hours',
      0, 'closed', 200, v_host_country_id
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

    insert into public.stages (
      race_edition_id, season_day_id, stage_number, name, stage_type,
      distance_km, status, departure_at, profile_type, day_slot
    ) values (
      v_edition_id, v_day_id, 1, v_definition.name,
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
    returning id into v_stage_id;

    if exists (
      select 1 from public.stages as stage
      where stage.id = v_stage_id and stage.status = 'planned'
    ) then
      delete from public.stage_segments where stage_id = v_stage_id;
      insert into public.stage_segments (
        stage_id, segment_number, distance_km, terrain_type,
        surface_type, average_gradient_pct
      )
      select
        v_stage_id,
        segment.number,
        least(10::numeric, v_definition.distance_km - (segment.number - 1) * 10),
        case
          when v_definition.profile_type = 'mountain' and segment.number % 4 in (2, 3)
            then case when segment.number % 4 = 2 then 'climb' else 'descent' end
          when v_definition.profile_type = 'hilly' and segment.number % 5 in (2, 3)
            then case when segment.number % 5 = 2 then 'climb' else 'descent' end
          else 'flat'
        end,
        case
          when v_definition.profile_type = 'cobbles' and segment.number % 3 <> 0
            then 'cobbles'
          else 'asphalt'
        end,
        case
          when v_definition.profile_type = 'mountain' and segment.number % 4 = 2 then 6.8
          when v_definition.profile_type = 'mountain' and segment.number % 4 = 3 then -5.6
          when v_definition.profile_type = 'hilly' and segment.number % 5 = 2 then 4.2
          when v_definition.profile_type = 'hilly' and segment.number % 5 = 3 then -3.5
          else 0
        end
      from generate_series(
        1,
        ceil(v_definition.distance_km / 10.0)::integer
      ) as segment(number);
    end if;
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

revoke all on function public.ensure_professional_nations_cup(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_professional_nations_cup(uuid)
  to service_role;

create or replace function public.ensure_due_professional_nations_cup()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_season record;
  v_total integer := 0;
begin
  for v_season in
    select season.id
    from public.seasons as season
    where season.game_year >= 3
      and season.status in ('active', 'planned')
      and exists (
        select 1 from public.season_days as day
        where day.season_id = season.id and day.day_number = 24
      )
    order by season.game_year
  loop
    v_total := v_total + public.ensure_professional_nations_cup(v_season.id);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.ensure_due_professional_nations_cup()
  from public, anon, authenticated;
grant execute on function public.ensure_due_professional_nations_cup()
  to service_role;

-- Hosting awards now move the five real editions to the selected host.
create or replace function public.apply_professional_nations_cup_host()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'nations_cup_pro'
     and new.status in ('scheduled', 'settled') then
    update public.race_editions as edition
    set host_country_id = new.country_id
    from public.races as race, public.seasons as season
    where race.id = edition.race_id
      and race.competition_type = 'nations_cup'
      and season.id = edition.season_id
      and season.game_year = new.target_game_year;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_professional_nations_cup_host_trigger
  on public.national_federation_hosting_awards;
create trigger apply_professional_nations_cup_host_trigger
after insert or update of country_id, status
on public.national_federation_hosting_awards
for each row execute function public.apply_professional_nations_cup_host();

revoke all on function public.apply_professional_nations_cup_host()
  from public, anon, authenticated;

-- Division assignment is based on the UCI rank frozen at opening. Results are
-- scored from the five real races and ranked both globally and in each group.
create or replace function public.get_nations_cup_group_code(
  p_uci_rank integer,
  p_division integer
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_offset integer;
  v_group_count integer;
  v_row integer;
  v_position integer;
begin
  if p_division = 1 then return null; end if;
  v_group_count := case when p_division = 4 then 3 else 2 end;
  v_offset := greatest(0, p_uci_rank - case p_division
    when 2 then 21 when 3 then 61 else 101 end);
  v_row := floor(v_offset::numeric / v_group_count)::integer;
  v_position := v_offset % v_group_count;
  if v_row % 2 = 1 then
    v_position := v_group_count - 1 - v_position;
  end if;
  return chr(ascii('A') + v_position);
end;
$$;

create or replace function public.get_national_federation_nations_cup_standings(
  p_season_id uuid
)
returns table (
  country_id uuid,
  country_code text,
  country_name text,
  uci_rank integer,
  division integer,
  group_code text,
  points integer,
  wins integer,
  podiums integer,
  events_count integer,
  overall_rank integer,
  division_rank integer,
  group_rank integer
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
  with season_context as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ), ranked_uci as (
    select ranked.country_id, ranked.rank
    from (
      select country_points.country_id,
        row_number() over (
          order by country_points.points desc, country_points.country_id
        )::integer as rank
      from (
        select ranking.country_id, sum(ranking.uci_points)::bigint as points
        from public.get_national_championship_country_rankings(p_season_id) as ranking
        group by ranking.country_id
      ) as country_points
    ) as ranked
  ), assignments as (
    select
      country.id as country_id,
      country.iso_alpha2::text as country_code,
      country.name::text as country_name,
      coalesce(account.uci_rank, ranked_uci.rank, 173)::integer as uci_rank,
      coalesce(
        account.nations_cup_division,
        case
          when coalesce(ranked_uci.rank, 173) <= 20 then 1
          when coalesce(ranked_uci.rank, 173) <= 60 then 2
          when coalesce(ranked_uci.rank, 173) <= 100 then 3
          else 4
        end
      )::integer as division
    from public.countries as country
    cross join season_context
    left join ranked_uci on ranked_uci.country_id = country.id
    left join public.national_federation_accounts as account
      on account.country_id = country.id
     and account.season_id = p_season_id
    where country.is_active = true
  ), scored_results as (
    select
      rider.country_id,
      count(*)::integer as events_count,
      count(*) filter (where result.final_rank = 1)::integer as wins,
      count(*) filter (where result.final_rank <= 3)::integer as podiums,
      coalesce(sum(case result.final_rank
        when 1 then 50 when 2 then 40 when 3 then 32 when 4 then 26
        when 5 then 22 when 6 then 18 when 7 then 15 when 8 then 12
        when 9 then 10 when 10 then 8 when 11 then 6 when 12 then 5
        when 13 then 4 when 14 then 3 when 15 then 2 when 16 then 1
        else 0 end), 0)::integer as points,
      sum(result.final_rank)::integer as rank_sum
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'nations_cup'
    join public.race_rosters as roster on roster.id = result.race_roster_id
    join public.riders as rider on rider.id = roster.rider_id
    where result.status = 'classified'
    group by rider.country_id
  ), scored as (
    select
      assignments.*,
      public.get_nations_cup_group_code(
        assignments.uci_rank,
        assignments.division
      ) as group_code,
      coalesce(scored_results.points, 0)::integer as points,
      coalesce(scored_results.wins, 0)::integer as wins,
      coalesce(scored_results.podiums, 0)::integer as podiums,
      coalesce(scored_results.events_count, 0)::integer as events_count,
      coalesce(scored_results.rank_sum, 9999)::integer as rank_sum
    from assignments
    left join scored_results on scored_results.country_id = assignments.country_id
  )
  select
    scored.country_id,
    scored.country_code,
    scored.country_name,
    scored.uci_rank,
    scored.division,
    scored.group_code,
    scored.points,
    scored.wins,
    scored.podiums,
    scored.events_count,
    row_number() over (
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as overall_rank,
    row_number() over (
      partition by scored.division
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as division_rank,
    row_number() over (
      partition by scored.division, scored.group_code
      order by scored.points desc, scored.wins desc, scored.podiums desc,
        scored.rank_sum, scored.uci_rank, scored.country_id
    )::integer as group_rank
  from scored
$$;

revoke all on function public.get_national_federation_nations_cup_standings(uuid)
  from public, anon;
grant execute on function public.get_national_federation_nations_cup_standings(uuid)
  to authenticated, service_role;

-- At the deadline, unresolved or empty manual lists are completed with the
-- best eligible riders. Automatic mode prepares the same safe lists earlier.
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
        and v_season.current_day_number + 3
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
      select edition.id, min(stage.departure_at)
      into v_edition_id, v_departure_at
      from public.race_editions as edition
      join public.races as race on race.id = edition.race_id
      join public.stages as stage on stage.race_edition_id = edition.id
      where edition.season_id = v_season.id
        and edition.status not in ('completed', 'cancelled')
        and race.competition_type = v_slot.competition_code
        and (
          v_slot.competition_code <> 'continental_championship'
          or race.championship_continent_code = v_country.continent_code
        )
        and (
          (v_slot.competition_code = 'nations_cup' and stage.profile_type = case v_slot.profile_label
            when 'Montagne' then 'mountain' when 'Vallons' then 'hilly'
            when 'Sprint' then 'sprint' when 'Pavés' then 'cobbles'
            else 'time_trial' end)
          or (v_slot.competition_code <> 'nations_cup'
            and stage.stage_type = case when v_slot.profile_label = 'Chrono'
              then 'individual_time_trial' else 'road' end)
        )
      group by edition.id
      order by min(stage.departure_at), edition.id
      limit 1;
      if v_edition_id is null then continue; end if;

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
        select
          rider.id as rider_id,
          ownership.team_id,
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

-- The conflict resolver applies to Nations Cup selections too.
do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.prioritize_federation_championship_rider(uuid,uuid)'::regprocedure
  ) into v_definition;
  if position('''nations_cup''' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '''world_championship'', ''continental_championship''',
      '''world_championship'', ''continental_championship'', ''nations_cup'''
    );
    execute v_definition;
  end if;
end;
$migration$;

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
  v_registration_id uuid;
  v_member record;
  v_roster_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'federation-startlist:' || p_selection_list_id::text,
      0
    )
  );
  select * into v_list
  from public.national_federation_selection_lists
  where id = p_selection_list_id for update;
  if v_list.id is null or v_list.status not in ('pending_confirmation', 'finalized') then
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

  select edition.id, min(stage.departure_at)
  into v_edition_id, v_departure_at
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage on stage.race_edition_id = edition.id
  where edition.season_id = v_list.season_id
    and edition.status not in ('completed', 'cancelled')
    and race.competition_type = v_slot.competition_code
    and (
      v_slot.competition_code <> 'continental_championship'
      or race.championship_continent_code = v_country.continent_code
    )
    and (
      (v_slot.competition_code = 'nations_cup' and stage.profile_type = case v_slot.profile_label
        when 'Montagne' then 'mountain' when 'Vallons' then 'hilly'
        when 'Sprint' then 'sprint' when 'Pavés' then 'cobbles'
        else 'time_trial' end)
      or (v_slot.competition_code <> 'nations_cup'
        and stage.stage_type = case when v_slot.profile_label = 'Chrono'
          then 'individual_time_trial' else 'road' end)
    )
  group by edition.id
  order by min(stage.departure_at), edition.id
  limit 1;
  if v_edition_id is null or v_departure_at <= now() then return 0; end if;

  select link.race_registration_id into v_registration_id
  from public.national_federation_selection_race_links as link
  where link.selection_list_id = v_list.id;
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
    ) values (v_list.id, v_edition_id, v_registration_id, now());
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
        race_role = 'auto', status = 'confirmed', selected_at = excluded.selected_at;
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

create or replace function public.sync_due_national_federation_championship_lineups(
  p_now timestamptz default now(),
  p_force boolean default false
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '150s'
as $$
declare
  v_list record;
  v_synced_count integer := 0;
begin
  perform public.prepare_due_automatic_federation_professional_lineups(p_now);
  for v_list in
    select selection_list.id
    from public.national_federation_selection_lists as selection_list
    join public.national_federation_selection_slots as slot
      on slot.slot_key = selection_list.slot_key
    join public.seasons as season
      on season.id = selection_list.season_id
     and season.status = 'active' and season.game_year >= 3
    left join public.national_federation_selection_race_links as link
      on link.selection_list_id = selection_list.id
    where selection_list.status in ('pending_confirmation', 'finalized')
      and slot.rider_category = 'professional'
      and slot.competition_code in (
        'world_championship', 'continental_championship', 'nations_cup'
      )
      and (
        p_force or link.selection_list_id is null
        or link.synced_at < selection_list.updated_at
        or exists (
          select 1
          from public.national_federation_selection_members as changed_member
          where changed_member.selection_list_id = selection_list.id
            and changed_member.responded_at > link.synced_at
        )
      )
    order by selection_list.updated_at, selection_list.id
  loop
    if public.sync_national_federation_championship_lineup(v_list.id) > 0 then
      v_synced_count := v_synced_count + 1;
    end if;
  end loop;
  return v_synced_count;
end;
$$;

revoke all on function public.sync_due_national_federation_championship_lineups(timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.sync_due_national_federation_championship_lineups(timestamptz, boolean)
  to service_role;

select public.ensure_due_professional_nations_cup();

comment on function public.get_national_federation_nations_cup_standings(uuid) is
  'Classement réel de la Nations Cup professionnelle : cinq résultats J24, points, division et groupe.';
comment on function public.prepare_due_automatic_federation_professional_lineups(timestamptz) is
  'Sécurise les listes professionnelles automatiques et complète à H-1 les places manuelles vacantes.';

notify pgrst, 'reload schema';

commit;
