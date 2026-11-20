begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

-- Probe the unique result keys (edition, final_rank) and (stage, rank).
-- The only stage results read beyond rank one are those used to time the
-- teams in a team time trial.
create view private.pantheon_victories as
with senior_wins as (
  select result.id, edition.id as edition_id, result.race_roster_id, null::uuid as registration_id,
    case when race.race_format = 'stage_race' then 'general' else 'race' end as kind,
    null::smallint as stage_number, null::text as stage_name, result.created_at as won_at
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.race_results as result on result.race_edition_id = edition.id
    and result.final_rank = 1 and result.status = 'classified'
  where edition.status = 'completed'
    and not exists (
      select 1
      from public.stages as stage
      where stage.race_edition_id = edition.id
        and stage.stage_type = 'team_time_trial'
        and race.race_format = 'one_day'
    )

  union all

  select result.id, edition.id, result.race_roster_id, null::uuid, 'stage',
    stage.stage_number, stage.name, result.created_at
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.races as race on race.id = edition.race_id
  join public.stage_results as result on result.stage_id = stage.id
    and result.rank = 1 and result.status = 'finished'
  where stage.status = 'completed' and stage.stage_type <> 'team_time_trial'
    and edition.status <> 'cancelled' and race.race_format = 'stage_race'

  union all

  select stage.id, stage.race_edition_id, null::uuid, winner.registration_id, 'team',
    stage.stage_number, stage.name, stage.created_at
  from public.stages as stage
  cross join lateral (
    select riders.registration_id
    from (
      select roster.race_registration_id as registration_id, result.elapsed_time_ms,
        row_number() over team as rider_number, count(*) over team as team_size
      from public.stage_results as result
      join public.race_rosters as roster on roster.id = result.race_roster_id
      where result.stage_id = stage.id and result.status = 'finished'
        and result.elapsed_time_ms is not null
      window team as (
        partition by roster.race_registration_id
        order by result.elapsed_time_ms, result.id rows between unbounded preceding and unbounded following
      )
    ) as riders
    join public.race_registrations as registration on registration.id = riders.registration_id
    left join public.team_seasons as team_season on team_season.id = registration.team_season_id
    where riders.rider_number = least(riders.team_size, greatest(4, riders.team_size - 3))
    order by riders.elapsed_time_ms,
      coalesce(team_season.display_name, registration.historical_team_name),
      coalesce(team_season.team_id, registration.id)
    limit 1
  ) as winner
  where stage.status = 'completed' and stage.stage_type = 'team_time_trial'
)
select
  victory.id,
  race.slug as race_key,
  edition.display_name as race_name,
  case when season.status = 'active' then
    '/jeu/resultats/' || race.slug ||
    case when victory.stage_number is not null then '/' || victory.stage_number else '' end
  end as result_href,
  season.name as season_name,
  season.game_year,
  case when prestige.is_top_event then 'grand_tour_monument' else category.code end as category,
  victory.kind,
  victory.stage_name,
  rider.id as rider_id,
  rider.id::text as rider_key,
  coalesce(archive.first_name || ' ' || archive.last_name, rider.first_name || ' ' || rider.last_name) as rider_name,
  coalesce(archive.country_code, country.iso_alpha2) as country_code,
  coalesce(team_season.display_name, registration.historical_team_name) as team_name,
  coalesce(archive.rider_id is not null or rider.status = 'retired', false) as retired,
  case when prestige.is_top_event then 14 else greatest(1, 7 - category.prestige_rank) *
    case when victory.kind = 'stage' or (victory.kind = 'team' and race.race_format = 'stage_race') then 1 else 2 end
  end as points,
  victory.won_at
from senior_wins as victory
join public.race_editions as edition on edition.id = victory.edition_id
join public.races as race on race.id = edition.race_id
join public.race_categories as category on category.id = edition.race_category_id
join public.seasons as season on season.id = edition.season_id
left join public.race_rosters as roster on roster.id = victory.race_roster_id
join public.race_registrations as registration on registration.id = coalesce(roster.race_registration_id, victory.registration_id)
  and registration.race_edition_id = edition.id
left join public.team_seasons as team_season on team_season.id = registration.team_season_id
left join public.riders as rider on rider.id = roster.rider_id
left join public.countries as country on country.id = rider.country_id
left join public.rider_history_archives as archive on archive.rider_id = rider.id
cross join lateral (select
  (victory.kind = 'general' and race.is_grand_tour)
    or (victory.kind = 'race' and race.is_monument) as is_top_event
) as prestige
where edition.status <> 'cancelled'

union all

select
  result.id,
  'junior:' || edition.slug,
  edition.name,
  null::text,
  season.name,
  season.game_year,
  'junior',
  case when result.result_scope = 'stage' then 'stage'
    when edition.race_format = 'stage_race' then 'general'
    else 'race' end,
  stage.name,
  rider.id,
  coalesce(rider.id::text, 'academy:' || result.academy_rider_id::text,
    case when result.competitor_key ~ '^virtual:[0-9]+$'
      then 'junior:' || edition.id::text || ':' || result.competitor_key
      else 'junior:' || result.competitor_key
    end),
  coalesce(archive.first_name || ' ' || archive.last_name, rider.first_name || ' ' || rider.last_name, result.rider_name),
  coalesce(archive.country_code, country.iso_alpha2, result.country_code),
  result.team_name,
  coalesce(archive.rider_id is not null or rider.status = 'retired', false),
  case when result.result_scope = 'stage' then 1 else 2 end,
  result.created_at
from public.development_race_editions as edition
join public.seasons as season on season.id = edition.season_id
join public.development_race_results as result on result.race_edition_id = edition.id and result.rank = 1
left join public.development_race_stages as stage on stage.id = result.stage_id
left join public.youth_academy_riders as academy on academy.id = result.academy_rider_id
left join public.riders as rider on rider.id = academy.promoted_rider_id
left join public.countries as country on country.id = rider.country_id
left join public.rider_history_archives as archive on archive.rider_id = rider.id
where (result.result_scope = 'general' and edition.status = 'completed')
  or (result.result_scope = 'stage' and edition.status <> 'cancelled' and edition.race_format = 'stage_race');

revoke all on private.pantheon_victories from public, anon, authenticated;

create function public.get_pantheon_winners(
  p_category text default 'all',
  p_query text default '',
  p_page integer default 1,
  p_season integer default null,
  p_race_key text default null,
  p_kind text default 'all'
)
returns jsonb
language sql stable security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  with matching as materialized (
    select victory.*
    from private.pantheon_victories as victory
    where (coalesce(p_category, 'all') = 'all' or victory.category = p_category)
      and (coalesce(p_kind, 'all') = 'all' or victory.kind = p_kind)
      and (p_season is null or victory.game_year = p_season)
      and (p_race_key is null or victory.race_key = p_race_key)
      and strpos(lower(concat_ws(' ', victory.race_name, victory.rider_name, victory.team_name)),
        lower(left(btrim(coalesce(p_query, '')), 100))) > 0
  ),
  page as (
    select *
    from matching
    order by game_year desc, won_at desc, id
    offset ((greatest(1, coalesce(p_page, 1)) - 1)::bigint * 25)
    limit 25
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) - 'won_at' order by game_year desc, won_at desc, id) from page), '[]'),
    'total', (select count(*) from matching),
    'race_name', (select race_name from matching order by game_year desc, won_at desc, id limit 1),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object('game_year', game_year, 'season_name', name) order by game_year desc)
      from public.seasons
      where status in ('active', 'completed')
    ), '[]')
  );
$$;

create function public.get_pantheon_ranking(
  p_category text default 'all',
  p_query text default '',
  p_page integer default 1,
  p_sort text default 'prestige'
)
returns jsonb
language sql stable security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  with category_counts as (
    select rider_key, rider_id, max(rider_name) as rider_name, max(country_code) as country_code,
      bool_or(retired) as retired, category, count(*) as wins, sum(points) as points
    from private.pantheon_victories
    where kind <> 'team' and rider_key is not null
    group by rider_key, rider_id, category
  ),
  riders as (
    select rider_key, rider_id,
      max(rider_name) as rider_name, max(country_code) as country_code, bool_or(retired) as retired,
      sum(wins) filter (where coalesce(p_category, 'all') = 'all' or category = p_category) as wins,
      sum(points) filter (where coalesce(p_category, 'all') = 'all' or category = p_category) as points,
      jsonb_object_agg(category, wins) as category_wins
    from category_counts
    group by rider_key, rider_id
  ),
  ranked as (
    select riders.*, rank() over (order by
      case when p_sort = 'wins' then wins end desc,
      case when p_sort = 'points' then points end desc,
      case when p_sort is distinct from 'wins' and p_sort is distinct from 'points' and coalesce(p_category, 'all') = 'all'
        then array[
          coalesce((category_wins ->> 'grand_tour_monument')::bigint, 0),
          coalesce((category_wins ->> 'elite')::bigint, 0),
          coalesce((category_wins ->> 'world')::bigint, 0),
          coalesce((category_wins ->> 'continental')::bigint, 0),
          coalesce((category_wins ->> 'national')::bigint, 0),
          coalesce((category_wins ->> 'regional')::bigint, 0),
          coalesce((category_wins ->> 'local')::bigint, 0),
          coalesce((category_wins ->> 'junior')::bigint, 0)
        ]
      end desc,
      case when coalesce(p_category, 'all') <> 'all' and p_sort is distinct from 'points' then wins end desc,
      points desc, wins desc
    ) as rank
    from riders
    where wins > 0
  ),
  matching as materialized (
    select *
    from ranked
    where strpos(lower(rider_name), lower(left(btrim(coalesce(p_query, '')), 100))) > 0
  ),
  page as (
    select *
    from matching
    order by rank, rider_name, rider_key
    offset ((greatest(1, coalesce(p_page, 1)) - 1)::bigint * 25)
    limit 25
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) order by rank, rider_name, rider_key) from page), '[]'),
    'total', (select count(*) from matching)
  );
$$;

revoke all on function public.get_pantheon_winners(text, text, integer, integer, text, text) from public, anon;
revoke all on function public.get_pantheon_ranking(text, text, integer, text) from public, anon;
grant execute on function public.get_pantheon_winners(text, text, integer, integer, text, text) to authenticated, service_role;
grant execute on function public.get_pantheon_ranking(text, text, integer, text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
