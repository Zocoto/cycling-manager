begin;

insert into public.staff_talent_catalog (
  code,
  role,
  display_name,
  minimum_level
)
values
  (
    'physio_rider_capacity',
    'physiotherapist',
    'Suivi élargi',
    1
  ),
  (
    'physio_fatigue_recovery',
    'physiotherapist',
    'Spécialiste de la fatigue',
    1
  ),
  (
    'preparer_reconnaissance_cost',
    'race_preparer',
    'Logistique négociée',
    1
  ),
  (
    'research_setback_protection',
    'research_engineer',
    'Maîtrise des revers',
    1
  )
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  minimum_level = excluded.minimum_level,
  is_active = true;

-- Le quota est calculé une seule fois au moment de valider la matrice. Le
-- palier supérieur à partir du niveau 4 reste volontairement un bonus fixe.
create or replace function public.get_physiotherapist_contract_rider_capacity(
  p_contract_id uuid,
  p_level integer
)
returns integer
language sql
stable
set search_path = public
as $$
  select public.get_physiotherapist_rider_capacity(p_level)
    + case
        when public.get_staff_contract_talent_flat_bonus(
          p_contract_id,
          'physio_rider_capacity',
          1
        ) > 0
        then case when greatest(1, coalesce(p_level, 1)) >= 4 then 2 else 1 end
        else 0
      end;
$$;

do $migration$
declare
  v_definition text;
  v_marker text;
  v_replacement text;
  v_count integer;
begin
  select pg_get_functiondef(
    'public.assign_current_team_physiotherapist_matrix(jsonb)'::regprocedure
  ) into v_definition;
  v_marker := 'having count(*) > public.get_physiotherapist_rider_capacity(member.level)';
  v_replacement := 'having count(*) > public.get_physiotherapist_contract_rider_capacity(requested.staff_contract_id, member.level)';
  v_count := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);
  if v_count <> 1 then
    raise exception 'Contrôle de capacité de la matrice kiné inattendu (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);

  select pg_get_functiondef(
    'public.assign_current_team_physiotherapist(uuid,uuid[])'::regprocedure
  ) into v_definition;
  v_marker := 'v_capacity := public.get_physiotherapist_rider_capacity(v_context.level);';
  v_replacement := 'v_capacity := public.get_physiotherapist_contract_rider_capacity(v_context.contract_id, v_context.level);';
  v_count := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);
  if v_count <> 1 then
    raise exception 'Contrôle de capacité du kiné inattendu (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

alter table public.rider_injuries
  add column if not exists physiotherapist_recovery_hours_reduced smallint
    not null default 0
    check (physiotherapist_recovery_hours_reduced between 0 and 30);

-- Cette lecture ne survient qu'à la création d'une blessure de fatigue. Les
-- index existants couvrent déjà le coureur, le contrat et le code du talent.
create or replace function public.get_rider_physio_fatigue_recovery_hours(
  p_rider_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(
    least(30, greatest(0, member.level) * 6)
  ), 0)::integer
  from public.staff_rider_assignments as assignment
  join public.staff_contracts as staff_contract
    on staff_contract.id = assignment.staff_contract_id
   and staff_contract.status = 'active'
  join public.staff_members as member
    on member.id = staff_contract.staff_member_id
   and member.role = 'physiotherapist'
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = 'physio_fatigue_recovery'
  join public.rider_contracts as rider_contract
    on rider_contract.rider_id = assignment.rider_id
   and rider_contract.team_id = staff_contract.team_id
   and rider_contract.status = 'active'
  where assignment.rider_id = p_rider_id
    and assignment.status = 'active';
$$;

-- Le trigger zz reste l'autorité finale sur les blessures de fatigue. Il
-- conserve la base de 72 h et applique uniquement le talent du kiné affecté.
create or replace function public.enforce_exact_fatigue_injury_duration()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_physio_reduction_hours integer := 0;
begin
  if new.diagnosis_code <> 'fatigue_exhaustion' then return new; end if;

  v_physio_reduction_hours := least(
    30,
    greatest(
      0,
      public.get_rider_physio_fatigue_recovery_hours(new.rider_id)
    )
  );
  new.injury_type := 'fatigue';
  new.severity := 'minor';
  new.recovery_days := 3;
  new.recovery_hours := 72;
  new.base_expected_recovery_at := new.started_at + interval '3 days';
  new.expected_recovery_at := new.started_at
    + make_interval(hours => 72 - v_physio_reduction_hours);
  new.form_loss_per_day := 0;
  new.protocol_code := null;
  new.doctor_recovery_hours_reduced := 0;
  new.federal_recovery_hours_reduced := 0;
  new.cryotherapy_recovery_hours_reduced := 0;
  new.federal_specialization_recovery_hours_reduced := 0;
  new.federal_specialization_form_loss_reduction := 0;
  new.physiotherapist_recovery_hours_reduced := v_physio_reduction_hours;
  return new;
end;
$$;

create or replace function public.prevent_fatigue_injury_treatment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.id = new.rider_injury_id
      and injury.diagnosis_code = 'fatigue_exhaustion'
  ) then
    raise exception 'Une blessure de fatigue impose un repos dont la durée est fixée au diagnostic.';
  end if;

  return new;
end;
$$;

create or replace function public.get_race_preparer_reconnaissance_price(
  p_contract_id uuid,
  p_base_price numeric,
  p_level integer
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(
    greatest(0, coalesce(p_base_price, 0)) * (
      1 - case
            when public.get_staff_contract_talent_flat_bonus(
              p_contract_id,
              'preparer_reconnaissance_cost',
              1
            ) > 0
            then least(20, greatest(0, coalesce(p_level, 0)) * 4)
            else 0
          end / 100.0
    ),
    2
  );
$$;

do $migration$
declare
  v_definition text;
  v_marker constant text := 'if v_context.cash_balance < v_total_price then';
  v_replacement constant text := E'v_total_price := public.get_race_preparer_reconnaissance_price(\n    p_preparer_contract_id,\n    v_total_price,\n    v_preparer_level\n  );\n\n  if v_context.cash_balance < v_total_price then';
  v_count integer;
begin
  select pg_get_functiondef(
    'public.book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)'::regprocedure
  ) into v_definition;
  v_count := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);
  if v_count <> 1 then
    raise exception 'Contrôle de trésorerie de la reconnaissance inattendu (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

create or replace function public.get_equipment_rnd_setback_delta(
  p_engineer_contract_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select case
    when public.get_staff_contract_talent_flat_bonus(
      p_engineer_contract_id,
      'research_setback_protection',
      1
    ) > 0 then 0
    else -1
  end;
$$;

do $migration$
declare
  v_definition text;
  v_marker constant text := 'v_delta := -1;';
  v_replacement constant text := 'v_delta := public.get_equipment_rnd_setback_delta(v_project.engineer_contract_id);';
  v_count integer;
begin
  select pg_get_functiondef(
    'public.settle_due_equipment_rnd_projects()'::regprocedure
  ) into v_definition;
  v_count := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);
  if v_count <> 1 then
    raise exception 'Traitement du revers R&D inattendu (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

comment on function public.get_physiotherapist_contract_rider_capacity(uuid, integer)
is 'Retourne le quota effectif d un kiné, talent Suivi élargi inclus.';
comment on function public.get_rider_physio_fatigue_recovery_hours(uuid)
is 'Retourne la réduction de fatigue du kiné actif déjà affecté au coureur.';
comment on function public.get_race_preparer_reconnaissance_price(uuid, numeric, integer)
is 'Applique la remise Logistique négociée au prix d une reconnaissance.';
comment on function public.get_equipment_rnd_setback_delta(uuid)
is 'Neutralise le malus d un revers R&D si l ingénieur possède Maîtrise des revers.';

revoke execute on function public.get_physiotherapist_contract_rider_capacity(uuid, integer)
from public, anon;
revoke execute on function public.get_rider_physio_fatigue_recovery_hours(uuid)
from public, anon;
revoke execute on function public.get_race_preparer_reconnaissance_price(uuid, numeric, integer)
from public, anon;
revoke execute on function public.get_equipment_rnd_setback_delta(uuid)
from public, anon;

grant execute on function public.get_physiotherapist_contract_rider_capacity(uuid, integer)
to authenticated, service_role;
grant execute on function public.get_rider_physio_fatigue_recovery_hours(uuid)
to authenticated, service_role;
grant execute on function public.get_race_preparer_reconnaissance_price(uuid, numeric, integer)
to authenticated, service_role;
grant execute on function public.get_equipment_rnd_setback_delta(uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
