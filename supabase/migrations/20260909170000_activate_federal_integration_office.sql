begin;

-- Rename the three former, mostly descriptive orientations without losing an
-- active or pending choice already made by a federation.
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
    when 'federal_integration_office' then p_specialization_code in (
      'fast_track', 'diaspora_network', 'integration_program',
      'professional_path', 'youth_gateway', 'technical_passport'
    )
    when 'home_advantage_program' then p_specialization_code in ('terrain_library', 'climate_lab', 'supporter_roads')
    else false
  end
$$;

update public.national_federation_infrastructure_specializations
set active_specialization_code = case active_specialization_code
      when 'fast_track' then 'professional_path'
      when 'diaspora_network' then 'youth_gateway'
      when 'integration_program' then 'technical_passport'
      else active_specialization_code
    end,
    pending_specialization_code = case pending_specialization_code
      when 'fast_track' then 'professional_path'
      when 'diaspora_network' then 'youth_gateway'
      when 'integration_program' then 'technical_passport'
      else pending_specialization_code
    end,
    updated_at = now()
where infrastructure_code = 'federal_integration_office'
  and (
    active_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
    or pending_specialization_code in ('fast_track', 'diaspora_network', 'integration_program')
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
    when 'federal_integration_office' then p_specialization_code in ('professional_path', 'youth_gateway', 'technical_passport')
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

create or replace function public.get_team_federal_integration_specialization_power(
  p_team_id uuid,
  p_specialization_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when specialization.active_specialization_code <> p_specialization_code then 0
      when infrastructure.level = 3 then 0.60
      when infrastructure.level = 4 then 0.80
      when infrastructure.level >= 5 then 1.00
      else 0
    end
    from public.seasons as season
    join public.team_seasons as team_season
      on team_season.team_id = p_team_id
     and team_season.season_id = season.id
     and team_season.status in ('planned', 'active')
    join public.national_federation_infrastructures as infrastructure
      on infrastructure.country_id = team_season.registration_country_id
     and infrastructure.infrastructure_code = 'federal_integration_office'
    left join public.national_federation_infrastructure_specializations as specialization
      on specialization.country_id = team_season.registration_country_id
     and specialization.infrastructure_code = 'federal_integration_office'
    where season.status = 'active'
    limit 1
  ), 0)::numeric;
$$;

create or replace function public.get_team_federal_staff_naturalization_bonus(
  p_team_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.get_team_federal_integration_specialization_power(
      p_team_id,
      'technical_passport'
    ) <= 0 then 0
    when coalesce(
      public.get_team_national_federation_infrastructure_level(
        p_team_id,
        'federal_integration_office'
      ),
      0
    ) >= 5 then 2
    else 1
  end;
$$;

create or replace function public.get_team_professional_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  with inputs as (
    select
      ceil(
        (array[84,70,56,42,28,14]::integer[])[
          least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
        ] / public.get_team_infrastructure_efficiency_multiplier(
          p_team_id,
          'international_welcome_center'
        )
      )::integer as team_base_days,
      public.get_team_specialization_power(
        p_team_id,
        'international_welcome_center',
        'administrative_path'
      ) as team_power,
      coalesce(
        public.get_team_national_federation_infrastructure_level(
          p_team_id,
          'federal_integration_office'
        ),
        0
      ) as federal_level,
      public.get_team_federal_integration_specialization_power(
        p_team_id,
        'professional_path'
      ) as federal_power
  ), routes as (
    select
      greatest(
        0,
        team_base_days - case
          when team_base_days > 0 and team_power > 0 then greatest(
            1,
            round(team_base_days * 0.05 * team_power)::integer
          )
          else 0
        end
      ) as team_days,
      ceil(84 * (1 - least(5, greatest(0, federal_level)) * 0.10))::integer
        as federal_base_days,
      federal_power
    from inputs
  )
  select least(
    team_days,
    greatest(
      0,
      federal_base_days - case
        when federal_base_days > 0 and federal_power > 0 then greatest(
          1,
          round(federal_base_days * 0.10 * federal_power)::integer
        )
        else 0
      end
    )
  )
  from routes;
$$;

create or replace function public.get_team_youth_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  with inputs as (
    select
      ceil(
        (array[28,21,14,7,3,0]::integer[])[
          least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
        ] / public.get_team_infrastructure_efficiency_multiplier(
          p_team_id,
          'international_welcome_center'
        )
      )::integer as team_base_days,
      public.get_team_specialization_power(
        p_team_id,
        'international_welcome_center',
        'youth_gateway'
      ) as team_power,
      coalesce(
        public.get_team_national_federation_infrastructure_level(
          p_team_id,
          'federal_integration_office'
        ),
        0
      ) as federal_level,
      public.get_team_federal_integration_specialization_power(
        p_team_id,
        'youth_gateway'
      ) as federal_power
  ), routes as (
    select
      greatest(
        0,
        team_base_days - case
          when team_base_days > 0 and team_power > 0 then greatest(
            1,
            round(team_base_days * 0.05 * team_power)::integer
          )
          else 0
        end
      ) as team_days,
      ceil(28 * (1 - least(5, greatest(0, federal_level)) * 0.10))::integer
        as federal_base_days,
      federal_power
    from inputs
  )
  select least(
    team_days,
    greatest(
      0,
      federal_base_days - case
        when federal_base_days > 0 and federal_power > 0 then greatest(
          1,
          round(federal_base_days * 0.10 * federal_power)::integer
        )
        else 0
      end
    )
  )
  from routes;
$$;

create or replace function public.naturalize_current_team_staff(
  p_contract_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_staff record;
  v_welcome_center_level integer;
  v_limit integer;
  v_used integer;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Vous devez être connecté pour naturaliser un membre du staff.';
  end if;

  if p_contract_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Le contrat de staff transmis est invalide.';
  end if;

  perform public.sync_active_season_day();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    coalesce(season.current_day_number, 1) as current_day_number,
    team_season.registration_country_id as target_country_id,
    target_country.name as target_country_name,
    target_country.iso_alpha2 as target_country_code
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  join public.countries as target_country
    on target_country.id = team_season.registration_country_id
   and target_country.is_active
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception using
      errcode = '42501',
      message = 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'staff-naturalization:' || v_context.team_id::text || ':' || v_context.season_id::text,
      0
    )
  );

  select coalesce(max(infrastructure.level), 0)
  into v_welcome_center_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'international_welcome_center';

  v_limit := least(5, greatest(0, v_welcome_center_level))
    + case when public.get_team_specialization_power(
        v_context.team_id,
        'international_welcome_center',
        'administrative_path'
      ) > 0 then 1 else 0 end
    + public.get_team_federal_staff_naturalization_bonus(v_context.team_id);
  if v_limit < 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Construisez un Centre d’accueil ou bénéficiez du Passeport technique fédéral avant de naturaliser ce membre du staff.';
  end if;

  select count(*)::integer
  into v_used
  from public.staff_naturalizations as naturalization
  where naturalization.team_id = v_context.team_id
    and naturalization.season_id = v_context.season_id;

  if v_used >= v_limit then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Le quota de naturalisation du staff est atteint pour cette saison (%s/%s).',
        v_used,
        v_limit
      );
  end if;

  select
    contract.staff_member_id,
    member.country_id,
    current_country.name as current_country_name,
    current_country.iso_alpha2 as current_country_code
  into v_staff
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  join public.countries as current_country on current_country.id = member.country_id
  where contract.id = p_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active';

  if v_staff is null then
    raise exception using
      errcode = '42501',
      message = 'Ce membre du staff n’appartient pas à votre équipe active.';
  end if;

  if v_staff.country_id = v_context.target_country_id then
    raise exception using
      errcode = 'P0001',
      message = 'Ce membre du staff possède déjà la nationalité de votre équipe.';
  end if;

  update public.staff_members
  set country_id = v_context.target_country_id
  where id = v_staff.staff_member_id
    and country_id = v_staff.country_id;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'La nationalité du membre du staff a changé entre-temps. Rechargez la page.';
  end if;

  insert into public.staff_naturalizations (
    staff_member_id,
    staff_contract_id,
    team_id,
    sporting_director_id,
    season_id,
    day_number,
    from_country_id,
    to_country_id,
    welcome_center_level
  ) values (
    v_staff.staff_member_id,
    p_contract_id,
    v_context.team_id,
    v_context.director_id,
    v_context.season_id,
    v_context.current_day_number,
    v_staff.country_id,
    v_context.target_country_id,
    v_welcome_center_level
  );

  return pg_catalog.jsonb_build_object(
    'staffMemberId', v_staff.staff_member_id,
    'countryId', v_context.target_country_id,
    'countryName', v_context.target_country_name,
    'countryCode', v_context.target_country_code,
    'used', v_used + 1,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - v_used - 1)
  );
end;
$$;

comment on table public.staff_naturalizations is
  'Historique et quota saisonnier des naturalisations du staff via le Centre d’accueil ou le Passeport technique fédéral.';

revoke all on function public.get_team_federal_integration_specialization_power(uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_team_federal_staff_naturalization_bonus(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_professional_naturalization_days(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_youth_naturalization_days(uuid)
  from public, anon, authenticated;
revoke all on function public.naturalize_current_team_staff(uuid)
  from public, anon;

grant execute on function public.get_team_professional_naturalization_days(uuid)
  to service_role;
grant execute on function public.get_team_youth_naturalization_days(uuid)
  to service_role;
grant execute on function public.naturalize_current_team_staff(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
