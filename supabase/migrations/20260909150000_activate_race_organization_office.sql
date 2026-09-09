begin;

-- Preserve any existing third-orientation choice while replacing the old,
-- redundant profitability label with the national-market pipeline.
create or replace function public.is_valid_federation_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'national_detection_network' then p_specialization_code in ('territorial_coverage', 'elite_detection', 'profile_diversity')
    when 'national_performance_center' then p_specialization_code in ('altitude_endurance', 'speed_power', 'rolling_engine')
    when 'federal_staff_institute' then p_specialization_code in ('coach_school', 'scout_school', 'medical_school')
    when 'federal_medical_network' then p_specialization_code in ('emergency_network', 'rehab_network', 'prevention_network')
    when 'national_technical_laboratory' then p_specialization_code in ('individual_tt', 'national_ttt', 'equipment_standards')
    when 'race_organization_office' then p_specialization_code in ('prestige_events', 'dense_calendar', 'profitable_events', 'national_pipeline')
    when 'federal_integration_office' then p_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
    when 'home_advantage_program' then p_specialization_code in ('terrain_library', 'climate_lab', 'supporter_roads')
    else false
  end
$$;

update public.national_federation_infrastructure_specializations
set active_specialization_code = case
      when active_specialization_code = 'profitable_events'
        then 'national_pipeline'
      else active_specialization_code
    end,
    pending_specialization_code = case
      when pending_specialization_code = 'profitable_events'
        then 'national_pipeline'
      else pending_specialization_code
    end,
    updated_at = now()
where infrastructure_code = 'race_organization_office'
  and (
    active_specialization_code = 'profitable_events'
    or pending_specialization_code = 'profitable_events'
  );

create or replace function public.is_valid_federation_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'national_detection_network' then p_specialization_code in ('territorial_coverage', 'elite_detection', 'profile_diversity')
    when 'national_performance_center' then p_specialization_code in ('altitude_endurance', 'speed_power', 'rolling_engine')
    when 'federal_staff_institute' then p_specialization_code in ('coach_school', 'scout_school', 'medical_school')
    when 'federal_medical_network' then p_specialization_code in ('emergency_network', 'rehab_network', 'prevention_network')
    when 'national_technical_laboratory' then p_specialization_code in ('individual_tt', 'national_ttt', 'equipment_standards')
    when 'race_organization_office' then p_specialization_code in ('prestige_events', 'dense_calendar', 'national_pipeline')
    when 'federal_integration_office' then p_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
    when 'home_advantage_program' then p_specialization_code in ('terrain_library', 'climate_lab', 'supporter_roads')
    else false
  end
$$;

alter table public.national_federation_infrastructure_specializations
  drop constraint federation_infrastructure_specializations_active_valid;
alter table public.national_federation_infrastructure_specializations
  add constraint federation_infrastructure_specializations_active_valid check (
    public.is_valid_federation_infrastructure_specialization(
      infrastructure_code,
      active_specialization_code
    )
  );
alter table public.national_federation_infrastructure_specializations
  drop constraint federation_infrastructure_specializations_pending_valid;
alter table public.national_federation_infrastructure_specializations
  add constraint federation_infrastructure_specializations_pending_valid check (
    pending_specialization_code is null
    or public.is_valid_federation_infrastructure_specialization(
      infrastructure_code,
      pending_specialization_code
    )
  );

create or replace function public.get_national_federation_race_organization_effects(
  p_country_id uuid
)
returns table (
  office_level integer,
  race_revenue_bonus_percentage numeric,
  hosting_cost_reduction_percentage numeric,
  candidacy_score_bonus_percentage numeric,
  hosting_revenue_bonus_percentage numeric,
  calendar_penalty_per_existing_race integer,
  regional_national_homologation_threshold integer,
  market_nationality_bonus_percentage numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with office as (
    select least(5, greatest(0, infrastructure.level))::integer as level
    from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = p_country_id
      and infrastructure.infrastructure_code = 'race_organization_office'
  ), context as (
    select
      coalesce((select level from office), 0)::integer as level,
      (
        select specialization.active_specialization_code
        from public.national_federation_infrastructure_specializations
          as specialization
        where specialization.country_id = p_country_id
          and specialization.infrastructure_code = 'race_organization_office'
      ) as specialization_code
  )
  select
    context.level,
    context.level * 5,
    case when context.level >= 5 then 10
      when context.level >= 4 then 5 else 0 end,
    case when context.specialization_code = 'prestige_events'
      then case context.level when 3 then 4.8 when 4 then 6.4
        when 5 then 8 else 0 end
      else 0 end,
    case when context.specialization_code = 'prestige_events'
      then case context.level when 3 then 3.6 when 4 then 4.8
        when 5 then 6 else 0 end
      else 0 end,
    case when context.specialization_code = 'dense_calendar'
      then case context.level when 3 then 9 when 4 then 8
        when 5 then 7 else 10 end
      else 10 end,
    case when context.specialization_code = 'dense_calendar'
      then case context.level when 3 then 58 when 4 then 56
        when 5 then 55 else 60 end
      else 60 end,
    case when context.specialization_code = 'national_pipeline'
      then case context.level when 3 then 30 when 4 then 40
        when 5 then 50 else 0 end
      else 0 end
  from context
$$;

revoke all on function public.get_national_federation_race_organization_effects(uuid)
  from public, anon, authenticated;
grant execute on function public.get_national_federation_race_organization_effects(uuid)
  to service_role;

alter table public.national_federation_hosting_candidacies
  add column specialization_bonus_points integer not null default 0;
alter table public.national_federation_hosting_candidacies
  add constraint national_federation_hosting_specialization_bonus_range
    check (specialization_bonus_points between 0 and 100);

-- The ordinary national-race revenue is paid through the following season's
-- opening account. Credit its office bonus in a separate, auditable entry.
create or replace function public.credit_federation_office_race_revenue_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_season_id uuid;
  v_completed_days integer := 0;
  v_completed_editions integer := 0;
  v_starters integer := 0;
  v_average_starters integer := 0;
  v_course_fill_rate numeric := 0;
  v_base_race_revenue numeric := 0;
  v_bonus_percentage numeric := 0;
  v_bonus numeric := 0;
begin
  select season.id into v_source_season_id
  from public.seasons as season
  where season.game_year = new.source_game_year;
  if v_source_season_id is null then return new; end if;

  select
    count(stage.id)::integer,
    count(distinct edition.id)::integer
  into v_completed_days, v_completed_editions
  from public.races as race
  join public.race_editions as edition
    on edition.race_id = race.id
   and edition.season_id = v_source_season_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.status = 'completed'
  where race.country_id = new.country_id
    and race.status = 'active';

  select count(roster.id)::integer into v_starters
  from public.races as race
  join public.race_editions as edition
    on edition.race_id = race.id
   and edition.season_id = v_source_season_id
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where race.country_id = new.country_id
    and race.status = 'active';

  v_average_starters := case when v_completed_editions > 0
    then round(v_starters::numeric / v_completed_editions)::integer else 0 end;
  v_course_fill_rate := least(1, v_average_starters::numeric / 160);
  v_base_race_revenue := round(
    least(40, v_completed_days)
      * (5000 + 12000 * v_course_fill_rate)
      / 1000
  ) * 1000;
  select effects.race_revenue_bonus_percentage
  into v_bonus_percentage
  from public.get_national_federation_race_organization_effects(
    new.country_id
  ) as effects;
  v_bonus := round(
    v_base_race_revenue * coalesce(v_bonus_percentage, 0) / 100 / 1000
  ) * 1000;
  if v_bonus <= 0 then return new; end if;

  update public.national_federation_accounts
  set opening_balance = opening_balance + v_bonus,
      balance = balance + v_bonus,
      updated_at = now()
  where id = new.id;
  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description,
    source_reference, metadata
  ) values (
    new.id, 1, v_bonus, 'race_revenue',
    'Bonus du Bureau d’organisation sur les recettes nationales.',
    'federation-account:' || new.id::text || ':organization-office-race-revenue',
    jsonb_build_object(
      'baseRaceRevenue', v_base_race_revenue,
      'bonusPercentage', v_bonus_percentage,
      'completedRaceDays', v_completed_days,
      'averageStarters', v_average_starters
    )
  ) on conflict (source_reference) do nothing;
  return new;
end;
$$;

drop trigger if exists credit_federation_office_race_revenue_bonus
  on public.national_federation_accounts;
create trigger credit_federation_office_race_revenue_bonus
after insert on public.national_federation_accounts
for each row execute function public.credit_federation_office_race_revenue_bonus();

revoke all on function public.credit_federation_office_race_revenue_bonus()
  from public, anon, authenticated;

-- Make the territorial orientation modify the score shown to the president.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.get_national_federation_race_creation_score(uuid,uuid)'::regprocedure
  ) into v_definition;

  v_patched := replace(
    v_definition,
    $old$  v_calendar_penalty integer := 0;
  v_total integer := 0;$old$,
    $new$  v_calendar_penalty integer := 0;
  v_calendar_penalty_per_race integer := 10;
  v_regional_national_threshold integer := 60;
  v_total integer := 0;$new$
  );
  v_patched := replace(
    v_patched,
    $old$  if v_season.id is null or v_country_code is null then
    raise exception 'La saison ou la fédération est introuvable.';
  end if;

  with country_points as ($old$,
    $new$  if v_season.id is null or v_country_code is null then
    raise exception 'La saison ou la fédération est introuvable.';
  end if;

  select
    effects.calendar_penalty_per_existing_race,
    effects.regional_national_homologation_threshold
  into v_calendar_penalty_per_race, v_regional_national_threshold
  from public.get_national_federation_race_organization_effects(
    p_country_id
  ) as effects;

  with country_points as ($new$
  );
  v_patched := replace(
    v_patched,
    $old$  v_calendar_penalty := v_existing_races * 10;$old$,
    $new$  v_calendar_penalty := v_existing_races * v_calendar_penalty_per_race;$new$
  );
  v_patched := replace(
    v_patched,
    $old$    'existingRaceCount', v_existing_races,
    'calendarPenalty', v_calendar_penalty,
    'total', v_total,
    'threshold', 60,
    'eligible', v_total >= 60$old$,
    $new$    'existingRaceCount', v_existing_races,
    'calendarPenaltyPerRace', v_calendar_penalty_per_race,
    'calendarPenalty', v_calendar_penalty,
    'total', v_total,
    'threshold', v_regional_national_threshold,
    'continentalThreshold', 60,
    'eligible', v_total >= v_regional_national_threshold$new$
  );

  if v_patched = v_definition
    or position('calendarPenaltyPerRace' in v_patched) = 0
    or position('regional_national_homologation_threshold' in v_patched) = 0 then
    raise exception 'L’indice territorial d’homologation n’a pas pu être raccordé.';
  end if;
  execute v_patched;
end;
$migration$;

-- Enforce the category-specific homologation threshold in the authoritative
-- creation transaction.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.create_national_federation_race(text,text,text,text,text,integer,text,jsonb)'::regprocedure
  ) into v_definition;
  v_patched := replace(
    v_definition,
    $old$  if coalesce((v_score ->> 'total')::integer, 0) < 60 then
    raise exception 'L’indice d’homologation doit atteindre 60 points.';
  end if;$old$,
    $new$  if coalesce((v_score ->> 'total')::integer, 0) < (case
    when p_category_code in ('regional', 'national')
      then coalesce((v_score ->> 'threshold')::integer, 60)
    else 60
  end) then
    raise exception 'L’indice d’homologation requis pour ce rang n’est pas atteint.';
  end if;$new$
  );
  if v_patched = v_definition then
    raise exception 'Le seuil territorial d’homologation n’a pas pu être raccordé.';
  end if;
  execute v_patched;
end;
$migration$;

-- Require office level 3, lock the level 4/5 hosting discount at submission,
-- and persist the prestige-orientation contribution as a separate score line.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.submit_national_federation_hosting_candidacy(text,text)'::regprocedure
  ) into v_definition;

  v_patched := replace(
    v_definition,
    $old$  v_selection_score integer;
  v_candidacy_id uuid;$old$,
    $new$  v_selection_score integer;
  v_specialization_bonus_points integer := 0;
  v_office_effects record;
  v_candidacy_id uuid;$new$
  );
  v_patched := replace(
    v_patched,
    $old$  case p_event_type
    when 'world_championship_pro' then$old$,
    $new$  select * into v_office_effects
  from public.get_national_federation_race_organization_effects(
    v_country.id
  );
  if coalesce(v_office_effects.office_level, 0) < 3 then
    raise exception 'Le Bureau d’organisation doit atteindre le niveau 3.';
  end if;

  case p_event_type
    when 'world_championship_pro' then$new$
  );
  v_patched := replace(
    v_patched,
    $old$  end case;

  perform public.initialize_due_national_federation_accounts();$old$,
    $new$  end case;
  v_hosting_cost := round(
    v_hosting_cost * (
      1 - coalesce(v_office_effects.hosting_cost_reduction_percentage, 0) / 100
    ) / 5000
  ) * 5000;

  perform public.initialize_due_national_federation_accounts();$new$
  );
  v_patched := replace(
    v_patched,
    $old$  v_selection_score := v_recency_points + v_ranking_points + v_renown_points;

  insert into public.national_federation_hosting_candidacies ($old$,
    $new$  v_selection_score := v_recency_points + v_ranking_points + v_renown_points;
  v_specialization_bonus_points := round(
    v_selection_score
      * coalesce(v_office_effects.candidacy_score_bonus_percentage, 0)
      / 100
  );
  v_selection_score := least(
    1000,
    v_selection_score + v_specialization_bonus_points
  );

  insert into public.national_federation_hosting_candidacies ($new$
  );
  v_patched := replace(
    v_patched,
    $old$    recency_points, ranking_points, renown_points, selection_score,
    submitted_by_director_id$old$,
    $new$    recency_points, ranking_points, renown_points,
    specialization_bonus_points, selection_score,
    submitted_by_director_id$new$
  );
  v_patched := replace(
    v_patched,
    $old$    v_recency_points, v_ranking_points, v_renown_points, v_selection_score,
    v_identity.sporting_director_id$old$,
    $new$    v_recency_points, v_ranking_points, v_renown_points,
    v_specialization_bonus_points, v_selection_score,
    v_identity.sporting_director_id$new$
  );
  v_patched := replace(
    v_patched,
    $old$    renown_points = excluded.renown_points,
    selection_score = excluded.selection_score,$old$,
    $new$    renown_points = excluded.renown_points,
    specialization_bonus_points = excluded.specialization_bonus_points,
    selection_score = excluded.selection_score,$new$
  );

  if v_patched = v_definition
    or position('v_office_effects.office_level' in v_patched) = 0
    or position('specialization_bonus_points = excluded.specialization_bonus_points' in v_patched) = 0 then
    raise exception 'Les candidatures du Bureau d’organisation n’ont pas pu être raccordées.';
  end if;
  execute v_patched;
end;
$migration$;

-- Apply the prestige orientation to the cash actually credited after an
-- international event, not merely to its UI projection.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef(
    'public.settle_due_national_federation_hosting_returns()'::regprocedure
  ) into v_definition;
  v_patched := replace(
    v_definition,
    $old$    v_gross := v_attendance * case v_award.event_type
      when 'world_championship_pro' then 18
      when 'continental_championship_pro' then 16
      when 'nations_cup_pro' then 17
      when 'world_championship_junior' then 13
      when 'continental_championship_junior' then 12
      else 11 end;$old$,
    $new$    v_gross := v_attendance * case v_award.event_type
      when 'world_championship_pro' then 18
      when 'continental_championship_pro' then 16
      when 'nations_cup_pro' then 17
      when 'world_championship_junior' then 13
      when 'continental_championship_junior' then 12
      else 11 end;
    v_gross := round(
      v_gross * (
        1 + coalesce((
          select effects.hosting_revenue_bonus_percentage
          from public.get_national_federation_race_organization_effects(
            v_award.country_id
          ) as effects
        ), 0) / 100
      )
    );$new$
  );
  if v_patched = v_definition then
    raise exception 'Les recettes d’accueil internationales n’ont pas pu être raccordées.';
  end if;
  execute v_patched;
end;
$migration$;

commit;
