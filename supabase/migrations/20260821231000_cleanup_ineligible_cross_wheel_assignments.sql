begin;

create or replace function public.cleanup_ineligible_cross_wheel_assignments(
  p_team_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer := 0;
  v_count integer := 0;
begin
  if p_team_id is null
    or public.team_has_mechanic_wheel_interchangeability(p_team_id) then
    return 0;
  end if;

  delete from public.rider_equipment_pending_assignments as pending
  using public.team_seasons as team_season,
        public.equipment_catalog_items as item
  where team_season.id = pending.team_season_id
    and team_season.team_id = p_team_id
    and item.id = pending.equipment_item_id
    and (
      (pending.slot_type = 'front_wheel' and item.slot_type = 'rear_wheel')
      or
      (pending.slot_type = 'rear_wheel' and item.slot_type = 'front_wheel')
    );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  delete from public.race_stage_equipment_assignments as planned
  using public.team_seasons as team_season,
        public.equipment_catalog_items as item
  where team_season.id = planned.team_season_id
    and team_season.team_id = p_team_id
    and item.id = planned.equipment_item_id
    and (
      (planned.slot_type = 'front_wheel' and item.slot_type = 'rear_wheel')
      or
      (planned.slot_type = 'rear_wheel' and item.slot_type = 'front_wheel')
    );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  delete from public.rider_equipment_assignments as equipped
  using public.rider_contracts as rider_contract,
        public.equipment_catalog_items as item
  where rider_contract.rider_id = equipped.rider_id
    and rider_contract.team_id = p_team_id
    and rider_contract.status = 'active'
    and item.id = equipped.equipment_item_id
    and (
      (equipped.slot_type = 'front_wheel' and item.slot_type = 'rear_wheel')
      or
      (equipped.slot_type = 'rear_wheel' and item.slot_type = 'front_wheel')
    );
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  return v_deleted;
end;
$$;

create or replace function public.cleanup_cross_wheels_after_staff_contract_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.cleanup_ineligible_cross_wheel_assignments(old.team_id);
    return old;
  end if;

  perform public.cleanup_ineligible_cross_wheel_assignments(old.team_id);
  if new.team_id is distinct from old.team_id then
    perform public.cleanup_ineligible_cross_wheel_assignments(new.team_id);
  end if;
  return new;
end;
$$;

drop trigger if exists cleanup_cross_wheels_after_staff_contract_change
  on public.staff_contracts;
create trigger cleanup_cross_wheels_after_staff_contract_change
after update of team_id, staff_member_id, status or delete
on public.staff_contracts
for each row
execute function public.cleanup_cross_wheels_after_staff_contract_change();

create or replace function public.cleanup_cross_wheels_after_staff_talent_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
begin
  for v_team_id in
    select distinct contract.team_id
    from public.staff_contracts as contract
    where contract.status = 'active'
      and contract.staff_member_id in (
        old.staff_member_id,
        case when tg_op = 'UPDATE' then new.staff_member_id else old.staff_member_id end
      )
  loop
    perform public.cleanup_ineligible_cross_wheel_assignments(v_team_id);
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists cleanup_cross_wheels_after_staff_talent_change
  on public.staff_member_talents;
create trigger cleanup_cross_wheels_after_staff_talent_change
after update of staff_member_id, talent_code or delete
on public.staff_member_talents
for each row
execute function public.cleanup_cross_wheels_after_staff_talent_change();

create or replace function public.cleanup_cross_wheels_after_staff_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
begin
  for v_team_id in
    select distinct contract.team_id
    from public.staff_contracts as contract
    where contract.staff_member_id = new.id
      and contract.status = 'active'
  loop
    perform public.cleanup_ineligible_cross_wheel_assignments(v_team_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists cleanup_cross_wheels_after_staff_member_change
  on public.staff_members;
create trigger cleanup_cross_wheels_after_staff_member_change
after update of role, level
on public.staff_members
for each row
execute function public.cleanup_cross_wheels_after_staff_member_change();

revoke all on function public.cleanup_ineligible_cross_wheel_assignments(uuid)
  from public, anon, authenticated;
grant execute on function public.cleanup_ineligible_cross_wheel_assignments(uuid)
  to service_role;

revoke all on function public.cleanup_cross_wheels_after_staff_contract_change()
  from public, anon, authenticated;
revoke all on function public.cleanup_cross_wheels_after_staff_talent_change()
  from public, anon, authenticated;
revoke all on function public.cleanup_cross_wheels_after_staff_member_change()
  from public, anon, authenticated;

comment on function public.cleanup_ineligible_cross_wheel_assignments(uuid) is
  'Retire les montages de roues croisés lorsque l’équipe ne possède plus de mécanicien actif éligible ; les pièces restent dans son inventaire.';

commit;
