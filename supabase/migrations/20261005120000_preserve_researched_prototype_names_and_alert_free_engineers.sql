begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The two-argument launcher continues to own inventory, engineer locking,
-- current-score duration, talents and the +10 cap. Names are only requested
-- when turning a commercial reference into its first prototype.
create or replace function public.start_current_team_equipment_rnd(
  p_equipment_item_id uuid,
  p_engineer_contract_id uuid,
  p_prototype_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prototype_name text;
  v_is_prototype boolean;
  v_project_id uuid;
begin
  select item.acquisition_channel = 'research_prototype'
  into v_is_prototype
  from public.equipment_catalog_items as item
  where item.id = p_equipment_item_id;

  if coalesce(v_is_prototype, false) then
    v_prototype_name := null;
  else
    v_prototype_name := regexp_replace(
      btrim(coalesce(p_prototype_name, '')), '[[:space:]]+', ' ', 'g'
    );
    if char_length(v_prototype_name) < 3 or char_length(v_prototype_name) > 60 then
      raise exception 'Le nom du prototype doit contenir entre 3 et 60 caractères.';
    end if;
  end if;

  v_project_id := public.start_current_team_equipment_rnd(
    p_equipment_item_id, p_engineer_contract_id
  );
  update public.equipment_rnd_projects
  set prototype_name = v_prototype_name
  where id = v_project_id;
  return v_project_id;
end;
$$;

-- Preserve the installed settlement (including exceptional +3 and setback
-- protection talents) and change only the choice of the output name. This
-- also applies to already running repeats and legacy two-argument launches.
do $migration$
declare
  v_definition text;
  v_marker constant text := E'      coalesce(\n'
    || E'        nullif(btrim(v_project.prototype_name), \'\'),\n'
    || E'        v_item.name || \' · Prototype \' || upper(substr(v_project.id::text, 1, 4))\n'
    || '      )';
  v_replacement constant text := E'      case\n'
    || E'        when v_item.acquisition_channel = \'research_prototype\' then v_item.name\n'
    || E'        else coalesce(\n'
    || E'          nullif(btrim(v_project.prototype_name), \'\'),\n'
    || E'          v_item.name || \' · Prototype \' || upper(substr(v_project.id::text, 1, 4))\n'
    || E'        )\n'
    || '      end';
  v_count integer;
begin
  select replace(pg_get_functiondef(
    'public.settle_due_equipment_rnd_projects()'::regprocedure
  ), chr(13), '') into v_definition;
  v_count := (length(v_definition) - length(replace(v_definition, v_marker, '')))
    / length(v_marker);
  if v_count <> 1 then
    raise exception 'Nom de prototype R&D attendu introuvable (% marqueurs).', v_count;
  end if;
  execute replace(v_definition, v_marker, v_replacement);
end;
$migration$;

-- Read-only, team-scoped opportunity check: do not load the full catalogue
-- or settle gameplay work just to render the Bureau.
create or replace function public.get_current_equipment_rnd_opportunity()
returns integer
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $$
declare
  v_team_id uuid;
  v_team_season_id uuid;
  v_lab_level integer;
  v_engineer_count integer;
  v_available_count integer;
  v_active_count integer;
begin
  select assignment.team_id, team_season.id, lab.level
  into v_team_id, v_team_season_id, v_lab_level
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id and team_season.status = 'active'
  join public.team_infrastructures as lab
    on lab.team_id = assignment.team_id and lab.infrastructure_code = 'research_lab'
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if v_team_id is null or coalesce(v_lab_level, 0) < 1 then return 0; end if;

  select count(*)::integer, count(*) filter (where not exists (
    select 1 from public.equipment_rnd_projects as project
    where project.team_id = v_team_id and project.status = 'active'
      and project.engineer_contract_id = contract.id
  ))::integer
  into v_engineer_count, v_available_count
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id and member.role = 'research_engineer'
  where contract.team_id = v_team_id and contract.status = 'active';

  select count(*)::integer into v_active_count
  from public.equipment_rnd_projects as project
  where project.team_id = v_team_id and project.status = 'active';
  v_available_count := least(v_available_count, greatest(0, v_engineer_count - v_active_count));
  if v_available_count < 1 then return 0; end if;

  if not exists (
    select 1
    from public.team_equipment_inventory as inventory
    join public.equipment_catalog_items as item on item.id = inventory.equipment_item_id
    where inventory.team_season_id = v_team_season_id and inventory.quantity > 0
      and item.status = 'active' and item.acquisition_channel <> 'equipment_partner'
      and (item.owner_team_id is null or item.owner_team_id = v_team_id)
      and public.calculate_equipment_rnd_bonus_total(item.effect_payload) < 10
      and v_lab_level >= case item.slot_type
        when 'frame' then 1 when 'front_wheel' then 2 when 'rear_wheel' then 2
        when 'helmet' then 3 when 'shoes' then 4 when 'bib_shorts' then 5
        when 'gloves' then 6 when 'glasses' then 7 else 99 end
      and inventory.quantity > (
        select count(*) from public.rider_equipment_assignments as equipped
        join public.rider_contracts as contract
          on contract.rider_id = equipped.rider_id
         and contract.team_id = v_team_id and contract.status = 'active'
        where equipped.equipment_item_id = item.id
      ) + (
        select count(*) from public.rider_equipment_pending_assignments as pending
        where pending.team_season_id = v_team_season_id and pending.equipment_item_id = item.id
      )
  ) then return 0; end if;

  return v_available_count;
end;
$$;

revoke all on function public.start_current_team_equipment_rnd(uuid, uuid, text) from public, anon;
grant execute on function public.start_current_team_equipment_rnd(uuid, uuid, text) to authenticated, service_role;
revoke all on function public.get_current_equipment_rnd_opportunity() from public, anon;
grant execute on function public.get_current_equipment_rnd_opportunity() to authenticated, service_role;

comment on function public.get_current_equipment_rnd_opportunity() is
  'Nombre d’ingénieurs libres du DS connecté, si une pièce libre est éligible à la R&D.';
notify pgrst, 'reload schema';
commit;
