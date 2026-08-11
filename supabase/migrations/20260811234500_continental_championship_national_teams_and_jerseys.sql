begin;

-- ============================================================
-- TITRES CONTINENTAUX
-- Les résultats S1 restent strictement inchangés : on en déduit seulement
-- les titres et les maillots. Les éditions suivantes sont gérées par trigger.
-- ============================================================

alter table public.rider_national_championship_titles
drop constraint if exists rider_national_titles_type_allowed;

alter table public.rider_national_championship_titles
add constraint rider_national_titles_type_allowed
check (
  championship_type in (
    'road',
    'time_trial',
    'world_road',
    'world_time_trial',
    'continental_africa_road',
    'continental_africa_time_trial',
    'continental_america_road',
    'continental_america_time_trial',
    'continental_asia_road',
    'continental_asia_time_trial',
    'continental_europe_road',
    'continental_europe_time_trial',
    'continental_oceania_road',
    'continental_oceania_time_trial'
  )
);

-- Backfill non destructif : aucune startlist, simulation ou ligne de résultat
-- n'est modifiée. Seul le vainqueur déjà classé de chaque CC reçoit son titre.
with continental_winners as (
  select
    roster.rider_id,
    rider.country_id,
    edition.season_id,
    edition.id as race_edition_id,
    format(
      'continental_%s_%s',
      race.championship_continent_code,
      case
        when stage.is_time_trial then 'time_trial'
        else 'road'
      end
    ) as championship_type,
    result.updated_at as won_at,
    row_number() over (
      partition by
        race.championship_continent_code,
        case when stage.is_time_trial then 'time_trial' else 'road' end
      order by season.game_year desc, result.updated_at desc, edition.id desc
    ) as recency_rank
  from public.race_results as result
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
  join public.race_editions as edition
    on edition.id = result.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type = 'continental_championship'
   and race.championship_continent_code in (
     'africa', 'america', 'asia', 'europe', 'oceania'
   )
  join lateral (
    select bool_or(
      stage.stage_type in (
        'individual_time_trial',
        'team_time_trial',
        'prologue'
      )
    ) as is_time_trial
    from public.stages as stage
    where stage.race_edition_id = edition.id
  ) as stage on true
  where result.status = 'classified'
    and result.final_rank = 1
)
insert into public.rider_national_championship_titles (
  rider_id,
  country_id,
  season_id,
  race_edition_id,
  championship_type,
  won_at,
  relinquished_at
)
select
  winner.rider_id,
  winner.country_id,
  winner.season_id,
  winner.race_edition_id,
  winner.championship_type,
  winner.won_at,
  case when winner.recency_rank = 1 then null else winner.won_at end
from continental_winners as winner
on conflict (race_edition_id, championship_type)
do update set
  rider_id = excluded.rider_id,
  country_id = excluded.country_id,
  season_id = excluded.season_id,
  won_at = excluded.won_at,
  relinquished_at = excluded.relinquished_at;

create unique index if not exists
  rider_continental_titles_one_active_per_continent_discipline_idx
on public.rider_national_championship_titles (championship_type)
where relinquished_at is null
  and championship_type in (
    'continental_africa_road',
    'continental_africa_time_trial',
    'continental_america_road',
    'continental_america_time_trial',
    'continental_asia_road',
    'continental_asia_time_trial',
    'continental_europe_road',
    'continental_europe_time_trial',
    'continental_oceania_road',
    'continental_oceania_time_trial'
  );

create or replace function public.assign_continental_championship_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_id uuid;
  v_country_id uuid;
  v_season_id uuid;
  v_competition_type text;
  v_continent_code text;
  v_championship_type text;
begin
  if new.status <> 'classified' or new.final_rank <> 1 then
    return new;
  end if;

  select
    roster.rider_id,
    rider.country_id,
    edition.season_id,
    race.competition_type,
    race.championship_continent_code,
    format(
      'continental_%s_%s',
      race.championship_continent_code,
      case
        when exists (
          select 1
          from public.stages as stage
          where stage.race_edition_id = edition.id
            and stage.stage_type in (
              'individual_time_trial',
              'team_time_trial',
              'prologue'
            )
        ) then 'time_trial'
        else 'road'
      end
    )
  into
    v_rider_id,
    v_country_id,
    v_season_id,
    v_competition_type,
    v_continent_code,
    v_championship_type
  from public.race_rosters as roster
  join public.riders as rider on rider.id = roster.rider_id
  join public.race_editions as edition on edition.id = new.race_edition_id
  join public.races as race on race.id = edition.race_id
  where roster.id = new.race_roster_id;

  if v_competition_type <> 'continental_championship'
    or v_continent_code not in (
      'africa', 'america', 'asia', 'europe', 'oceania'
    )
  then
    return new;
  end if;

  update public.rider_national_championship_titles
  set relinquished_at = coalesce(relinquished_at, now())
  where championship_type = v_championship_type
    and relinquished_at is null
    and (
      rider_id <> v_rider_id
      or race_edition_id <> new.race_edition_id
    );

  insert into public.rider_national_championship_titles (
    rider_id,
    country_id,
    season_id,
    race_edition_id,
    championship_type,
    won_at,
    relinquished_at
  )
  values (
    v_rider_id,
    v_country_id,
    v_season_id,
    new.race_edition_id,
    v_championship_type,
    now(),
    null
  )
  on conflict (race_edition_id, championship_type)
  do update set
    rider_id = excluded.rider_id,
    country_id = excluded.country_id,
    season_id = excluded.season_id,
    won_at = excluded.won_at,
    relinquished_at = null;

  return new;
end;
$$;

drop trigger if exists assign_continental_championship_title
on public.race_results;

create trigger assign_continental_championship_title
after insert or update of status, final_rank
on public.race_results
for each row
execute function public.assign_continental_championship_title();

-- ============================================================
-- SÉLECTIONS NATIONALES CC À PARTIR DE LA S2
-- Le moteur historique continue de finaliser les sélections à H-24. Cette
-- préparation crée d'abord les sélections S2 spécialisées, ce qui empêche la
-- branche généraliste historique de les recréer.
-- ============================================================

create or replace function public.prepare_upcoming_continental_championship_selections_s2(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_championship record;
  v_nation record;
  v_nation_selection_id uuid;
  v_created integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'international-championship-selections',
      0
    )
  );

  for v_championship in
    select
      edition.id as race_edition_id,
      edition.season_id,
      race.championship_continent_code as continent_code,
      stage.departure_at,
      stage.profile_type
    from public.race_editions as edition
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
     and season.game_year >= 2
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
    join lateral (
      select
        min(stage.departure_at) as departure_at,
        (array_agg(stage.profile_type order by stage.stage_number))[1]
          as profile_type
      from public.stages as stage
      where stage.race_edition_id = edition.id
    ) as stage on true
    where edition.status not in ('completed', 'cancelled')
      and stage.departure_at is not null
      and stage.departure_at <= p_now + interval '24 hours'
    order by stage.departure_at, edition.id
  loop
    for v_nation in
      with nation_strength as (
        select
          country.id as country_id,
          country.name as country_name,
          country.continent_code,
          coalesce(sum(summary.points), 0)::integer as points,
          avg(
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
          ) as rating_strength,
          count(*) as active_riders
        from public.countries as country
        join public.riders as rider
          on rider.country_id = country.id
         and rider.status = 'active'
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id
         and rating.season_id = v_championship.season_id
        left join public.rider_season_summaries as summary
          on summary.rider_id = rider.id
         and summary.season_id = v_championship.season_id
        where country.continent_code = v_championship.continent_code
        group by country.id, country.name, country.continent_code
      ),
      ranked as (
        select
          nation_strength.*,
          row_number() over (
            order by
              nation_strength.points desc,
              nation_strength.rating_strength desc,
              nation_strength.active_riders desc,
              nation_strength.country_name,
              nation_strength.country_id
          ) as nation_rank
        from nation_strength
      )
      select *
      from ranked
      where nation_rank <= 20
      order by nation_rank
    loop
      v_nation_selection_id := null;

      insert into public.international_championship_nation_selections (
        race_edition_id,
        country_id,
        continent_code,
        nation_rank,
        nation_points,
        captured_at
      )
      values (
        v_championship.race_edition_id,
        v_nation.country_id,
        v_championship.continent_code,
        v_nation.nation_rank,
        v_nation.points,
        p_now
      )
      on conflict (race_edition_id, country_id) do nothing
      returning id into v_nation_selection_id;

      if v_nation_selection_id is null then
        select selection.id
        into v_nation_selection_id
        from public.international_championship_nation_selections as selection
        where selection.race_edition_id = v_championship.race_edition_id
          and selection.country_id = v_nation.country_id;
      else
        v_created := v_created + 1;
      end if;

      if not exists (
        select 1
        from public.international_championship_rider_selections as candidate
        where candidate.nation_selection_id = v_nation_selection_id
      ) then
        insert into public.international_championship_rider_selections (
          nation_selection_id,
          rider_id,
          team_id,
          sporting_director_id,
          rider_rank,
          uci_points,
          overall_rating,
          response_status
        )
        select
          v_nation_selection_id,
          ranked.rider_id,
          ranked.team_id,
          ranked.sporting_director_id,
          ranked.rider_rank,
          ranked.uci_points,
          ranked.profile_rating,
          case
            when ranked.is_injured then 'ineligible_injury'
            when ranked.team_id is null then 'unavailable'
            else 'pending'
          end
        from (
          select
            pool.*,
            row_number() over (
              order by
                pool.profile_rating desc,
                pool.uci_points desc,
                pool.endurance desc,
                pool.resistance desc,
                pool.last_name,
                pool.first_name,
                pool.rider_id
            )::integer as rider_rank
          from (
            select
              rider.id as rider_id,
              rider.first_name,
              rider.last_name,
              ownership.team_id,
              ownership.sporting_director_id,
              coalesce(summary.points, 0)::integer as uci_points,
              rating.endurance,
              rating.resistance,
              round((
                case v_championship.profile_type
                  when 'flat' then
                    rating.flat * 0.32 + rating.endurance * 0.20
                    + rating.resistance * 0.15 + rating.sprint * 0.12
                    + rating.acceleration * 0.08 + rating.breakaway * 0.08
                    + rating.hills * 0.05
                  when 'sprint' then
                    rating.sprint * 0.30 + rating.acceleration * 0.23
                    + rating.flat * 0.15 + rating.endurance * 0.12
                    + rating.resistance * 0.10 + rating.recovery * 0.05
                    + rating.hills * 0.05
                  when 'mountain' then
                    rating.mountain * 0.35 + rating.hills * 0.15
                    + rating.endurance * 0.14 + rating.resistance * 0.12
                    + rating.recovery * 0.10 + rating.downhill * 0.07
                    + rating.breakaway * 0.07
                  when 'cobbles' then
                    rating.cobbles * 0.35 + rating.flat * 0.15
                    + rating.resistance * 0.15 + rating.endurance * 0.12
                    + rating.acceleration * 0.08 + rating.hills * 0.08
                    + rating.recovery * 0.07
                  when 'time_trial' then
                    rating.time_trial * 0.50 + rating.endurance * 0.18
                    + rating.flat * 0.12 + rating.prologue * 0.08
                    + rating.resistance * 0.07 + rating.recovery * 0.05
                  when 'hilly' then
                    rating.hills * 0.32 + rating.acceleration * 0.15
                    + rating.endurance * 0.15 + rating.resistance * 0.12
                    + rating.breakaway * 0.12 + rating.mountain * 0.08
                    + rating.recovery * 0.06
                  when 'mixed' then
                    rating.hills * 0.17 + rating.mountain * 0.15
                    + rating.flat * 0.12 + rating.cobbles * 0.10
                    + rating.sprint * 0.08 + rating.acceleration * 0.08
                    + rating.endurance * 0.12 + rating.resistance * 0.10
                    + rating.breakaway * 0.08
                  else
                    rating.hills * 0.32 + rating.acceleration * 0.15
                    + rating.endurance * 0.15 + rating.resistance * 0.12
                    + rating.breakaway * 0.12 + rating.mountain * 0.08
                    + rating.recovery * 0.06
                end
              )::numeric, 2) as profile_rating,
              exists (
                select 1
                from public.rider_injuries as injury
                where injury.rider_id = rider.id
                  and injury.status = 'active'
                  and injury.started_at < v_championship.departure_at
                  and injury.expected_recovery_at > v_championship.departure_at
              ) as is_injured
            from public.riders as rider
            join public.rider_season_ratings as rating
              on rating.rider_id = rider.id
             and rating.season_id = v_championship.season_id
            left join public.rider_season_summaries as summary
              on summary.rider_id = rider.id
             and summary.season_id = v_championship.season_id
            left join lateral (
              select
                contract.team_id,
                assignment.sporting_director_id
              from public.rider_contracts as contract
              left join public.team_manager_assignments as assignment
                on assignment.team_id = contract.team_id
               and assignment.role = 'general_manager'
               and assignment.status = 'active'
              where contract.rider_id = rider.id
                and contract.status = 'active'
              order by
                (assignment.sporting_director_id is not null) desc,
                contract.created_at desc
              limit 1
            ) as ownership on true
            where rider.country_id = v_nation.country_id
              and rider.status = 'active'
          ) as pool
        ) as ranked
        order by ranked.rider_rank;
      end if;

      perform public.sync_international_championship_lineup(
        v_nation_selection_id
      );
    end loop;
  end loop;

  return v_created;
end;
$$;

revoke all
on function public.prepare_upcoming_continental_championship_selections_s2(timestamptz)
from public, anon, authenticated;

grant execute
on function public.prepare_upcoming_continental_championship_selections_s2(timestamptz)
to service_role;

create or replace function public.process_due_international_championship_selections(
  p_now timestamptz default now()
)
returns table (
  created_nation_selections integer,
  finalized_nation_selections integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_world_created integer := 0;
  v_continental_created integer := 0;
  v_result record;
begin
  v_world_created :=
    public.prepare_upcoming_world_championship_selections(p_now);
  v_continental_created :=
    public.prepare_upcoming_continental_championship_selections_s2(p_now);

  select *
  into v_result
  from public.process_due_international_selections_j4_base(p_now);

  return query
  select
    v_world_created
      + v_continental_created
      + coalesce(v_result.created_nation_selections, 0),
    coalesce(v_result.finalized_nation_selections, 0);
end;
$$;

revoke all
on function public.process_due_international_championship_selections(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_international_championship_selections(timestamptz)
to service_role;

comment on table public.international_championship_nation_selections is
  'Top 30 mondial figé à J-4 ; top 20 par continent figé à H-24. À partir de la S2, les CC utilisent des sélections nationales spécialisées selon le profil.';

update public.season_events
set description = 'Les 20 meilleures nations de chaque continent sélectionnent huit coureurs à H-24. Dès la S2, les sélections sont spécialisées selon le profil et courent sous leurs couleurs nationales.'
where event_type = 'continental_championships';

commit;
