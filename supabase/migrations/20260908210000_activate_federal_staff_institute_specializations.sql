begin;

alter table public.youth_scouting_missions
  drop constraint if exists youth_scouting_missions_federal_staff_bonus_percentage_check;

alter table public.youth_scouting_missions
  add constraint youth_scouting_missions_federal_staff_bonus_percentage_check
    check (federal_staff_bonus_percentage between 0 and 5.5),
  add column if not exists federal_staff_spec_report_bonus_percentage numeric(5, 2)
    not null default 0
    check (federal_staff_spec_report_bonus_percentage between 0 and 5);

alter table public.staff_academy_trainings
  add column if not exists federal_duration_reduction_percentage numeric(5, 2)
    not null default 0
    check (federal_duration_reduction_percentage between 0 and 5);

-- Le multiplicateur regroupe le socle du bâtiment et l'orientation du métier.
-- Il reste nul pour un staff étranger à la nationalité d'inscription du club.
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
      when member.country_id <> team_season.registration_country_id then 1
      else 1 + (
        infrastructure.level * 0.5
        + case
            when specialization.specialization_code = 'coach_school'
              and member.role = 'trainer' then 3
            when specialization.specialization_code = 'scout_school'
              and member.role = 'scout' then 3
            when specialization.specialization_code = 'medical_school'
              and member.role in (
                'doctor',
                'physiotherapist',
                'nutritionist'
              ) then 3
            else 0
          end
          * public.get_infrastructure_specialization_power_multiplier(
              infrastructure.level
            )
      ) / 100.0
    end::numeric
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = season.id
    cross join lateral (
      select public.get_national_federation_infrastructure_level(
        team_season.registration_country_id,
        'federal_staff_institute'
      ) as level
    ) as infrastructure
    cross join lateral (
      select public.get_federation_infrastructure_specialization(
        team_season.registration_country_id,
        'federal_staff_institute'
      ) as specialization_code
    ) as specialization
    where contract.id = p_contract_id
      and contract.status = 'active'
  ), 1)::numeric;
$$;

create or replace function public.get_staff_contract_federal_training_reduction(
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
      when member.country_id <> team_season.registration_country_id then 0
      when specialization.specialization_code = 'coach_school'
        and member.role = 'trainer' then 5
      when specialization.specialization_code = 'medical_school'
        and member.role in (
          'doctor',
          'physiotherapist',
          'nutritionist'
        ) then 5
      else 0
    end * public.get_infrastructure_specialization_power_multiplier(
      infrastructure.level
    )
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = season.id
    cross join lateral (
      select public.get_national_federation_infrastructure_level(
        team_season.registration_country_id,
        'federal_staff_institute'
      ) as level
    ) as infrastructure
    cross join lateral (
      select public.get_federation_infrastructure_specialization(
        team_season.registration_country_id,
        'federal_staff_institute'
      ) as specialization_code
    ) as specialization
    where contract.id = p_contract_id
      and contract.status = 'active'
  ), 0)::numeric;
$$;

-- Les talents calculés contrat par contrat n'empruntaient pas les agrégateurs
-- d'équipe : ils reçoivent ici le même multiplicateur fédéral.
create or replace function public.get_staff_contract_talent_percentage(
  p_contract_id uuid,
  p_talent_code text,
  p_points_per_level numeric,
  p_rider_id uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((
    select member.level
      * p_points_per_level
      * public.get_staff_contract_nationality_multiplier(
          contract.id,
          p_rider_id
        )
      * public.get_staff_contract_federal_institute_multiplier(contract.id)
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
     and talent.talent_code = p_talent_code
    where contract.id = p_contract_id
      and contract.status = 'active'
    limit 1
  ), 0)::numeric;
$$;

create or replace function public.get_rider_physio_form_protection(
  p_team_id uuid,
  p_rider_id uuid,
  p_source text
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(round(sum(
    (
      member.level
      + case
          when p_source = 'race' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_race_recovery'
          ) then 1
          when p_source = 'training' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_training_recovery'
          ) then 1
          else 0
        end
    )
    * public.get_staff_contract_nationality_multiplier(contract.id)
    * public.get_staff_contract_federal_institute_multiplier(contract.id)
  )), 0)::integer
  from public.staff_rider_assignments as staff_assignment
  join public.staff_contracts as contract
    on contract.id = staff_assignment.staff_contract_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  where contract.team_id = p_team_id
    and staff_assignment.rider_id = p_rider_id
    and staff_assignment.status = 'active';
$$;

create or replace function public.get_nutritionist_intervention_price(
  p_contract_id uuid,
  p_base_price numeric,
  p_level integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select greatest(0, p_base_price) * (
    1 - least(
      70,
      (
        greatest(0, p_level) * 5
        * public.get_staff_contract_nationality_multiplier(p_contract_id)
        * public.get_staff_contract_federal_institute_multiplier(p_contract_id)
      )
      + public.get_staff_contract_talent_percentage(
          p_contract_id,
          'nutrition_supplement_cost',
          2
        )
    ) / 100.0
  );
$$;

create or replace function public.get_race_preparer_bonus_percentage(
  p_contract_id uuid,
  p_level integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select
    greatest(0, p_level) * 5
      * public.get_staff_contract_nationality_multiplier(p_contract_id)
      * public.get_staff_contract_federal_institute_multiplier(p_contract_id)
    + public.get_staff_contract_talent_percentage(
        p_contract_id,
        'preparer_quality',
        3
      );
$$;

create or replace function public.get_architect_adjusted_reduction(
  p_contract_id uuid,
  p_current_reduction integer,
  p_kind text
)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when p_contract_id is null then 0
    else least(
      45,
      round(
        greatest(0, coalesce(p_current_reduction, 0))
          * public.get_staff_contract_nationality_multiplier(p_contract_id)
          * public.get_staff_contract_federal_institute_multiplier(p_contract_id)
        + case p_kind
            when 'cost' then public.get_staff_contract_talent_percentage(
              p_contract_id,
              'architect_construction_cost',
              2
            )
            when 'duration' then public.get_staff_contract_talent_percentage(
              p_contract_id,
              'architect_construction_time',
              2
            )
            else 0
          end
      )
    )::integer
  end;
$$;

create or replace function public.get_team_staff_academy_educator_bonuses(
  p_team_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with contributions as (
    select
      contract.id as contract_id,
      member.level,
      talent.talent_code,
      public.get_staff_contract_nationality_multiplier(contract.id)
        * public.get_staff_contract_federal_institute_multiplier(contract.id)
        as efficiency_multiplier
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'educator'
    left join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
    where contract.team_id = p_team_id
      and contract.status = 'active'
  ), reductions as (
    select
      count(distinct contract_id)::integer as active_educator_count,
      coalesce(max(
        case when talent_code = 'educator_training_time'
          then level * 3 * efficiency_multiplier else 0 end
      ), 0) as time_specialist,
      coalesce(max(
        case when talent_code = 'educator_training_cost'
          then level * 4 * efficiency_multiplier else 0 end
      ), 0) as cost_specialist,
      coalesce(max(
        case when talent_code = 'educator_training_effectiveness'
          then level * 5 * efficiency_multiplier else 0 end
      ), 0) as effectiveness,
      coalesce(bool_or(
        talent_code = 'educator_parallel_training' and level >= 3
      ), false) as has_parallel_training
    from contributions
  )
  select jsonb_build_object(
    'activeEducatorCount', active_educator_count,
    'costReductionPercentage', least(
      50::numeric,
      round(cost_specialist + effectiveness, 1)
    ),
    'durationReductionPercentage', least(
      50::numeric,
      round(time_specialist + effectiveness, 1)
    ),
    'extraCapacity', case when has_parallel_training then 1 else 0 end
  )
  from reductions;
$$;

-- Les triggers figent les bonus au moment de l'insertion, sans réécrire les
-- fonctions transactionnelles de l'Académie ou du Laboratoire R&D.
create or replace function public.apply_federal_staff_to_academy_training()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reduction numeric;
begin
  v_reduction := public.get_staff_contract_federal_training_reduction(
    new.staff_contract_id
  );
  new.federal_duration_reduction_percentage := v_reduction;
  new.duration_days := greatest(
    1,
    ceil(new.duration_days * (1 - v_reduction / 100.0))::integer
  );
  new.completes_game_day_index :=
    new.starts_game_day_index + new.duration_days;
  return new;
end;
$$;

drop trigger if exists apply_federal_staff_to_academy_training
  on public.staff_academy_trainings;
create trigger apply_federal_staff_to_academy_training
before insert on public.staff_academy_trainings
for each row execute function public.apply_federal_staff_to_academy_training();

create or replace function public.apply_federal_staff_to_equipment_rnd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_multiplier numeric;
  v_engineer_level integer;
  v_has_success_talent boolean;
  v_base_duration integer;
begin
  if new.engineer_contract_id is null then return new; end if;

  v_multiplier := public.get_staff_contract_federal_institute_multiplier(
    new.engineer_contract_id
  );
  if v_multiplier <= 1 then return new; end if;

  select
    member.level,
    exists (
      select 1
      from public.staff_member_talents as talent
      where talent.staff_member_id = member.id
        and talent.talent_code = 'research_success'
    )
  into v_engineer_level, v_has_success_talent
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'research_engineer'
  where contract.id = new.engineer_contract_id
    and contract.status = 'active';

  if v_engineer_level is null then return new; end if;

  if v_has_success_talent then
    new.success_rate := least(
      95,
      new.success_rate
        + round(v_engineer_level * 3 * (v_multiplier - 1))::integer
    );
  end if;

  v_base_duration := greatest(
    1,
    new.completes_game_day_index - new.starts_game_day_index
  );
  new.completes_game_day_index := new.starts_game_day_index + greatest(
    1,
    ceil(v_base_duration / v_multiplier)::integer
  );
  return new;
end;
$$;

drop trigger if exists apply_federal_staff_to_equipment_rnd
  on public.equipment_rnd_projects;
create trigger apply_federal_staff_to_equipment_rnd
before insert on public.equipment_rnd_projects
for each row execute function public.apply_federal_staff_to_equipment_rnd();

comment on column public.youth_scouting_missions.federal_staff_spec_report_bonus_percentage is
  'Précision du rapport figée à la fin de la mission par l’École des recruteurs.';
comment on column public.staff_academy_trainings.federal_duration_reduction_percentage is
  'Réduction de durée figée au lancement par l’orientation fédérale du métier.';

revoke all on function public.get_staff_contract_federal_institute_multiplier(uuid)
  from public, anon;
revoke all on function public.get_staff_contract_federal_training_reduction(uuid)
  from public, anon;
grant execute on function public.get_staff_contract_federal_institute_multiplier(uuid)
  to authenticated, service_role;
grant execute on function public.get_staff_contract_federal_training_reduction(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
