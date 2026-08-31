-- Publish Development Team stage-race results on each stage day instead of
-- waiting for the final day. Final classifications and rewards remain tied to
-- the existing full-race settlement on the edition end day.

begin;

create or replace function public.simulate_development_race_stage(
  p_race_edition_id uuid,
  p_stage_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_edition public.development_race_editions%rowtype;
  v_stage public.development_race_stages%rowtype;
  v_current_day_number integer;
  v_real_count integer;
  v_virtual_count integer;
  v_result_count integer := 0;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('development-race:' || p_race_edition_id::text, 0)
  );

  select * into v_edition
  from public.development_race_editions
  where id = p_race_edition_id
  for update;

  if v_edition.id is null then
    raise exception 'Cette épreuve junior est introuvable.';
  end if;
  if v_edition.status in ('completed', 'cancelled') then
    return 0;
  end if;

  select coalesce(current_day_number, 1)
  into v_current_day_number
  from public.seasons
  where id = v_edition.season_id;

  select * into v_stage
  from public.development_race_stages
  where id = p_stage_id
    and race_edition_id = v_edition.id;

  if v_stage.id is null then
    raise exception 'Cette étape junior est introuvable.';
  end if;
  if v_stage.day_number > v_current_day_number then
    raise exception 'Cette étape junior n’a pas encore été disputée.';
  end if;
  if exists (
    select 1
    from public.development_race_results as result
    where result.race_edition_id = v_edition.id
      and result.stage_id = v_stage.id
      and result.result_scope = 'stage'
  ) then
    return 0;
  end if;

  select count(*)::integer into v_real_count
  from public.development_race_registrations as registration
  join public.development_race_registration_riders as selected
    on selected.registration_id = registration.id
  where registration.race_edition_id = v_edition.id
    and registration.status = 'registered';
  v_virtual_count := greatest(0, 48 - v_real_count);

  create temporary table if not exists pg_temp.development_stage_scores (
    competitor_key text primary key,
    academy_rider_id uuid,
    development_team_id uuid,
    rider_name text not null,
    team_name text not null,
    country_code text not null,
    performance_score numeric not null,
    elapsed_time_seconds integer not null
  ) on commit drop;
  truncate table pg_temp.development_stage_scores;

  insert into pg_temp.development_stage_scores (
    competitor_key, academy_rider_id, development_team_id,
    rider_name, team_name, country_code, performance_score,
    elapsed_time_seconds
  )
  select
    'youth:' || youth.id::text,
    youth.id,
    development_team.id,
    youth.first_name || ' ' || youth.last_name,
    case when v_edition.is_world_championship then country.name
      else development_team.display_name end,
    country.iso_alpha2,
    score.value,
    greatest(300, round(
      (v_stage.distance_km / case
        when v_stage.stage_type = 'individual_time_trial' then 42
        when v_stage.profile_type = 'mountain' then 31
        when v_stage.profile_type = 'cobbles' then 36
        else 39 end) * 3600
      + (8.8 - score.value) * case
        when v_stage.stage_type = 'individual_time_trial' then 42
        else 68 end
    ))::integer
  from public.development_race_registrations as registration
  join public.development_teams as development_team
    on development_team.id = registration.development_team_id
  join public.development_race_registration_riders as selected
    on selected.registration_id = registration.id
  join public.youth_academy_riders as youth
    on youth.id = selected.academy_rider_id
  join public.countries as country on country.id = youth.country_id
  cross join lateral (
    select (
      case v_stage.profile_type
        when 'flat' then youth.flat * .34 + youth.sprint * .26 + youth.acceleration * .18 + youth.endurance * .12 + youth.resistance * .10
        when 'sprint' then youth.sprint * .34 + youth.acceleration * .24 + youth.flat * .18 + youth.resistance * .13 + youth.endurance * .11
        when 'hilly' then youth.hills * .36 + youth.acceleration * .18 + youth.endurance * .17 + youth.resistance * .14 + youth.mountain * .10 + youth.sprint * .05
        when 'mountain' then youth.mountain * .42 + youth.recovery * .18 + youth.endurance * .17 + youth.resistance * .13 + youth.downhill * .10
        when 'cobbles' then youth.cobbles * .39 + youth.flat * .19 + youth.resistance * .18 + youth.endurance * .14 + youth.acceleration * .10
        when 'time_trial' then youth.time_trial * .52 + youth.prologue * .16 + youth.flat * .14 + youth.endurance * .10 + youth.resistance * .08
        else youth.hills * .18 + youth.mountain * .16 + youth.flat * .14 + youth.time_trial * .14 + youth.endurance * .13 + youth.resistance * .10 + youth.acceleration * .08 + youth.recovery * .07
      end
      + (public.development_hash_unit(
          v_edition.id::text || ':' || v_stage.id::text || ':' || youth.id::text
        ) - .5) * .72
    ) as value
  ) as score
  where registration.race_edition_id = v_edition.id
    and registration.status = 'registered';

  insert into pg_temp.development_stage_scores (
    competitor_key, rider_name, team_name, country_code,
    performance_score, elapsed_time_seconds
  )
  select
    'virtual:' || generated.ordinal,
    (array['Luca','Noah','Milan','Arthur','Mateo','Jonas','Oscar','Tomas','Felix','Hugo','Emil','Nils','Tiago','Adam','Sven','Leo'])[
      1 + floor(public.development_hash_unit(
        v_edition.id::text || ':first:' || generated.ordinal
      ) * 16)::integer
    ] || ' ' ||
    (array['Rossi','Van Aertsen','Dubois','Schmidt','Costa','Nielsen','Garcia','Kovac','Novak','Andersson','De Smet','Bianchi','Martin','Müller','Jansen','Silva'])[
      1 + floor(public.development_hash_unit(
        v_edition.id::text || ':last:' || generated.ordinal
      ) * 16)::integer
    ],
    case when v_edition.is_world_championship then
      (array['France','Belgique','Italie','Espagne','Pays-Bas','Danemark','Allemagne','Portugal'])[
        1 + floor(public.development_hash_unit(
          v_edition.id::text || ':nation:' || generated.ordinal
        ) * 8)::integer
      ]
    else
      (array['Alpine Youth','North Sea Academy','Lombardia U19','Iberia Futures','Baltic Talent','Rhine Development'])[
        1 + floor(public.development_hash_unit(
          v_edition.id::text || ':team:' || generated.ordinal
        ) * 6)::integer
      ]
    end,
    (array['FR','BE','IT','ES','NL','DK','DE','PT'])[
      1 + floor(public.development_hash_unit(
        v_edition.id::text || ':nation:' || generated.ordinal
      ) * 8)::integer
    ],
    virtual_score.value,
    greatest(300, round(
      (v_stage.distance_km / case
        when v_stage.stage_type = 'individual_time_trial' then 42
        when v_stage.profile_type = 'mountain' then 31
        when v_stage.profile_type = 'cobbles' then 36
        else 39 end) * 3600
      + (8.8 - virtual_score.value) * case
        when v_stage.stage_type = 'individual_time_trial' then 42
        else 68 end
    ))::integer
  from generate_series(1, v_virtual_count) as generated(ordinal)
  cross join lateral (
    select 4.15
      + public.development_hash_unit(
          v_edition.id::text || ':base:' || generated.ordinal
        ) * 3.45
      + (public.development_hash_unit(
          v_stage.id::text || ':stage:' || generated.ordinal
        ) - .5) * .58 as value
  ) as virtual_score;

  insert into public.development_race_results (
    race_edition_id, stage_id, result_scope, competitor_key,
    academy_rider_id, development_team_id, rider_name, team_name,
    country_code, rank, elapsed_time_seconds, gap_to_winner_seconds, points
  )
  select
    v_edition.id,
    v_stage.id,
    'stage',
    ranked.competitor_key,
    ranked.academy_rider_id,
    ranked.development_team_id,
    ranked.rider_name,
    ranked.team_name,
    ranked.country_code,
    ranked.rank,
    ranked.elapsed_time_seconds,
    ranked.elapsed_time_seconds - min(ranked.elapsed_time_seconds) over (),
    greatest(0, 51 - ranked.rank)
  from (
    select scores.*,
      row_number() over (
        order by scores.elapsed_time_seconds, scores.performance_score desc,
          scores.competitor_key
      )::integer as rank
    from pg_temp.development_stage_scores as scores
  ) as ranked;

  get diagnostics v_result_count = row_count;
  return v_result_count;
end;
$$;

create or replace function public.settle_due_development_races()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season_id uuid;
  v_game_year integer;
  v_current_day_number integer;
  v_edition record;
  v_stage record;
  v_inserted integer;
  v_completed integer := 0;
  v_settled integer := 0;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('settle-due-development-races', 0)
  ) then
    return 0;
  end if;

  select id, game_year, coalesce(current_day_number, 1)
  into v_season_id, v_game_year, v_current_day_number
  from public.seasons
  where status = 'active'
  limit 1;

  if v_season_id is null then return 0; end if;

  if not exists (
    select 1
    from public.development_race_editions
    where season_id = v_season_id
  ) then
    perform public.ensure_development_race_calendar(v_season_id);
  end if;

  -- The final day keeps the existing full settlement so the final general
  -- classification, podium progression, prizes and rankings remain atomic.
  for v_edition in
    select edition.id
    from public.development_race_editions as edition
    where edition.season_id = v_season_id
      and edition.status = 'planned'
      and edition.end_day_number <= v_current_day_number
    order by edition.end_day_number, edition.id
    limit 2
  loop
    perform public.simulate_development_race(v_edition.id);
    v_completed := v_completed + 1;
    v_settled := v_settled + 1;
  end loop;

  -- During a stage race, publish only stages whose own day has elapsed. The
  -- NOT EXISTS guard and the per-edition lock make retries strictly idempotent.
  for v_stage in
    select
      edition.id as race_edition_id,
      stage.id as stage_id
    from public.development_race_editions as edition
    join public.development_race_stages as stage
      on stage.race_edition_id = edition.id
    where edition.season_id = v_season_id
      and edition.status = 'planned'
      and edition.race_format = 'stage_race'
      and edition.end_day_number > v_current_day_number
      and stage.day_number <= v_current_day_number
      and not exists (
        select 1
        from public.development_race_results as result
        where result.race_edition_id = edition.id
          and result.stage_id = stage.id
          and result.result_scope = 'stage'
      )
    order by stage.day_number, edition.id, stage.stage_number
    limit 12
  loop
    v_inserted := public.simulate_development_race_stage(
      v_stage.race_edition_id,
      v_stage.stage_id
    );
    if v_inserted > 0 then
      v_settled := v_settled + 1;
    end if;
  end loop;

  if v_completed > 0 and v_game_year >= 3 then
    perform public.prepare_development_world_selections(v_season_id);
  end if;

  return v_settled;
end;
$$;

revoke all on function public.simulate_development_race_stage(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.simulate_development_race_stage(uuid, uuid)
  to service_role;

revoke all on function public.settle_due_development_races()
  from public, anon, authenticated;
grant execute on function public.settle_due_development_races()
  to service_role;

comment on function public.simulate_development_race_stage(uuid, uuid) is
  'Publie une étape DevTeam échue de façon déterministe et idempotente, sans attribuer les récompenses du classement final.';
comment on function public.settle_due_development_races() is
  'Publie quotidiennement les étapes DevTeam échues, puis clôture atomiquement chaque épreuve le jour de son arrivée.';

-- Immediately catch up any stages already elapsed in the active season.
select public.settle_due_development_races();

notify pgrst, 'reload schema';

commit;
