begin;
-- Les convocations mondiales deviennent officielles quatre jours avant le
-- depart. Les championnats continentaux conservent leur moteur historique.
create or replace function public.prepare_upcoming_world_championship_selections(
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
      stage.departure_at
    from public.race_editions as edition
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'world_championship'
    join lateral (
      select min(stage.departure_at) as departure_at
      from public.stages as stage
      where stage.race_edition_id = edition.id
    ) as stage on true
    where edition.status not in ('completed', 'cancelled')
      and stage.departure_at is not null
      and stage.departure_at > p_now
      and stage.departure_at <= p_now + interval '4 days'
    order by stage.departure_at, edition.id
  loop
    if exists (
      select 1
      from public.international_championship_nation_selections as existing
      where existing.race_edition_id = v_championship.race_edition_id
    ) then
      continue;
    end if;

    for v_nation in
      with nation_points as (
        select
          country.id as country_id,
          country.name as country_name,
          sum(coalesce(summary.points, 0))::integer as points
        from public.countries as country
        join public.riders as rider
          on rider.country_id = country.id
         and rider.status = 'active'
        join public.rider_season_summaries as summary
          on summary.rider_id = rider.id
         and summary.season_id = v_championship.season_id
        group by country.id, country.name
        having sum(coalesce(summary.points, 0)) > 0
      ),
      ranked as (
        select
          nation_points.*,
          row_number() over (
            order by
              nation_points.points desc,
              nation_points.country_name,
              nation_points.country_id
          ) as nation_rank
        from nation_points
      )
      select *
      from ranked
      where nation_rank <= 20
      order by nation_rank
    loop
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
      returning id into v_nation_selection_id;

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
        ranked_riders.overall_rating,
        case
          when ranked_riders.is_injured then 'ineligible_injury'
          when ranked_riders.team_id is null then 'unavailable'
          else 'pending'
        end
      from (
        select
          rider.id as rider_id,
          ownership.team_id,
          ownership.sporting_director_id,
          coalesce(summary.points, 0)::integer as uci_points,
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
          ) as overall_rating,
          exists (
            select 1
            from public.rider_injuries as injury
            where injury.rider_id = rider.id
              and injury.status = 'active'
              and injury.started_at < v_championship.departure_at
              and injury.expected_recovery_at > v_championship.departure_at
          ) as is_injured,
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
          ) as rider_rank
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
      ) as ranked_riders
      order by ranked_riders.rider_rank;

      -- Le trigger CLM reclasse d'abord les candidats selon leurs qualites
      -- chrono, puis cette synchronisation retient exactement huit titulaires.
      perform public.sync_international_championship_lineup(
        v_nation_selection_id
      );
      v_created := v_created + 1;
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
-- Une fois les huit coureurs CLM annonces, leur convocation ne doit plus
-- changer silencieusement si une note d'entrainement evolue avant le depart.
alter function public.rerank_world_time_trial_selection(uuid)
rename to rerank_world_time_trial_selection_unfrozen;
revoke all
on function public.rerank_world_time_trial_selection_unfrozen(uuid)
from public, anon, authenticated;
create or replace function public.rerank_world_time_trial_selection(
  p_nation_selection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = p_nation_selection_id
      and candidate.selected_at is not null
  ) then
    return false;
  end if;

  return public.rerank_world_time_trial_selection_unfrozen(
    p_nation_selection_id
  );
end;
$$;
revoke all
on function public.rerank_world_time_trial_selection(uuid)
from public, anon, authenticated;
grant execute
on function public.rerank_world_time_trial_selection(uuid)
to service_role;
-- Le moteur existant continue de finaliser les selections et de traiter les
-- championnats continentaux. Le pre-traitement J-4 ne concerne que les CM.
alter function public.process_due_international_championship_selections(timestamptz)
rename to process_due_international_selections_j4_base;
revoke all
on function public.process_due_international_selections_j4_base(timestamptz)
from public, anon, authenticated;
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
  v_early_created integer := 0;
  v_result record;
begin
  v_early_created :=
    public.prepare_upcoming_world_championship_selections(p_now);

  select *
  into v_result
  from public.process_due_international_selections_j4_base(p_now);

  return query
  select
    v_early_created + coalesce(v_result.created_nation_selections, 0),
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
  'Top 20 des nations fige a J-4 pour les Mondiaux et a H-24 pour les championnats continentaux.';
update public.season_events
set description = 'Le CLM mondial se dispute a 14 h, puis la course en ligne a 18 h. Les 20 meilleures nations selectionnent automatiquement huit coureurs et les DS concernes sont avertis quatre jours avant.'
where event_type = 'world_championships';
notify pgrst, 'reload schema';
commit;
