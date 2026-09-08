begin;

-- Les Académies régionales faisaient doublon avec le Réseau national de
-- détection. Les investissements déjà engagés sont restitués à la fédération.
do $$
declare
  v_active_season public.seasons%rowtype;
  v_project public.national_federation_infrastructure_projects%rowtype;
  v_specialization public.national_federation_infrastructure_specializations%rowtype;
  v_account_id uuid;
begin
  perform public.initialize_due_national_federation_accounts();

  select * into v_active_season
  from public.seasons
  where status = 'active'
  limit 1;

  for v_project in
    select *
    from public.national_federation_infrastructure_projects
    where infrastructure_code = 'regional_academies'
      and status in ('active', 'completed')
    order by created_at
    for update
  loop
    select account.id into v_account_id
    from public.national_federation_accounts as account
    where account.country_id = v_project.country_id
      and account.season_id = coalesce(
        v_active_season.id,
        v_project.started_season_id
      )
    for update;

    if v_account_id is null then
      select account.id into v_account_id
      from public.national_federation_accounts as account
      where account.country_id = v_project.country_id
        and account.season_id = v_project.started_season_id
      for update;
    end if;

    if v_account_id is not null and not exists (
      select 1
      from public.national_federation_transactions as transaction
      where transaction.source_reference =
        'regional-academies-retirement:' || v_project.id::text
    ) then
      update public.national_federation_accounts
      set balance = balance + v_project.final_cost,
          updated_at = now()
      where id = v_account_id;

      insert into public.national_federation_transactions (
        account_id, day_number, amount, category, description,
        source_reference, metadata
      ) values (
        v_account_id,
        coalesce(v_active_season.current_day_number, 1),
        v_project.final_cost,
        'refund',
        'Remboursement du chantier retiré : Académies régionales',
        'regional-academies-retirement:' || v_project.id::text,
        jsonb_build_object(
          'infrastructureCode', 'regional_academies',
          'projectId', v_project.id,
          'targetLevel', v_project.target_level
        )
      );
    end if;

    update public.national_federation_infrastructure_projects
    set status = 'cancelled',
        updated_at = now()
    where id = v_project.id;
  end loop;

  for v_specialization in
    select *
    from public.national_federation_infrastructure_specializations
    where infrastructure_code = 'regional_academies'
      and last_change_cost > 0
    for update
  loop
    select account.id into v_account_id
    from public.national_federation_accounts as account
    where account.country_id = v_specialization.country_id
      and account.season_id = coalesce(
        v_active_season.id,
        v_specialization.last_selected_season_id
      )
    for update;

    if v_account_id is null then
      select account.id into v_account_id
      from public.national_federation_accounts as account
      where account.country_id = v_specialization.country_id
        and account.season_id = v_specialization.last_selected_season_id
      for update;
    end if;

    if v_account_id is not null and not exists (
      select 1
      from public.national_federation_transactions as transaction
      where transaction.source_reference =
        'regional-academies-specialization-retirement:'
          || v_specialization.id::text
    ) then
      update public.national_federation_accounts
      set balance = balance + v_specialization.last_change_cost,
          updated_at = now()
      where id = v_account_id;

      insert into public.national_federation_transactions (
        account_id, day_number, amount, category, description,
        source_reference, metadata
      ) values (
        v_account_id,
        coalesce(v_active_season.current_day_number, 1),
        v_specialization.last_change_cost,
        'refund',
        'Remboursement de l’orientation retirée : Académies régionales',
        'regional-academies-specialization-retirement:'
          || v_specialization.id::text,
        jsonb_build_object(
          'infrastructureCode', 'regional_academies',
          'specializationId', v_specialization.id
        )
      );
    end if;
  end loop;

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  )
  select
    retired.country_id,
    v_active_season.id,
    v_active_season.current_day_number,
    'infrastructure',
    'Académies régionales retirées',
    'Le bâtiment a été retiré pour éviter un doublon avec le Réseau national de détection. Les investissements concernés ont été remboursés.',
    'regional-academies-retirement:' || retired.country_id::text || ':journal',
    jsonb_build_object('replacement', 'national_detection_network')
  from (
    select country_id
    from public.national_federation_infrastructures
    where infrastructure_code = 'regional_academies'
    union
    select country_id
    from public.national_federation_infrastructure_projects
    where infrastructure_code = 'regional_academies'
  ) as retired
  where v_active_season.id is not null
  on conflict (source_reference) do nothing;
end;
$$;

delete from public.national_federation_infrastructure_specializations
where infrastructure_code = 'regional_academies';

delete from public.national_federation_infrastructures
where infrastructure_code = 'regional_academies';

alter table public.national_federation_infrastructures
  drop constraint national_federation_infrastructures_code_allowed;
alter table public.national_federation_infrastructures
  add constraint national_federation_infrastructures_code_allowed check (
    infrastructure_code in (
      'national_detection_network', 'national_performance_center',
      'federal_staff_institute', 'federal_medical_network',
      'national_technical_laboratory', 'race_organization_office',
      'federal_integration_office', 'home_advantage_program'
    )
  );

alter table public.national_federation_infrastructure_projects
  drop constraint national_federation_projects_code_allowed;
alter table public.national_federation_infrastructure_projects
  add constraint national_federation_projects_code_allowed check (
    infrastructure_code in (
      'national_detection_network', 'national_performance_center',
      'federal_staff_institute', 'federal_medical_network',
      'national_technical_laboratory', 'race_organization_office',
      'federal_integration_office', 'home_advantage_program'
    ) or (
      infrastructure_code = 'regional_academies'
      and status = 'cancelled'
    )
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
    when 'race_organization_office' then p_specialization_code in ('prestige_events', 'dense_calendar', 'profitable_events')
    when 'federal_integration_office' then p_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
    when 'home_advantage_program' then p_specialization_code in ('terrain_library', 'climate_lab', 'supporter_roads')
    else false
  end
$$;

create or replace function public.prevent_retired_regional_academies_project()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.infrastructure_code = 'regional_academies'
    and new.status <> 'cancelled' then
    raise exception 'Les Académies régionales ont été retirées du programme fédéral.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_retired_regional_academies_project
  on public.national_federation_infrastructure_projects;
create trigger prevent_retired_regional_academies_project
before insert or update
on public.national_federation_infrastructure_projects
for each row execute function public.prevent_retired_regional_academies_project();

revoke all on function public.prevent_retired_regional_academies_project()
  from public, anon, authenticated;

-- Le Plan vélo scolaire reste intact. Seul son prérequis devient le niveau 2
-- du Réseau national de détection.
create or replace function public.start_national_federation_school_cycling_plan(
  p_country_code text,
  p_target_archetype text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  v_identity record;
  v_season public.seasons%rowtype;
  v_account public.national_federation_accounts%rowtype;
  v_historical_archetype text;
  v_current_plan public.national_federation_school_cycling_plans%rowtype;
  v_current_game_day integer;
  v_plan_id uuid;
  v_cost constant numeric := 1500000;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  perform public.initialize_due_national_federation_accounts();
  perform public.settle_due_national_federation_school_plans();

  select * into v_identity
  from public.get_current_federation_identity(p_country_code);
  if v_identity.country_id is null then
    raise exception 'Votre équipe n’est pas affiliée à cette fédération.';
  end if;

  select * into v_season
  from public.seasons
  where status = 'active'
  limit 1;
  if v_season.id is null or v_season.game_year < 3 then
    raise exception 'Le Plan vélo scolaire sera disponible à partir de la Saison 3.';
  end if;

  if not exists (
    select 1
    from public.national_federation_terms as term
    where term.country_id = v_identity.country_id
      and term.start_game_year <= v_season.game_year
      and term.end_game_year >= v_season.game_year
      and term.governance_mode = 'elected'
      and term.president_director_id = v_identity.sporting_director_id
  ) then
    raise exception 'Seul le président élu peut engager ce programme.';
  end if;

  if coalesce((
    select infrastructure.level
    from public.national_federation_infrastructures as infrastructure
    where infrastructure.country_id = v_identity.country_id
      and infrastructure.infrastructure_code = 'national_detection_network'
  ), 0) < 2 then
    raise exception 'Le Réseau national de détection doit atteindre le niveau 2.';
  end if;

  if p_target_archetype not in (
    'climber', 'puncheur', 'stage_racer', 'northern_classics',
    'rouleur', 'breakaway', 'sprinter', 'all_rounder'
  ) then
    raise exception 'Le profil de formation choisi est invalide.';
  end if;

  select public.get_country_historical_youth_archetype(country.iso_alpha2)
  into v_historical_archetype
  from public.countries as country
  where country.id = v_identity.country_id;
  if p_target_archetype = v_historical_archetype then
    raise exception 'Le style historique ne peut pas être choisi comme nouvelle orientation.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_identity.country_id::text || ':school-cycling-plan', 0
    )
  );

  select * into v_current_plan
  from public.national_federation_school_cycling_plans
  where country_id = v_identity.country_id
    and status in ('deploying', 'active')
  order by created_at desc
  limit 1
  for update;

  if v_current_plan.id is not null
    and v_current_plan.target_archetype = p_target_archetype then
    raise exception 'Cette orientation est déjà celle du plan en cours.';
  end if;

  select * into v_account
  from public.national_federation_accounts
  where country_id = v_identity.country_id
    and season_id = v_season.id
  for update;
  if v_account.id is null or v_account.balance < v_cost then
    raise exception 'La trésorerie fédérale est insuffisante pour ce programme.';
  end if;

  if v_current_plan.id is not null then
    update public.national_federation_school_cycling_plans
    set status = 'superseded', updated_at = now()
    where id = v_current_plan.id;
  end if;

  v_current_game_day := v_season.game_year * 28
    + coalesce(v_season.current_day_number, 1) - 1;
  insert into public.national_federation_school_cycling_plans (
    country_id, started_season_id, historical_archetype, target_archetype,
    cost, starts_game_day_index, completes_game_day_index,
    launched_by_director_id
  ) values (
    v_identity.country_id, v_season.id, v_historical_archetype,
    p_target_archetype, v_cost, v_current_game_day,
    v_current_game_day + 56, v_identity.sporting_director_id
  ) returning id into v_plan_id;

  update public.national_federation_accounts
  set balance = balance - v_cost, updated_at = now()
  where id = v_account.id;

  insert into public.national_federation_transactions (
    account_id, day_number, amount, category, description, source_reference,
    metadata
  ) values (
    v_account.id, v_season.current_day_number, -v_cost, 'infrastructure',
    'Lancement du Plan vélo scolaire vers le profil ' || p_target_archetype,
    'federation-school-plan:' || v_plan_id::text || ':launch',
    jsonb_build_object(
      'historicalArchetype', v_historical_archetype,
      'targetArchetype', p_target_archetype,
      'durationDays', 56
    )
  );

  insert into public.national_federation_journal_entries (
    country_id, season_id, day_number, category, title, detail,
    source_reference, metadata
  ) values (
    v_identity.country_id, v_season.id, v_season.current_day_number,
    'infrastructure', 'Plan vélo scolaire lancé',
    'Orientation ' || p_target_archetype
      || ' · déploiement sur 56 jours · trois promotions de montée en puissance.',
    'federation-school-plan:' || v_plan_id::text || ':journal',
    jsonb_build_object(
      'historicalArchetype', v_historical_archetype,
      'targetArchetype', p_target_archetype,
      'durationDays', 56
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.start_national_federation_school_cycling_plan(text, text)
  from public, anon;
grant execute on function public.start_national_federation_school_cycling_plan(text, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
