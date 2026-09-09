begin;

-- Maintenance raisonnée n'avait aucun coût de maintenance à consommer.
-- Chaque détenteur reçoit en priorité l'affixe économique existant le plus proche.
update public.staff_member_talents as maintenance
set talent_code = 'architect_construction_cost'
where maintenance.talent_code = 'architect_maintenance_cost'
  and not exists (
    select 1
    from public.staff_member_talents as existing
    where existing.staff_member_id = maintenance.staff_member_id
      and existing.talent_code = 'architect_construction_cost'
  );

update public.staff_member_talents as maintenance
set talent_code = 'architect_construction_time'
where maintenance.talent_code = 'architect_maintenance_cost'
  and not exists (
    select 1
    from public.staff_member_talents as existing
    where existing.staff_member_id = maintenance.staff_member_id
      and existing.talent_code = 'architect_construction_time'
  );

update public.staff_member_talents as maintenance
set talent_code = 'architect_building_efficiency'
from public.staff_members as member
where maintenance.talent_code = 'architect_maintenance_cost'
  and member.id = maintenance.staff_member_id
  and member.level >= 2
  and not exists (
    select 1
    from public.staff_member_talents as existing
    where existing.staff_member_id = maintenance.staff_member_id
      and existing.talent_code = 'architect_building_efficiency'
  );

update public.staff_member_talents as maintenance
set talent_code = 'architect_parallel_construction'
from public.staff_members as member
where maintenance.talent_code = 'architect_maintenance_cost'
  and member.id = maintenance.staff_member_id
  and member.level >= 3
  and not exists (
    select 1
    from public.staff_member_talents as existing
    where existing.staff_member_id = maintenance.staff_member_id
      and existing.talent_code = 'architect_parallel_construction'
  );

-- Cas défensif : un architecte possédant déjà tous les affixes compatibles ne
-- doit pas conserver une capacité inactive dans un emplacement.
delete from public.staff_member_talents
where talent_code = 'architect_maintenance_cost';

update public.staff_talent_catalog
set is_active = false
where code = 'architect_maintenance_cost';

create or replace function public.get_team_architect_effective_quotes(
  p_team_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with architects as (
    select
      contract.id as contract_id,
      member.level,
      case coalesce(member.architect_specialty, 'balanced')
        when 'economist' then member.level * 6
        when 'foreman' then member.level * 2
        else member.level * 4
      end as base_cost_reduction,
      case coalesce(member.architect_specialty, 'balanced')
        when 'economist' then member.level * 2
        when 'foreman' then member.level * 6
        else member.level * 4
      end as base_duration_reduction
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'architect'
    where contract.team_id = p_team_id
      and contract.status = 'active'
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'contractId', contract_id,
        'costReductionPercentage', public.get_architect_adjusted_reduction(
          contract_id,
          base_cost_reduction,
          'cost'
        ),
        'durationReductionPercentage', public.get_architect_adjusted_reduction(
          contract_id,
          base_duration_reduction,
          'duration'
        )
      ) order by contract_id
    ),
    '[]'::jsonb
  )
  from architects;
$$;

comment on function public.get_team_architect_effective_quotes(uuid)
is 'Retourne en une requête les réductions réellement appliquées aux devis de construction.';

revoke execute on function public.get_team_architect_effective_quotes(uuid)
from public, anon, authenticated;
grant execute on function public.get_team_architect_effective_quotes(uuid)
to service_role;

create or replace function public.get_team_medical_staff_effective_quotes(
  p_team_id uuid,
  p_team_season_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with valid_context as (
    select team_season.id, team_season.team_id
    from public.team_seasons as team_season
    where team_season.id = p_team_season_id
      and team_season.team_id = p_team_id
  ), nutritionists as (
    select contract.id as contract_id, member.level
    from valid_context
    join public.staff_contracts as contract
      on contract.team_id = valid_context.team_id
     and contract.status = 'active'
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'nutritionist'
  )
  select jsonb_build_object(
    'nutritionists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'contractId', contract_id,
          'dailyCapacity',
            public.get_nutritionist_daily_capacity(level)
            + public.get_staff_contract_talent_flat_bonus(
                contract_id,
                'nutrition_supplement_capacity',
                2
              ),
          'additionalFormBonus',
            public.get_staff_contract_talent_flat_bonus(
              contract_id,
              'nutrition_supplement_effectiveness',
              1
            ),
          'prices', jsonb_build_object(
            'recovery_snack', round(public.get_nutritionist_intervention_price(
              contract_id,
              500,
              level
            ), 2),
            'tailored_plan', round(public.get_nutritionist_intervention_price(
              contract_id,
              1200,
              level
            ), 2),
            'elite_recharge', round(public.get_nutritionist_intervention_price(
              contract_id,
              2500,
              level
            ), 2)
          )
        ) order by contract_id
      )
      from nutritionists
    ), '[]'::jsonb),
    'protocols', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', protocol.code,
          'price', public.get_team_doctor_protocol_price(
            p_team_season_id,
            protocol.price
          ),
          'durationReductionPct', public.get_team_doctor_protocol_effectiveness(
            p_team_season_id,
            protocol.duration_reduction_pct
          ),
          'formLossPerDay', public.get_team_doctor_protocol_form_loss(
            p_team_season_id,
            protocol.form_loss_per_day
          )
        ) order by protocol.price, protocol.code
      )
      from public.medical_protocol_catalog as protocol
      where protocol.is_active
        and exists (select 1 from valid_context)
    ), '[]'::jsonb)
  );
$$;

comment on function public.get_team_medical_staff_effective_quotes(uuid, uuid)
is 'Retourne les capacités, effets et prix médicaux réellement appliqués par les actions serveur.';

revoke execute on function public.get_team_medical_staff_effective_quotes(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.get_team_medical_staff_effective_quotes(uuid, uuid)
to service_role;

commit;
