begin;

alter table public.youth_scouting_missions
  add column if not exists federation_detection_bonus_percentage numeric(5, 2)
    not null default 0
    check (federation_detection_bonus_percentage between 0 and 5),
  add column if not exists federal_staff_bonus_percentage numeric(5, 2)
    not null default 0
    check (federal_staff_bonus_percentage between 0 and 2.5);

alter table public.youth_scouting_candidates
  add column if not exists federal_tuition_reduction_percentage numeric(5, 2)
    not null default 0
    check (federal_tuition_reduction_percentage between 0 and 5),
  add column if not exists scout_tuition_reduction_percentage numeric(5, 2)
    not null default 0
    check (scout_tuition_reduction_percentage between 0 and 100);

alter table public.rider_injuries
  add column if not exists federal_recovery_hours_reduced smallint
    not null default 0
    check (federal_recovery_hours_reduced >= 0);

create or replace function public.get_national_federation_infrastructure_level(
  p_country_id uuid,
  p_infrastructure_code text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(infrastructure.level), 0)::integer
  from public.national_federation_infrastructures as infrastructure
  where infrastructure.country_id = p_country_id
    and infrastructure.infrastructure_code = p_infrastructure_code;
$$;

create or replace function public.get_team_national_federation_infrastructure_level(
  p_team_id uuid,
  p_infrastructure_code text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_national_federation_infrastructure_level(
    team_season.registration_country_id,
    p_infrastructure_code
  )
  from public.team_seasons as team_season
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  where team_season.team_id = p_team_id
  limit 1;
$$;

create or replace function public.get_team_national_performance_multiplier(
  p_team_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + coalesce(
    public.get_team_national_federation_infrastructure_level(
      p_team_id,
      'national_performance_center'
    ),
    0
  ) * 0.003;
$$;

create or replace function public.get_staff_contract_federal_institute_multiplier(
  p_contract_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when member.country_id = team_season.registration_country_id then
        1 + public.get_national_federation_infrastructure_level(
          team_season.registration_country_id,
          'federal_staff_institute'
        ) * 0.005
      else 1
    end::numeric
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = season.id
    where contract.id = p_contract_id
      and contract.status = 'active'
  ), 1)::numeric;
$$;

-- Les deux multiplicateurs restent séparés pour rendre leur origine lisible
-- dans les rapports : bâtiment d'équipe, puis fédération.
do $migration$
declare
  v_definition text;
  v_training_center_needle text :=
    'public.get_team_training_center_progress_multiplier(v_rider.team_id)';
  v_trainer_talent_needle text :=
    'public.get_trainer_talent_progress_multiplier(v_plan.trainer_contract_id, v_rider.id, v_stat.stat_code)';
begin
  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;

  if position('get_team_national_performance_multiplier' in v_definition) = 0 then
    if position(v_training_center_needle in v_definition) = 0 then
      raise exception 'Point d’intégration du Centre national de performance introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_training_center_needle,
      v_training_center_needle ||
        ' * public.get_team_national_performance_multiplier(v_rider.team_id)'
    );
  end if;

  if position('get_staff_contract_federal_institute_multiplier' in v_definition) = 0 then
    if position(v_trainer_talent_needle in v_definition) = 0 then
      raise exception 'Point d’intégration de l’Institut fédéral du staff introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_trainer_talent_needle,
      v_trainer_talent_needle ||
        ' * public.get_staff_contract_federal_institute_multiplier(v_plan.trainer_contract_id)'
    );
  end if;

  execute v_definition;
end;
$migration$;

create or replace function public.get_active_team_staff_base_strength(
  p_team_id uuid,
  p_role text,
  p_points_per_level numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    member.level
    * p_points_per_level
    * public.get_staff_contract_nationality_multiplier(contract.id)
    * public.get_staff_contract_federal_institute_multiplier(contract.id)
  ), 0)::numeric
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  where contract.team_id = p_team_id
    and contract.status = 'active'
    and member.role = p_role;
$$;

create or replace function public.get_active_team_staff_talent_strength(
  p_team_id uuid,
  p_talent_code text,
  p_points_per_level numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    member.level
    * p_points_per_level
    * public.get_staff_contract_nationality_multiplier(contract.id)
    * public.get_staff_contract_federal_institute_multiplier(contract.id)
  ), 0)::numeric
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = p_talent_code
  where contract.team_id = p_team_id
    and contract.status = 'active';
$$;

create or replace function public.get_team_professional_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  select least(
    ceil(
      (array[84,70,56,42,28,14]::integer[])[
        least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
      ] / public.get_team_infrastructure_efficiency_multiplier(
        p_team_id,
        'international_welcome_center'
      )
    )::integer,
    ceil(
      84 * (
        1 - coalesce(
          public.get_team_national_federation_infrastructure_level(
            p_team_id,
            'federal_integration_office'
          ),
          0
        ) * 0.04
      )
    )::integer
  );
$$;

create or replace function public.get_team_youth_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  select least(
    ceil(
      (array[28,21,14,7,3,0]::integer[])[
        least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
      ] / public.get_team_infrastructure_efficiency_multiplier(
        p_team_id,
        'international_welcome_center'
      )
    )::integer,
    ceil(
      28 * (
        1 - coalesce(
          public.get_team_national_federation_infrastructure_level(
            p_team_id,
            'federal_integration_office'
          ),
          0
        ) * 0.04
      )
    )::integer
  );
$$;

create or replace function public.apply_team_doctor_to_new_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_doctor_reduction_percentage numeric;
  v_federal_reduction_percentage numeric;
  v_doctor_reduction_hours integer;
  v_total_reduction_hours integer;
  v_form_protection integer;
begin
  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;

  if v_team_id is null then return new; end if;

  v_doctor_reduction_percentage := least(
    80,
    public.get_active_team_staff_base_strength(v_team_id, 'doctor', 6)
      + public.get_active_team_staff_talent_strength(
          v_team_id,
          'doctor_recovery_time',
          3
        )
  );
  v_federal_reduction_percentage :=
    coalesce(
      public.get_team_national_federation_infrastructure_level(
        v_team_id,
        'federal_medical_network'
      ),
      0
    );

  v_doctor_reduction_hours := ceil(
    new.recovery_hours * v_doctor_reduction_percentage / 100.0
  )::integer;
  v_total_reduction_hours := ceil(
    new.recovery_hours
      * least(85, v_doctor_reduction_percentage + v_federal_reduction_percentage)
      / 100.0
  )::integer;
  new.doctor_recovery_hours_reduced := v_doctor_reduction_hours;
  new.federal_recovery_hours_reduced := greatest(
    0,
    v_total_reduction_hours - v_doctor_reduction_hours
  );
  new.expected_recovery_at := new.expected_recovery_at
    - make_interval(hours => v_total_reduction_hours);

  select count(*)::integer
  into v_form_protection
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'doctor'
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = 'doctor_injury_form_loss'
  where contract.team_id = v_team_id
    and contract.status = 'active';

  new.form_loss_per_day := greatest(
    0,
    new.form_loss_per_day - coalesce(v_form_protection, 0)
  );
  return new;
end;
$$;

revoke all on function public.get_national_federation_infrastructure_level(uuid, text)
  from public, anon;
revoke all on function public.get_team_national_federation_infrastructure_level(uuid, text)
  from public, anon;
revoke all on function public.get_team_national_performance_multiplier(uuid)
  from public, anon;
revoke all on function public.get_staff_contract_federal_institute_multiplier(uuid)
  from public, anon;

grant execute on function public.get_national_federation_infrastructure_level(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_team_national_federation_infrastructure_level(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_team_national_performance_multiplier(uuid)
  to service_role;
grant execute on function public.get_staff_contract_federal_institute_multiplier(uuid)
  to service_role;

comment on function public.get_national_federation_infrastructure_level(uuid, text) is
  'Niveau effectif d’une infrastructure fédérale, centralisé pour les moteurs de gameplay.';
comment on column public.youth_scouting_missions.federation_detection_bonus_percentage is
  'Précision fédérale figée à la date de finalisation du rapport.';
comment on column public.rider_injuries.federal_recovery_hours_reduced is
  'Heures retranchées par le Réseau médical fédéral, séparées du bonus des médecins.';

notify pgrst, 'reload schema';

commit;
