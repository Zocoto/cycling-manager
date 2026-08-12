begin;
-- Les Mondiaux accueillent les 30 meilleures nations UCI. La contrainte
-- historique limitait physiquement le classement a 20.
alter table public.international_championship_nation_selections
  drop constraint if exists international_nation_selection_rank_range;
alter table public.international_championship_nation_selections
  add constraint international_nation_selection_rank_range
  check (nation_rank between 1 and 30);
-- Les deux epreuves mondiales sont programmees le meme jour dans le jeu.
-- Elles constituent deux creneaux distincts : un coureur peut donc disputer
-- le CLM a 14 h puis la course en ligne a 18 h.
create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_target_competition_type text;
  v_conflicting_race_name text;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select
    registration.race_edition_id,
    race.competition_type
  into
    v_target_edition_id,
    v_target_competition_type
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where registration.id = new.race_registration_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.rider_id::text, 0)
  );

  select other_edition.display_name
  into v_conflicting_race_name
  from public.race_rosters as other_roster
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.id <> v_target_edition_id
  join public.races as other_race
    on other_race.id = other_edition.race_id
  where other_roster.rider_id = new.rider_id
    and other_roster.status in ('selected', 'confirmed')
    and not (
      v_target_competition_type = 'world_championship'
      and other_race.competition_type = 'world_championship'
    )
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_target_edition_id
    )
  limit 1;

  if v_conflicting_race_name is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur est deja reserve pour %s sur le meme creneau.',
        v_conflicting_race_name
      );
  end if;

  return new;
end;
$$;
-- Les Mondiaux sont prioritaires sur les courses ordinaires du meme jour,
-- mais le CLM ne doit pas retirer le coureur de la course en ligne (et
-- reciproquement).
create or replace function public.prioritize_international_championship_rider_base(
  p_nation_selection_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_target_start_day integer;
  v_target_end_day integer;
  v_target_competition_type text;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id;

  if not found then
    return;
  end if;

  select race.competition_type
  into v_target_competition_type
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  where edition.id = v_selection.race_edition_id;

  select min(day.day_number), max(day.day_number)
  into v_target_start_day, v_target_end_day
  from public.stages as stage
  join public.season_days as day
    on day.id = stage.season_day_id
  where stage.race_edition_id = v_selection.race_edition_id;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as other_edition,
       public.races as other_race
  where registration.id = roster.race_registration_id
    and other_edition.id = registration.race_edition_id
    and other_race.id = other_edition.race_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.status = 'accepted'
    and other_edition.id <> v_selection.race_edition_id
    and not (
      v_target_competition_type = 'world_championship'
      and other_race.competition_type = 'world_championship'
    )
    and exists (
      select 1
      from public.stages as other_stage
      join public.season_days as other_day
        on other_day.id = other_stage.season_day_id
      where other_stage.race_edition_id = other_edition.id
        and other_day.day_number between v_target_start_day and v_target_end_day
        and other_day.season_id = (
          select edition.season_id
          from public.race_editions as edition
          where edition.id = v_selection.race_edition_id
        )
    );

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id <> v_selection.race_edition_id
    and registration.status = 'accepted'
    and exists (
      select 1
      from public.race_rosters as affected_roster
      where affected_roster.race_registration_id = registration.id
        and affected_roster.rider_id = p_rider_id
        and affected_roster.status = 'withdrawn'
    )
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and camp.start_day_number <= v_target_end_day
    and camp.end_day_number >= v_target_start_day
    and camp.season_id = (
      select edition.season_id
      from public.race_editions as edition
      where edition.id = v_selection.race_edition_id
    );
end;
$$;
revoke all
on function public.prioritize_international_championship_rider_base(uuid, uuid)
from public, anon, authenticated;
-- La priorisation doit preceder l'insertion dans la startlist. L'ancien ordre
-- tentait d'abord l'insertion et declenchait la contrainte de chevauchement,
-- annulant toute la transaction de selection.
create or replace function public.sync_international_championship_lineup(
  p_nation_selection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_candidate record;
  v_team_season_id uuid;
  v_registration_id uuid;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id
  for update;

  if not found then
    return;
  end if;

  with eligible as (
    select
      candidate.id,
      row_number() over (
        order by candidate.rider_rank, candidate.rider_id
      ) as eligible_rank
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  )
  update public.international_championship_rider_selections as candidate
  set
    is_selected = coalesce(eligible.eligible_rank <= 8, false),
    selected_at = case
      when eligible.eligible_rank <= 8
        then coalesce(candidate.selected_at, now())
      else candidate.selected_at
    end
  from eligible
  where candidate.id = eligible.id;

  update public.international_championship_rider_selections as candidate
  set is_selected = false
  where candidate.nation_selection_id = v_selection.id
    and candidate.response_status in (
      'declined',
      'ineligible_injury',
      'unavailable'
    );

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.international_championship_rider_selections as candidate
  where registration.id = roster.race_registration_id
    and registration.race_edition_id = v_selection.race_edition_id
    and candidate.nation_selection_id = v_selection.id
    and candidate.rider_id = roster.rider_id
    and candidate.is_selected = false
    and roster.status in ('selected', 'confirmed');

  for v_candidate in
    select candidate.*
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
    order by candidate.rider_rank
  loop
    select team_season.id
    into v_team_season_id
    from public.race_editions as edition
    join public.team_seasons as team_season
      on team_season.season_id = edition.season_id
     and team_season.team_id = v_candidate.team_id
     and team_season.status in ('planned', 'active')
    where edition.id = v_selection.race_edition_id
    limit 1;

    if v_team_season_id is null then
      update public.international_championship_rider_selections
      set
        response_status = 'unavailable',
        is_selected = false
      where id = v_candidate.id;
      continue;
    end if;

    begin
    perform public.prioritize_international_championship_rider(
      v_selection.id,
      v_candidate.rider_id
    );

    insert into public.race_registrations (
      race_edition_id,
      team_season_id,
      entry_method,
      status,
      registered_at,
      decided_at
    )
    values (
      v_selection.race_edition_id,
      v_team_season_id,
      'automatic',
      'accepted',
      now(),
      now()
    )
    on conflict (race_edition_id, team_season_id)
    do update set
      entry_method = 'automatic',
      status = 'accepted',
      registered_at = coalesce(
        public.race_registrations.registered_at,
        excluded.registered_at
      ),
      decided_at = excluded.decided_at
    returning id into v_registration_id;

    insert into public.race_rosters (
      race_registration_id,
      rider_id,
      race_role,
      status,
      selected_at
    )
    values (
      v_registration_id,
      v_candidate.rider_id,
      'auto',
      'confirmed',
      now()
    )
    on conflict (race_registration_id, rider_id)
    do update set
      race_role = 'auto',
      status = 'confirmed',
      selected_at = excluded.selected_at;
    exception
      when sqlstate 'P0001' then
        update public.international_championship_rider_selections
        set
          response_status = case
            when position('bless' in lower(sqlerrm)) > 0
              then 'ineligible_injury'
            else 'unavailable'
          end,
          is_selected = false
        where id = v_candidate.id;
    end;
  end loop;

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id = v_selection.race_edition_id
    and registration.entry_method = 'automatic'
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  if (
    select count(*)
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
  ) < 8 and exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = false
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  ) then
    perform public.sync_international_championship_lineup(v_selection.id);
  end if;
end;
$$;
revoke all
on function public.sync_international_championship_lineup(uuid)
from public, anon, authenticated;
grant execute
on function public.sync_international_championship_lineup(uuid)
to service_role;
-- Le CLM de 48 km privilegie une combinaison de CLM, endurance et plat,
-- completee par le prologue, la resistance et la recuperation. Les points UCI
-- ne servent plus a choisir les titulaires d'une nation pour cette epreuve.
create or replace function public.rerank_world_time_trial_selection(
  p_nation_selection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.international_championship_nation_selections as selection
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.races as race
      on race.id = edition.race_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
    where selection.id = p_nation_selection_id
      and race.slug = 'championnats-du-monde-contre-la-montre'
      and stage.stage_type = 'individual_time_trial'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = p_nation_selection_id
      and candidate.selected_at is not null
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = p_nation_selection_id
  ) then
    return false;
  end if;

  update public.international_championship_rider_selections
  set rider_rank = rider_rank + 10000
  where nation_selection_id = p_nation_selection_id;

  with ranked as (
    select
      candidate.id,
      row_number() over (
        order by
          (
            rating.time_trial * 0.55
            + rating.endurance * 0.18
            + rating.flat * 0.12
            + rating.prologue * 0.05
            + rating.resistance * 0.05
            + rating.recovery * 0.05
          ) desc,
          rating.time_trial desc,
          rating.endurance desc,
          rating.flat desc,
          rider.last_name,
          rider.first_name,
          rider.id
      )::integer as new_rank,
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
      ) as time_trial_rating
    from public.international_championship_rider_selections as candidate
    join public.international_championship_nation_selections as selection
      on selection.id = candidate.nation_selection_id
    join public.race_editions as edition
      on edition.id = selection.race_edition_id
    join public.riders as rider
      on rider.id = candidate.rider_id
    join public.rider_season_ratings as rating
      on rating.rider_id = rider.id
     and rating.season_id = edition.season_id
    where candidate.nation_selection_id = p_nation_selection_id
  )
  update public.international_championship_rider_selections as candidate
  set
    rider_rank = ranked.new_rank,
    overall_rating = ranked.time_trial_rating
  from ranked
  where candidate.id = ranked.id;

  return true;
end;
$$;
revoke all
on function public.rerank_world_time_trial_selection(uuid)
from public, anon, authenticated;
grant execute
on function public.rerank_world_time_trial_selection(uuid)
to service_role;
-- Cree les selections manquantes individuellement. L'ancien moteur annulait
-- toute la transaction au premier coureur deja engage et ignorait les pays
-- sans points courants, ce qui laissait les deux courses completement vides.
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
  v_selection_created boolean;
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
      end if;

      perform public.rerank_world_time_trial_selection(
        v_nation_selection_id
      );
      perform public.sync_international_championship_lineup(
        v_nation_selection_id
      );

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
comment on table public.international_championship_nation_selections is
  'Top 30 des nations UCI fige a J-4 pour les Mondiaux et top 20 a H-24 pour les championnats continentaux.';
update public.season_events
set description = 'Le CLM mondial se dispute a 14 h, puis la course en ligne a 18 h. Les 30 meilleures nations UCI selectionnent automatiquement huit coureurs ; le CLM privilegie les specialistes du chrono.'
where event_type = 'world_championships';
-- Repare immediatement la saison active, y compris le CLM de 14 h deja passe.
do $$
begin
  perform public.process_due_international_championship_selections(now());
end;
$$;
notify pgrst, 'reload schema';
commit;
