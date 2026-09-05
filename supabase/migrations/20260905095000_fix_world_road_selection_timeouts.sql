begin;

-- Les Mondiaux CLM et en ligne entrent dans la fenetre J-4 a des heures
-- differentes. Ne jamais recalculer les listes deja publiees permet au second
-- appel de rester sous le delai SQL et rend toute reprise idempotente.
create or replace function public.prepare_upcoming_world_championship_selections(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '240s'
as $$
declare
  v_championship record;
  v_nation record;
  v_nation_selection_id uuid;
  v_created integer := 0;
  v_selection_created boolean;
  v_existing_nation_count integer;
  v_incomplete_nation_count integer;
  v_inserted_candidate_count integer;
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
      race.slug,
      stage.departure_at,
      stage.is_time_trial
    from public.race_editions as edition
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'world_championship'
    join lateral (
      select
        min(stage.departure_at) as departure_at,
        bool_or(stage.stage_type = 'individual_time_trial') as is_time_trial
      from public.stages as stage
      where stage.race_edition_id = edition.id
    ) as stage on true
    where edition.status not in ('completed', 'cancelled')
      and stage.departure_at is not null
      and stage.departure_at <= p_now + interval '4 days'
    order by stage.departure_at, edition.id
  loop
    select
      count(*)::integer,
      count(*) filter (
        where not exists (
          select 1
          from public.international_championship_rider_selections as candidate
          where candidate.nation_selection_id = existing.id
        )
      )::integer
    into
      v_existing_nation_count,
      v_incomplete_nation_count
    from public.international_championship_nation_selections as existing
    where existing.race_edition_id = v_championship.race_edition_id;

    -- Une edition deja publiee est gelee a J-4. La retraiter a chaque passage
    -- doublait le travail lorsque la course en ligne entrait dans la fenetre
    -- quatre heures apres le CLM et faisait expirer toute la transaction.
    if v_existing_nation_count >= 30
       and v_incomplete_nation_count = 0 then
      continue;
    end if;

    for v_nation in
      with nation_points as (
        select
          country.id as country_id,
          country.name as country_name,
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
        group by country.id, country.name
      ),
      ranked as (
        select
          nation_points.*,
          row_number() over (
            order by
              nation_points.points desc,
              nation_points.rating_strength desc,
              nation_points.active_riders desc,
              nation_points.country_name,
              nation_points.country_id
          ) as nation_rank
        from nation_points
      )
      select *
      from ranked
      where nation_rank <= 30
      order by nation_rank
    loop
      v_nation_selection_id := null;
      v_selection_created := false;
      v_inserted_candidate_count := 0;

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
        null,
        v_nation.nation_rank,
        v_nation.points,
        p_now
      )
      on conflict (race_edition_id, country_id) do nothing
      returning id into v_nation_selection_id;

      if v_nation_selection_id is not null then
        v_selection_created := true;
      else
        select selection.id
        into v_nation_selection_id
        from public.international_championship_nation_selections as selection
        where selection.race_edition_id = v_championship.race_edition_id
          and selection.country_id = v_nation.country_id;
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
          ranked_riders.rider_id,
          ranked_riders.team_id,
          ranked_riders.sporting_director_id,
          ranked_riders.rider_rank,
          ranked_riders.uci_points,
          case
            when v_championship.is_time_trial
              then ranked_riders.time_trial_rating
            else ranked_riders.general_rating
          end,
          case
            when ranked_riders.is_injured then 'ineligible_injury'
            when ranked_riders.team_id is null then 'unavailable'
            else 'pending'
          end
        from (
          select
            rider_pool.*,
            row_number() over (
              order by
                case
                  when v_championship.is_time_trial
                    then rider_pool.time_trial_rating
                end desc nulls last,
                case
                  when not v_championship.is_time_trial
                    then rider_pool.uci_points
                end desc nulls last,
                case
                  when v_championship.is_time_trial
                    then rider_pool.time_trial
                end desc nulls last,
                case
                  when v_championship.is_time_trial
                    then rider_pool.endurance
                end desc nulls last,
                case
                  when v_championship.is_time_trial
                    then rider_pool.flat
                end desc nulls last,
                rider_pool.general_rating desc,
                rider_pool.last_name,
                rider_pool.first_name,
                rider_pool.rider_id
            )::integer as rider_rank
          from (
            select
              rider.id as rider_id,
              rider.first_name,
              rider.last_name,
              ownership.team_id,
              ownership.sporting_director_id,
              coalesce(summary.points, 0)::integer as uci_points,
              rating.time_trial,
              rating.endurance,
              rating.flat,
              round(
                (
                  rating.time_trial * 0.55
                  + rating.endurance * 0.18
                  + rating.flat * 0.12
                  + rating.prologue * 0.05
                  + rating.resistance * 0.05
                  + rating.recovery * 0.05
                )::numeric,
                2
              ) as time_trial_rating,
              round(
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
                )::numeric / 13,
                2
              ) as general_rating,
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
          ) as rider_pool
        ) as ranked_riders
        order by ranked_riders.rider_rank;

        get diagnostics v_inserted_candidate_count = row_count;
      end if;

      -- Les listes deja completes ne sont plus reclassees ni resynchronisees.
      -- Une reprise apres incident ne paie donc que le cout des listes absentes.
      if v_selection_created or v_inserted_candidate_count > 0 then
        perform public.rerank_world_time_trial_selection(
          v_nation_selection_id
        );
        perform public.sync_international_championship_lineup(
          v_nation_selection_id
        );
      end if;

      if v_selection_created then
        v_created := v_created + 1;
      end if;
    end loop;
  end loop;

  return v_created;
end;
$$;

revoke all
on function public.prepare_upcoming_world_championship_selections(timestamptz)
from public, anon, authenticated;

grant execute
on function public.prepare_upcoming_world_championship_selections(timestamptz)
to service_role;

-- Curatif : publier immediatement toute edition mondiale actuellement due.
-- Le delai de migration, defini avant l'appel, evite de reproduire le timeout
-- ayant annule les tentatives automatiques de la course en ligne.
set local statement_timeout = '5min';

do $world_selection_repair$
declare
  v_created integer;
begin
  select public.prepare_upcoming_world_championship_selections(now())
  into v_created;

  raise notice
    'world_championship_selection_repair_created=%',
    coalesce(v_created, 0);
end;
$world_selection_repair$;

commit;
