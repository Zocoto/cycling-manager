begin;

-- Un ingénieur R&D sans talent n'apporte aucun bonus. Cette régularisation
-- défensive attribue le talent initial attendu aux éventuelles anciennes
-- lignes créées en dehors du marché quotidien.
insert into public.staff_member_talents (
  staff_member_id,
  slot_number,
  talent_code,
  unlocked_by
)
select
  member.id,
  1,
  case mod(abs(hashtext(member.id::text)::bigint), 3)
    when 0 then 'research_time'
    when 1 then 'research_cost'
    else 'research_success'
  end,
  'generation'
from public.staff_members as member
where member.role = 'research_engineer'
  and not exists (
    select 1
    from public.staff_member_talents as talent
    where talent.staff_member_id = member.id
  )
on conflict do nothing;

create or replace function public.start_current_team_equipment_rnd(
  p_equipment_item_id uuid,
  p_engineer_contract_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_level integer;
  v_required integer;
  v_owned integer;
  v_used integer;
  v_pending integer;
  v_engineer_member_id uuid;
  v_engineer_level integer := 0;
  v_has_research_time boolean := false;
  v_has_research_cost boolean := false;
  v_has_research_success boolean := false;
  v_success integer;
  v_duration integer;
  v_cost numeric;
  v_game_day integer;
  v_id uuid;
begin
  perform public.settle_current_team_finances();
  perform public.settle_due_equipment_rnd_projects();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    season_day.id as season_day_id
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
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active.';
  end if;

  select coalesce(max(level), 0)
  into v_level
  from public.team_infrastructures
  where team_id = v_context.team_id
    and infrastructure_code = 'research_lab';

  if v_level < 1 then
    raise exception 'Construisez d’abord le Laboratoire R&D.';
  end if;

  select *
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active'
    and acquisition_channel <> 'equipment_partner'
    and (owner_team_id is null or owner_team_id = v_context.team_id);

  if v_item is null then
    raise exception 'Cet équipement ne peut pas être soumis à la R&D.';
  end if;

  v_required := case v_item.slot_type
    when 'frame' then 1
    when 'front_wheel' then 2
    when 'rear_wheel' then 2
    when 'helmet' then 3
    when 'shoes' then 4
    when 'bib_shorts' then 5
    when 'gloves' then 6
    when 'glasses' then 7
    else 99
  end;

  if v_level < v_required then
    raise exception 'Le niveau du laboratoire ne débloque pas encore cette catégorie.';
  end if;

  if exists (
    select 1
    from public.equipment_rnd_projects
    where team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Une recherche R&D est déjà en cours.';
  end if;

  select coalesce(quantity, 0)
  into v_owned
  from public.team_equipment_inventory
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id;

  select count(*)
  into v_used
  from public.rider_equipment_assignments as assignment
  join public.rider_contracts as contract
    on contract.rider_id = assignment.rider_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  where assignment.equipment_item_id = p_equipment_item_id;

  select count(*)
  into v_pending
  from public.rider_equipment_pending_assignments as pending
  where pending.team_season_id = v_context.team_season_id
    and pending.equipment_item_id = p_equipment_item_id;

  if coalesce(v_owned, 0) <= coalesce(v_used, 0) + coalesce(v_pending, 0) then
    raise exception 'Aucun exemplaire libre de cette référence n’est disponible.';
  end if;

  if p_engineer_contract_id is not null then
    select member.id, member.level
    into v_engineer_member_id, v_engineer_level
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'research_engineer'
    where contract.id = p_engineer_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active';

    if v_engineer_level = 0 then
      raise exception 'Cet ingénieur R&D n’appartient pas à votre équipe.';
    end if;

    select
      coalesce(bool_or(talent.talent_code = 'research_time'), false),
      coalesce(bool_or(talent.talent_code = 'research_cost'), false),
      coalesce(bool_or(talent.talent_code = 'research_success'), false)
    into
      v_has_research_time,
      v_has_research_cost,
      v_has_research_success
    from public.staff_member_talents as talent
    where talent.staff_member_id = v_engineer_member_id;
  end if;

  v_success := least(
    95,
    45 + v_level * 5 +
      case when v_has_research_success then v_engineer_level * 3 else 0 end
  );
  v_duration := greatest(
    4,
    (array[18, 16, 14, 12, 10, 9, 8]::integer[])[v_level] -
      case when v_has_research_time then v_engineer_level else 0 end
  );
  v_cost := round(
    (100000 + v_level * 50000 + greatest(v_item.price, 1000) * 12) *
    (1 - case when v_has_research_cost then v_engineer_level * 0.05 else 0 end)
  );

  if v_context.cash_balance < v_cost then
    raise exception 'Trésorerie insuffisante pour cette recherche.';
  end if;

  update public.team_equipment_inventory
  set quantity = quantity - 1
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id
    and quantity > 1;

  if not found then
    delete from public.team_equipment_inventory
    where team_season_id = v_context.team_season_id
      and equipment_item_id = p_equipment_item_id;
  end if;

  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;

  insert into public.equipment_rnd_projects (
    team_id,
    started_team_season_id,
    input_equipment_item_id,
    engineer_contract_id,
    lab_level,
    success_rate,
    research_cost,
    starts_game_day_index,
    completes_game_day_index
  ) values (
    v_context.team_id,
    v_context.team_season_id,
    p_equipment_item_id,
    p_engineer_contract_id,
    v_level,
    v_success,
    v_cost,
    v_game_day,
    v_game_day + v_duration
  )
  returning id into v_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_cost,
    'equipment',
    'posted',
    'Recherche R&D · ' || v_item.name,
    'equipment-rnd:' || v_id::text,
    now()
  );

  update public.team_seasons
  set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;

  return v_id;
end;
$$;

revoke all on function public.start_current_team_equipment_rnd(uuid, uuid)
from public, anon;
grant execute on function public.start_current_team_equipment_rnd(uuid, uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
