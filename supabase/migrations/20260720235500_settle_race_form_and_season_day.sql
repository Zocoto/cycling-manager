begin;

alter table public.race_rosters
add column starting_form smallint;

alter table public.race_rosters
add constraint race_rosters_starting_form_range
check (starting_form is null or starting_form between 0 and 100);

comment on column public.race_rosters.starting_form is
  'Forme figée au départ de la course afin que le replay reste identique après application du malus post-course.';

create table public.stage_rider_condition_effects (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.stages(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete restrict,
  season_day_id uuid not null references public.season_days(id) on delete restrict,
  form_delta smallint not null,
  form_before smallint not null,
  form_after smallint not null,
  applied_at timestamptz not null default now(),
  constraint stage_rider_condition_effects_unique unique (stage_id, rider_id),
  constraint stage_rider_condition_effects_delta_negative check (form_delta < 0),
  constraint stage_rider_condition_effects_form_before_range check (form_before between 0 and 100),
  constraint stage_rider_condition_effects_form_after_range check (form_after between 0 and 100)
);

create index stage_rider_condition_effects_rider_idx
  on public.stage_rider_condition_effects (rider_id, applied_at desc);

alter table public.stage_rider_condition_effects enable row level security;

create or replace function public.sync_active_season_day()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  synced_day_number integer;
begin
  update public.seasons as season
  set current_day_number = greatest(
    coalesce(season.current_day_number, 1),
    least(
      28,
      greatest(
        1,
        ((now() at time zone 'Europe/Paris')::date - season.starts_on) + 1
      )
    )
  )
  where season.status = 'active'
  returning season.current_day_number::integer into synced_day_number;

  return synced_day_number;
end;
$$;

create or replace function public.settle_finished_race_conditions()
returns table (
  processed_stages integer,
  processed_riders integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage record;
  target_roster record;
  condition_effect_id uuid;
  previous_form integer;
  previous_fatigue integer;
  form_loss integer;
  next_form integer;
  stage_count integer := 0;
  rider_count integer := 0;
  synced_day integer;
begin
  synced_day := public.sync_active_season_day();

  for target_stage in
    select
      stage.id,
      stage.stage_number,
      stage.season_day_id,
      season_day.day_number,
      edition.id as race_edition_id,
      edition.season_id,
      race.race_format
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.season_days as season_day
      on season_day.id = stage.season_day_id
    where stage.status in ('planned', 'in_progress', 'completed')
      and stage.departure_at is not null
      and season_day.day_number <= coalesce(synced_day, 1)
      and now() >= stage.departure_at + make_interval(
        mins => greatest(
          8,
          least(48, round(stage.distance_km / 6.0)::integer)
        )
      )
      and (
        stage.status <> 'completed'
        or exists (
          select 1
          from public.race_registrations as unsettled_registration
          join public.race_rosters as unsettled_roster
            on unsettled_roster.race_registration_id = unsettled_registration.id
           and unsettled_roster.status in ('selected', 'confirmed')
          where unsettled_registration.race_edition_id = edition.id
            and unsettled_registration.status = 'accepted'
            and not exists (
              select 1
              from public.stage_rider_condition_effects as existing_effect
              where existing_effect.stage_id = stage.id
                and existing_effect.rider_id = unsettled_roster.rider_id
            )
        )
      )
    order by season_day.day_number, stage.stage_number
  loop
    for target_roster in
      select
        roster.id as race_roster_id,
        roster.rider_id,
        coalesce(rating.recovery, 50)::integer as recovery
      from public.race_registrations as registration
      join public.race_rosters as roster
        on roster.race_registration_id = registration.id
       and roster.status in ('selected', 'confirmed')
      left join public.rider_season_ratings as rating
        on rating.rider_id = roster.rider_id
       and rating.season_id = target_stage.season_id
      where registration.race_edition_id = target_stage.race_edition_id
        and registration.status = 'accepted'
        and not exists (
          select 1
          from public.stage_results as previous_result
          join public.stages as previous_stage
            on previous_stage.id = previous_result.stage_id
          where previous_result.race_roster_id = roster.id
            and previous_stage.race_edition_id = target_stage.race_edition_id
            and previous_stage.stage_number < target_stage.stage_number
            and previous_result.status in (
              'did_not_finish',
              'disqualified',
              'outside_time_limit'
            )
        )
    loop
      select state.form, state.fatigue
      into previous_form, previous_fatigue
      from public.rider_condition_states as state
      join public.season_days as condition_day
        on condition_day.id = state.season_day_id
      where state.rider_id = target_roster.rider_id
        and condition_day.season_id = target_stage.season_id
        and condition_day.day_number <= target_stage.day_number
      order by condition_day.day_number desc
      limit 1;

      previous_form := coalesce(previous_form, 75);
      previous_fatigue := coalesce(previous_fatigue, 0);
      form_loss := case
        when target_stage.race_format = 'one_day' then 10
        else greatest(
          5,
          round(10 * (1 - target_roster.recovery / 200.0))::integer
        )
      end;
      next_form := greatest(0, previous_form - form_loss);

      update public.race_rosters
      set starting_form = coalesce(starting_form, previous_form)
      where id = target_roster.race_roster_id;

      condition_effect_id := null;
      insert into public.stage_rider_condition_effects (
        stage_id,
        rider_id,
        season_day_id,
        form_delta,
        form_before,
        form_after
      )
      values (
        target_stage.id,
        target_roster.rider_id,
        target_stage.season_day_id,
        -form_loss,
        previous_form,
        next_form
      )
      on conflict (stage_id, rider_id) do nothing
      returning id into condition_effect_id;

      if condition_effect_id is not null then
        insert into public.rider_condition_states (
          rider_id,
          season_day_id,
          form,
          fatigue,
          source
        )
        values (
          target_roster.rider_id,
          target_stage.season_day_id,
          next_form,
          previous_fatigue,
          'race_finish'
        )
        on conflict (rider_id, season_day_id)
        do update set
          form = greatest(
            0,
            public.rider_condition_states.form - form_loss
          ),
          source = 'race_finish',
          updated_at = now();

        rider_count := rider_count + 1;
      end if;
    end loop;

    update public.stages
    set status = 'completed'
    where id = target_stage.id
      and status <> 'completed';

    update public.race_editions as edition
    set status = 'completed'
    where edition.id = target_stage.race_edition_id
      and not exists (
        select 1
        from public.stages as remaining_stage
        where remaining_stage.race_edition_id = edition.id
          and remaining_stage.status not in ('completed', 'cancelled')
      );

    stage_count := stage_count + 1;
  end loop;

  return query
  select stage_count, rider_count, synced_day;
end;
$$;

create or replace function public.get_active_calendar_engaged_riders()
returns table (
  race_edition_id uuid,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  team_id uuid,
  team_name text,
  team_primary_color text,
  team_secondary_color text,
  age integer,
  form integer,
  race_role text,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    rider.id,
    rider.first_name,
    rider.last_name,
    team.id,
    team_season.display_name,
    coalesce(team.amateur_jersey_primary_color, '#176951'),
    coalesce(team.amateur_jersey_secondary_color, '#FFFDF4'),
    coalesce(rating.age, 25)::integer,
    coalesce(roster.starting_form, condition.form, 75)::integer,
    roster.race_role,
    coalesce(rating.mountain, 50)::integer,
    coalesce(rating.hills, 50)::integer,
    coalesce(rating.flat, 50)::integer,
    coalesce(rating.time_trial, 50)::integer,
    coalesce(rating.cobbles, 50)::integer,
    coalesce(rating.sprint, 50)::integer,
    coalesce(rating.acceleration, 50)::integer,
    coalesce(rating.downhill, 50)::integer,
    coalesce(rating.endurance, 50)::integer,
    coalesce(rating.resistance, 50)::integer,
    coalesce(rating.recovery, 50)::integer,
    coalesce(rating.breakaway, 50)::integer,
    coalesce(rating.prologue, 50)::integer
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.teams as team
    on team.id = team_season.team_id
  join public.riders as rider
    on rider.id = roster.rider_id
  left join public.rider_season_ratings as rating
    on rating.rider_id = rider.id
   and rating.season_id = edition.season_id
  left join lateral (
    select state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
     and condition_day.season_id = edition.season_id
    where state.rider_id = rider.id
      and condition_day.day_number <= coalesce(season.current_day_number, 28)
    order by condition_day.day_number desc
    limit 1
  ) as condition on true
  where edition.status <> 'cancelled'
  order by
    edition.id,
    team_season.display_name,
    roster.bib_number nulls last,
    rider.last_name,
    rider.first_name;
$$;

revoke all on function public.sync_active_season_day() from public, anon;
revoke all on function public.settle_finished_race_conditions() from public, anon;
grant execute on function public.sync_active_season_day() to authenticated, service_role;
grant execute on function public.settle_finished_race_conditions() to authenticated, service_role;

do $$
declare
  settlement record;
  bretagne_effect_count integer;
  bretagne_min_delta integer;
  bretagne_max_delta integer;
begin
  select * into settlement
  from public.settle_finished_race_conditions();

  select
    count(effect.id)::integer,
    min(effect.form_delta)::integer,
    max(effect.form_delta)::integer
  into
    bretagne_effect_count,
    bretagne_min_delta,
    bretagne_max_delta
  from public.stage_rider_condition_effects as effect
  join public.stages as stage
    on stage.id = effect.stage_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where race.slug = 'grand-prix-de-bretagne';

  raise notice 'Jour de saison J% synchronisé ; % effets de course appliqués sur % étapes.',
    settlement.current_day_number,
    settlement.processed_riders,
    settlement.processed_stages;
  raise notice 'GP de Bretagne : % coureurs corrigés, malus compris entre % et % points.',
    bretagne_effect_count,
    bretagne_min_delta,
    bretagne_max_delta;
end;
$$;

commit;
