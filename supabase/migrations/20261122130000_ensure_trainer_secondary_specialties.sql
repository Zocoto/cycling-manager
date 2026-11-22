begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- Historical coaches created before staff talents existed were intentionally
-- left without one. Bring them up to the current generation rule: one initial
-- secondary specialty, separate from the primary, with two academy slots left.
create function private.ensure_trainer_secondary_specialty(p_staff_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.staff_members%rowtype;
  v_slot smallint;
  v_talent_code text;
begin
  select * into v_member
  from public.staff_members
  where id = p_staff_member_id
  for update;

  -- Read the current row: a deferred event may outlive another update or a
  -- deletion in the same transaction. Never replace an existing talent.
  if not found or v_member.role <> 'trainer' then return null; end if;
  if exists (
    select 1 from public.staff_member_talents
    where staff_member_id = v_member.id
  ) then return null; end if;

  select candidate.slot_number::smallint into v_slot
  from generate_series(1, 3) as candidate(slot_number)
  where not exists (
    select 1 from public.staff_member_talents as owned
    where owned.staff_member_id = v_member.id
      and owned.slot_number = candidate.slot_number
  ) and not exists (
    select 1 from public.staff_academy_trainings as training
    where training.staff_member_id = v_member.id
      and training.status = 'active'
      and training.improvement_type = 'talent'
      and training.target_slot = candidate.slot_number
  )
  order by candidate.slot_number
  limit 1;

  select talent.code into v_talent_code
  from public.staff_talent_catalog as talent
  where talent.role = 'trainer'
    and talent.is_active
    and talent.minimum_level <= v_member.level
    and talent.code <> 'trainer_' || v_member.trainer_specialty
    and not exists (
      select 1 from public.staff_academy_trainings as training
      where training.staff_member_id = v_member.id
        and training.status = 'active'
        and training.improvement_type = 'talent'
        and talent.code = any(training.talent_choice_codes)
    )
  -- Stable selection distributes specialties without rerolling on retries.
  order by md5(v_member.id::text || ':' || talent.code), talent.code
  limit 1;

  if v_slot is null or v_talent_code is null then
    raise exception 'No compatible secondary specialty is available for coach %.', v_member.id;
  end if;

  insert into public.staff_member_talents (
    staff_member_id, slot_number, talent_code, unlocked_by
  ) values (v_member.id, v_slot, v_talent_code, 'generation');
  return v_talent_code;
end;
$$;

revoke all on function private.ensure_trainer_secondary_specialty(uuid)
  from public, anon, authenticated;
grant execute on function private.ensure_trainer_secondary_specialty(uuid)
  to service_role;

create function private.ensure_trainer_secondary_specialty_at_commit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_trainer_secondary_specialty(new.id);
  return null;
end;
$$;

revoke all on function private.ensure_trainer_secondary_specialty_at_commit()
  from public, anon, authenticated;

-- Market, custom recruitment and welcome gifts already insert their chosen
-- talent after creating the coach. Wait until commit so their choice wins and
-- cannot collide with an automatically filled first slot.
create constraint trigger ensure_trainer_secondary_specialty_on_commit
after insert or update on public.staff_members
deferrable initially deferred
for each row
when (new.role = 'trainer')
execute function private.ensure_trainer_secondary_specialty_at_commit();

do $$
declare
  v_staff_member_id uuid;
begin
  for v_staff_member_id in
    select member.id
    from public.staff_members as member
    where member.role = 'trainer'
      and not exists (
        select 1 from public.staff_member_talents as talent
        where talent.staff_member_id = member.id
      )
    order by member.id
  loop
    perform private.ensure_trainer_secondary_specialty(v_staff_member_id);
  end loop;
end;
$$;

comment on function private.ensure_trainer_secondary_specialty(uuid) is
  'Adds one compatible initial secondary specialty only to a talentless coach, preserving academy reservations and existing choices.';
comment on trigger ensure_trainer_secondary_specialty_on_commit on public.staff_members is
  'Guarantees an initial coach specialty at transaction end while preserving explicit generation talents.';

commit;
