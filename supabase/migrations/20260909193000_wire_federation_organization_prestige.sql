-- Turn the prestige advertised on the federation race portfolio into a real,
-- rolling input of national-federation renown.

alter table public.national_federation_renown
  drop constraint if exists national_federation_renown_breakdown_range;

alter table public.national_federation_renown
  add constraint national_federation_renown_breakdown_range check (
    uci_history_points between 0 and 600
    and team_legacy_points between 0 and 180
    and rider_legacy_points between 0 and 170
    and hosting_legacy_points between 0 and 100
  );

create or replace function public.refresh_national_federation_renown(
  p_country_id uuid
)
returns public.national_federation_renown
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_game_year integer;
  v_uci_points integer := 0;
  v_team_points integer := 0;
  v_rider_points integer := 0;
  v_hosting_points integer := 0;
  v_result public.national_federation_renown;
begin
  if not exists (
    select 1 from public.countries as country
    where country.id = p_country_id and country.is_active = true
  ) then
    raise exception 'La fédération est introuvable.';
  end if;

  select coalesce(max(season.game_year), 1) into v_game_year
  from public.seasons as season
  where season.status in ('active', 'completed');

  with recent_seasons as (
    select season.id, season.game_year,
      greatest(1, 11 - (v_game_year - season.game_year))::numeric as weight
    from public.seasons as season
    where season.game_year <= v_game_year
      and season.status in ('active', 'completed')
    order by season.game_year desc
    limit 10
  ), country_points as (
    select recent.id as season_id, rider.country_id,
      sum(coalesce(summary.points, 0))::bigint as points
    from recent_seasons as recent
    join public.rider_season_summaries as summary on summary.season_id = recent.id
    join public.riders as rider on rider.id = summary.rider_id
    group by recent.id, rider.country_id
  ), country_ranks as (
    select country_points.season_id, country_points.country_id,
      row_number() over (
        partition by country_points.season_id
        order by country_points.points desc, country_points.country_id
      )::integer as rank
    from country_points
  ), weighted as (
    select recent.weight,
      coalesce(
        greatest(0, 174 - country_ranks.rank)::numeric / 173 * 600,
        0
      ) as score
    from recent_seasons as recent
    left join country_ranks
      on country_ranks.season_id = recent.id
     and country_ranks.country_id = p_country_id
  )
  select least(600, round(
    coalesce(sum(weighted.score * weighted.weight), 0)
    / greatest(1, coalesce(sum(weighted.weight), 0))
  ))::integer into v_uci_points
  from weighted;

  select least(180, coalesce(sum(
    case
      when team_season.final_rank = 1 then 20
      when team_season.final_rank <= 3 then 12
      when team_season.final_rank <= 10 then 5
      else least(3, floor(sqrt(greatest(0, team_season.points)) / 20)::integer)
    end
  ), 0))::integer into v_team_points
  from public.team_seasons as team_season
  where team_season.registration_country_id = p_country_id
    and team_season.status in ('active', 'completed');

  select least(170, coalesce(sum(
    case result.final_rank
      when 1 then greatest(1, 7 - category.prestige_rank) * 4
      when 2 then greatest(1, 7 - category.prestige_rank) * 2
      when 3 then greatest(1, 7 - category.prestige_rank)
      else 0
    end
  ), 0))::integer into v_rider_points
  from public.race_results as result
  join public.race_editions as edition on edition.id = result.race_edition_id
  join public.race_categories as category on category.id = edition.race_category_id
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id
   and rider.country_id = p_country_id
  where result.status = 'classified' and result.final_rank between 1 and 3;

  with organization_events as (
    -- New international hosting awards already carry the exact prestige shown
    -- to the president. Count each award once after financial settlement.
    select
      award.target_game_year as game_year,
      'award:' || award.id::text as event_key,
      award.prestige_gain::integer as points
    from public.national_federation_hosting_awards as award
    where award.country_id = p_country_id
      and award.status = 'settled'
      and award.target_game_year between greatest(1, v_game_year - 4) and v_game_year

    union all

    -- Preserve international events completed before hosting awards existed,
    -- while avoiding a duplicate when an award now represents the same event.
    select
      season.game_year,
      'legacy-pro:' || edition.id::text,
      case when race.competition_type = 'world_championship' then 10 else 6 end
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.seasons as season on season.id = edition.season_id
    where race.country_id = p_country_id
      and race.competition_type in ('world_championship', 'continental_championship')
      and edition.status = 'completed'
      and season.game_year between greatest(1, v_game_year - 4) and v_game_year
      and not exists (
        select 1
        from public.national_federation_hosting_awards as award
        where award.country_id = p_country_id
          and award.target_game_year = season.game_year
          and award.status = 'settled'
          and award.event_type = case race.competition_type
            when 'world_championship' then 'world_championship_pro'
            else 'continental_championship_pro'
          end
      )

    union all

    select distinct
      season.game_year,
      'legacy-junior-nations-cup:' || season.id::text,
      4
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.countries as country
      on country.iso_alpha2 = edition.country_code
     and country.id = p_country_id
    where edition.competition_type = 'nations_cup_junior'
      and edition.status = 'completed'
      and season.game_year between greatest(1, v_game_year - 4) and v_game_year
      and not exists (
        select 1
        from public.national_federation_hosting_awards as award
        where award.country_id = p_country_id
          and award.target_game_year = season.game_year
          and award.status = 'settled'
          and award.event_type = 'nations_cup_junior'
      )

    union all

    select distinct
      season.game_year,
      'legacy-junior-championship:' || season.id::text || ':'
        || case when edition.competition_type like 'world_%'
          then 'world' else coalesce(edition.championship_continent_code, 'continental') end,
      case when edition.competition_type like 'world_%' then 10 else 6 end
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    join public.countries as country
      on country.iso_alpha2 = edition.country_code
     and country.id = p_country_id
    where edition.competition_type in (
      'world_road', 'world_time_trial',
      'continental_road', 'continental_time_trial'
    )
      and edition.status = 'completed'
      and season.game_year between greatest(1, v_game_year - 4) and v_game_year
      and not exists (
        select 1
        from public.national_federation_hosting_awards as award
        where award.country_id = p_country_id
          and award.target_game_year = season.game_year
          and award.status = 'settled'
          and award.event_type = case
            when edition.competition_type like 'world_%'
              then 'world_championship_junior'
            else 'continental_championship_junior'
          end
      )

    union all

    -- Ordinary races now earn exactly the prestige shown in the portfolio:
    -- points per completed stage depend on the edition category.
    select
      season.game_year,
      'national-race:' || edition.id::text,
      count(stage.id)::integer * case category.code
        when 'elite' then 10
        when 'world' then 6
        when 'continental' then 3
        else 0
      end as points
    from public.races as race
    join public.race_editions as edition on edition.race_id = race.id
    join public.seasons as season on season.id = edition.season_id
    join public.race_categories as category on category.id = edition.race_category_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
     and stage.status = 'completed'
    where race.country_id = p_country_id
      and race.competition_type = 'standard'
      and edition.status = 'completed'
      and season.game_year between greatest(1, v_game_year - 4) and v_game_year
    group by season.game_year, edition.id, category.code
  )
  select least(100, coalesce(sum(event.points), 0))::integer
  into v_hosting_points
  from organization_events as event;

  insert into public.national_federation_renown (
    country_id, score, uci_history_points, team_legacy_points,
    rider_legacy_points, hosting_legacy_points,
    source_through_game_year, calculated_at
  ) values (
    p_country_id,
    least(1000, v_uci_points + v_team_points + v_rider_points + v_hosting_points),
    v_uci_points, v_team_points, v_rider_points, v_hosting_points,
    v_game_year, now()
  ) on conflict (country_id) do update set
    score = excluded.score,
    uci_history_points = excluded.uci_history_points,
    team_legacy_points = excluded.team_legacy_points,
    rider_legacy_points = excluded.rider_legacy_points,
    hosting_legacy_points = excluded.hosting_legacy_points,
    source_through_game_year = excluded.source_through_game_year,
    calculated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.refresh_national_federation_renown(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_national_federation_renown(uuid)
  to service_role;

comment on function public.refresh_national_federation_renown(uuid) is
  'Recalcule la renommée, dont le prestige d’organisation réel des cinq dernières saisons (plafond 100).';
