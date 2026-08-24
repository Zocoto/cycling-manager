begin;

create or replace function public.calculate_rider_salary_base(
  p_overall numeric
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_overall numeric := least(100, greatest(0, coalesce(p_overall, 0)));
begin
  return case
    when v_overall <= 45 then 6000
    when v_overall <= 50 then 6000 + (v_overall - 45) / 5 * 1000
    when v_overall <= 55 then 7000 + (v_overall - 50) / 5 * 3000
    when v_overall <= 59 then 10000 + (v_overall - 55) / 4 * 4000
    when v_overall <= 60 then 14000 + (v_overall - 59) * 2000
    when v_overall <= 65 then 16000 + (v_overall - 60) / 5 * 9000
    when v_overall <= 70 then 25000 + (v_overall - 65) / 5 * 15000
    when v_overall <= 75 then 40000 + (v_overall - 70) / 5 * 25000
    when v_overall <= 80 then 65000 + (v_overall - 75) / 5 * 40000
    when v_overall <= 85 then 105000 + (v_overall - 80) / 5 * 70000
    when v_overall <= 90 then 175000 + (v_overall - 85) / 5 * 65000
    else 240000 + (v_overall - 90) / 10 * 20000
  end;
end;
$$;

create or replace function public.rider_salary_performance_multiplier(
  p_percentile numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_percentile is null then 0.90
    when least(1, greatest(0, p_percentile)) >= 0.99 then 1.70
    when least(1, greatest(0, p_percentile)) >= 0.95 then 1.50
    when least(1, greatest(0, p_percentile)) >= 0.85 then 1.35
    when least(1, greatest(0, p_percentile)) >= 0.70 then 1.20
    when least(1, greatest(0, p_percentile)) >= 0.50 then 1.10
    when least(1, greatest(0, p_percentile)) >= 0.20 then 1.00
    else 0.90
  end;
$$;

create or replace function public.get_rider_salary_performance_percentiles(
  p_rider_ids uuid[],
  p_season_id uuid
)
returns table (
  rider_id uuid,
  performance_percentile numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with population as (
    select
      rating.rider_id,
      percent_rank() over (
        order by coalesce(summary.points, 0)
      )::numeric as performance_percentile
    from public.rider_season_ratings as rating
    left join public.rider_season_summaries as summary
      on summary.rider_id = rating.rider_id
     and summary.season_id = rating.season_id
    where rating.season_id = p_season_id
  )
  select
    requested.rider_id,
    population.performance_percentile
  from unnest(coalesce(p_rider_ids, array[]::uuid[]))
    as requested(rider_id)
  left join population
    on population.rider_id = requested.rider_id;
$$;

create or replace function public.calculate_rider_season_salary(
  p_rider_id uuid,
  p_season_id uuid
)
returns numeric
language sql
stable
set search_path = ''
as $$
  with target_season as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ),
  previous_season as (
    select season.id
    from public.seasons as season
    cross join target_season
    where season.game_year = target_season.game_year - 1
    limit 1
  ),
  rating as (
    select coalesce((
      select (
        season_rating.mountain + season_rating.hills + season_rating.flat
        + season_rating.time_trial + season_rating.cobbles
        + season_rating.sprint + season_rating.acceleration
        + season_rating.downhill + season_rating.endurance
        + season_rating.resistance + season_rating.recovery
        + season_rating.breakaway + season_rating.prologue
      )::numeric / 13
      from public.rider_season_ratings as season_rating
      join public.seasons as rating_season
        on rating_season.id = season_rating.season_id
      cross join target_season
      where season_rating.rider_id = p_rider_id
        and rating_season.game_year <= target_season.game_year
      order by rating_season.game_year desc
      limit 1
    ), 45) as overall
  ),
  performance as (
    select (
      select quote.performance_percentile
      from previous_season
      cross join lateral
        public.get_rider_salary_performance_percentiles(
          array[p_rider_id],
          previous_season.id
        ) as quote
      limit 1
    ) as performance_percentile
  )
  select round(
    greatest(
      6000,
      least(
        400000,
        public.calculate_rider_salary_base(rating.overall)
          * public.rider_salary_performance_multiplier(
              performance.performance_percentile
            )
      )
    ) / 500
  ) * 500
  from rating
  cross join performance;
$$;

create or replace function public.calculate_rider_season_salary_quotes(
  p_rider_ids uuid[],
  p_season_id uuid
)
returns table (
  rider_id uuid,
  salary_per_season numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with target_season as (
    select season.game_year
    from public.seasons as season
    where season.id = p_season_id
  ),
  previous_season as (
    select season.id
    from public.seasons as season
    cross join target_season
    where season.game_year = target_season.game_year - 1
    limit 1
  ),
  performance_population as (
    select
      rating.rider_id,
      percent_rank() over (
        order by coalesce(summary.points, 0)
      )::numeric as performance_percentile
    from public.rider_season_ratings as rating
    left join public.rider_season_summaries as summary
      on summary.rider_id = rating.rider_id
     and summary.season_id = rating.season_id
    where rating.season_id = (select id from previous_season)
  ),
  requested as (
    select requested_rider.rider_id
    from unnest(coalesce(p_rider_ids, array[]::uuid[]))
      as requested_rider(rider_id)
  ),
  requested_ratings as (
    select
      requested.rider_id,
      coalesce(rating.overall, 45) as overall
    from requested
    cross join target_season
    left join lateral (
      select (
        season_rating.mountain + season_rating.hills + season_rating.flat
        + season_rating.time_trial + season_rating.cobbles
        + season_rating.sprint + season_rating.acceleration
        + season_rating.downhill + season_rating.endurance
        + season_rating.resistance + season_rating.recovery
        + season_rating.breakaway + season_rating.prologue
      )::numeric / 13 as overall
      from public.rider_season_ratings as season_rating
      join public.seasons as rating_season
        on rating_season.id = season_rating.season_id
      where season_rating.rider_id = requested.rider_id
        and rating_season.game_year <= target_season.game_year
      order by rating_season.game_year desc
      limit 1
    ) as rating on true
  )
  select
    requested_ratings.rider_id,
    round(
      greatest(
        6000,
        least(
          400000,
          public.calculate_rider_salary_base(requested_ratings.overall)
            * public.rider_salary_performance_multiplier(
                performance_population.performance_percentile
              )
        )
      ) / 500
    ) * 500 as salary_per_season
  from requested_ratings
  left join performance_population
    on performance_population.rider_id = requested_ratings.rider_id;
$$;

revoke all on function public.get_rider_salary_performance_percentiles(
  uuid[], uuid
) from public, anon, authenticated;
grant execute on function public.get_rider_salary_performance_percentiles(
  uuid[], uuid
) to service_role;

revoke all on function public.calculate_rider_season_salary_quotes(
  uuid[], uuid
) from public, anon, authenticated;
grant execute on function public.calculate_rider_season_salary_quotes(
  uuid[], uuid
) to service_role;

-- Les propositions encore ouvertes et les renouvellements non commencés
-- adoptent immédiatement le nouveau barème. Les contrats actifs déjà payés
-- restent inchangés.
update public.transfer_market_listings as listing
set salary_per_season = public.calculate_rider_season_salary(
  listing.rider_id,
  listing.season_id
)
where listing.status = 'open';

update public.rider_contracts as contract
set salary_per_season = public.calculate_rider_season_salary(
  contract.rider_id,
  contract.start_season_id
)
where contract.status = 'planned'
  and contract.acquisition_type = 'renewal';

comment on function public.calculate_rider_salary_base(numeric) is
  'Interpôle le salaire de référence d’un coureur à partir de sa moyenne générale.';

comment on function public.rider_salary_performance_multiplier(numeric) is
  'Convertit le percentile UCI de la saison précédente en coefficient salarial de 0,90 à 1,70.';

comment on function public.get_rider_salary_performance_percentiles(uuid[], uuid) is
  'Retourne le percentile de points de plusieurs coureurs pour une saison précise.';

comment on function public.calculate_rider_season_salary_quotes(uuid[], uuid) is
  'Calcule en une requête les demandes salariales de plusieurs coureurs pour une saison cible.';

comment on function public.calculate_rider_season_salary(uuid, uuid) is
  'Calcule un salaire de 6 000 à 400 000 euros selon la moyenne et le percentile de résultats de la seule saison précédente.';

notify pgrst, 'reload schema';

commit;
