begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

alter table public.equipment_rnd_projects
  add column research_focus text check(research_focus in('mountain','hills','cobbles','plain')),
  add column input_effect_payload jsonb,
  add column output_effect_payload jsonb,
  add column origin_effect_payload jsonb,
  add column engineer_snapshot jsonb;
create index equipment_rnd_output_lookup_idx on public.equipment_rnd_projects(prototype_equipment_item_id) where prototype_equipment_item_id is not null;

-- Exactly 60% primary, 20% secondary, 20% outside the chosen group.
-- A null focus retains the historical uniform distribution over all 13 stats.
create function public.choose_equipment_rnd_rating(p_focus text,p_roll double precision)
returns text language plpgsql immutable set search_path=public,pg_temp as $$
declare v_all text[]:=array['mountain','hills','flat','timeTrial','cobbles','sprint','acceleration','downhill','endurance','resistance','recovery','breakaway','prologue'];
  v_primary text[];v_secondary text[];v_other text[];v_pool text[];v_position double precision;
begin
  if p_roll is null or p_roll<0 or p_roll>=1 then raise exception 'Tirage R&D invalide.'; end if;
  if p_focus is null then return v_all[1+floor(p_roll*13)::integer]; end if;
  case p_focus
    when 'mountain' then v_primary:=array['mountain'];v_secondary:=array['endurance','resistance','recovery','downhill'];
    when 'hills' then v_primary:=array['hills','acceleration'];v_secondary:=array['resistance','endurance','breakaway'];
    when 'cobbles' then v_primary:=array['cobbles','resistance'];v_secondary:=array['flat','endurance','acceleration'];
    when 'plain' then v_primary:=array['flat','sprint','timeTrial'];v_secondary:=array['acceleration','endurance','prologue'];
    else raise exception 'Orientation R&D invalide.';
  end case;
  select array_agg(key order by position) into v_other from unnest(v_all) with ordinality a(key,position) where not(key=any(v_primary||v_secondary));
  if p_roll<0.6 then v_pool:=v_primary;v_position:=p_roll/0.6;
  elsif p_roll<0.8 then v_pool:=v_secondary;v_position:=(p_roll-0.6)/0.2;
  else v_pool:=v_other;v_position:=(p_roll-0.8)/0.2; end if;
  return v_pool[least(cardinality(v_pool),1+floor(v_position*cardinality(v_pool))::integer)];
end $$;

create function public.equipment_rnd_origin_payload(p_item uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_id uuid:=p_item;v_payload jsonb;v_parent uuid;v_saved jsonb;n integer;
begin
  for n in 1..100 loop
    select effect_payload into v_payload from public.equipment_catalog_items where id=v_id;
    if v_payload is null then return null; end if;
    select input_equipment_item_id,origin_effect_payload into v_parent,v_saved from public.equipment_rnd_projects
      where prototype_equipment_item_id=v_id order by completed_at desc nulls last,id limit 1;
    if v_saved is not null then return v_saved; end if;
    if v_parent is null then return v_payload; end if;
    if v_parent=v_id then raise exception 'Lignée de prototype invalide.'; end if;
    v_id:=v_parent;
  end loop;
  return null; -- Old lineage unavailable: display no invented origin values.
end $$;

create function public.equipment_rnd_engineer_profile(p_contract uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('contractId',c.id,'name',m.first_name||' '||m.last_name,'level',m.level,
    'countryName',country.name,'countryCode',country.iso_alpha2,
    'nationalityMultiplier',public.get_staff_contract_nationality_multiplier(c.id,null),
    'federalMultiplier',public.get_staff_contract_federal_institute_multiplier(c.id),
    'specialties',coalesce((select jsonb_agg(talent_code order by talent_code) from public.staff_member_talents where staff_member_id=m.id
      and talent_code in('research_time','research_cost','research_success','research_exceptional_chance')),'[]'::jsonb),
    'setbackProtected',public.get_equipment_rnd_setback_delta(c.id)=0,
    'exceptionalChancePercentage',1+(public.get_equipment_rnd_exceptional_chance(c.id)-1)*public.get_staff_contract_nationality_multiplier(c.id,null))
  from public.staff_contracts c join public.staff_members m on m.id=c.staff_member_id and m.role='research_engineer'
    left join public.countries country on country.id=m.country_id where c.id=p_contract and c.status='active';
$$;

-- This trigger affects NEW projects only. Existing success rates, deadlines and
-- draws remain unchanged. National affinity enhances staff talents, not the lab.
create or replace function public.apply_federal_staff_to_equipment_rnd()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_profile jsonb;v_payload jsonb;v_level integer;v_nat numeric;v_federal numeric;v_success integer;v_duration integer;
  v_has_time boolean;v_has_cost boolean;v_has_success boolean;
begin
  -- equipment_rnd_focus_audit_v1
  if new.engineer_contract_id is null then return new; end if;
  v_profile:=public.equipment_rnd_engineer_profile(new.engineer_contract_id);
  if v_profile is null then return new; end if;
  v_level:=(v_profile->>'level')::integer;v_nat:=(v_profile->>'nationalityMultiplier')::numeric;v_federal:=(v_profile->>'federalMultiplier')::numeric;
  v_has_time:=(v_profile->'specialties') ? 'research_time';v_has_cost:=(v_profile->'specialties') ? 'research_cost';v_has_success:=(v_profile->'specialties') ? 'research_success';
  select effect_payload into v_payload from public.equipment_catalog_items where id=new.input_equipment_item_id;
  v_success:=case when v_has_success then v_level*3 else 0 end;
  new.success_rate:=least(95,new.success_rate-v_success+round(v_success*v_nat*v_federal)::integer);
  v_duration:=greatest(1,ceil(ceil(public.calculate_equipment_rnd_base_duration_days(v_payload)
    *(1-case when v_has_cost then least(90,v_level*5*v_nat)/100 else 0 end))
    -case when v_has_time then v_level*v_nat else 0 end)::integer);
  new.completes_game_day_index:=new.starts_game_day_index+greatest(1,ceil(v_duration/v_federal)::integer);
  new.input_effect_payload:=v_payload;
  new.origin_effect_payload:=public.equipment_rnd_origin_payload(new.input_equipment_item_id);
  new.engineer_snapshot:=v_profile;
  return new;
end $$;

create function public.get_current_equipment_rnd_engineers()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(public.equipment_rnd_engineer_profile(c.id) order by m.last_name,m.first_name),'[]'::jsonb)
    from public.staff_contracts c join public.staff_members m on m.id=c.staff_member_id and m.role='research_engineer'
    join public.team_manager_assignments a on a.team_id=c.team_id and a.status='active' and a.role='general_manager'
    join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.auth_user_id=auth.uid()
    where c.status='active';
$$;

create function public.get_current_equipment_rnd_revisions(p_item_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_team uuid;v_result jsonb;
begin
  if coalesce(cardinality(p_item_ids),0)>200 then raise exception 'Trop de références demandées.'; end if;
  select a.team_id into v_team from public.team_manager_assignments a join public.sporting_directors d on d.id=a.sporting_director_id
    where d.auth_user_id=auth.uid() and d.status='active' and a.status='active' and a.role='general_manager' limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',item.id,'originPayload',public.equipment_rnd_origin_payload(item.id),
    'previousPayload',coalesce(project.input_effect_payload,previous.effect_payload))),'[]'::jsonb) into v_result
    from public.equipment_catalog_items item
    left join public.equipment_rnd_projects project on project.prototype_equipment_item_id=item.id and project.team_id=v_team
    left join public.equipment_catalog_items previous on previous.id=project.input_equipment_item_id
    where item.id=any(p_item_ids) and (item.owner_team_id=v_team or exists(select 1 from public.team_equipment_inventory inv
      join public.team_seasons ts on ts.id=inv.team_season_id where inv.equipment_item_id=item.id and ts.team_id=v_team));
  return v_result;
end $$;

create function public.start_current_team_equipment_rnd(p_equipment_item_id uuid,p_engineer_contract_id uuid,p_prototype_name text,p_research_focus text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_research_focus is not null and p_research_focus not in('mountain','hills','cobbles','plain') then raise exception 'Orientation R&D invalide.'; end if;
  v_id:=public.start_current_team_equipment_rnd(p_equipment_item_id,p_engineer_contract_id,p_prototype_name);
  update public.equipment_rnd_projects set research_focus=p_research_focus where id=v_id;
  return v_id;
end $$;

do $patch$
declare v_def text;v_old text;
begin
  v_def:=replace(pg_get_functiondef('public.settle_due_equipment_rnd_projects()'::regprocedure),chr(13),'');
  v_old:=$old$    v_key := (
      array[
        'mountain', 'hills', 'flat', 'timeTrial', 'cobbles', 'sprint',
        'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
        'breakaway', 'prologue'
      ]
    )[1 + floor(random() * 13)::integer];$old$;
  if position(v_old in v_def)=0 then raise exception 'Unexpected R&D rating draw.'; end if;
  v_def:=replace(v_def,v_old,'    v_key := public.choose_equipment_rnd_rating(v_project.research_focus,random()); -- equipment_rnd_focus_audit_v1');
  v_old:='    where item.id = v_project.input_equipment_item_id;';
  if position(v_old in v_def)=0 then raise exception 'R&D input selection missing.'; end if;
  v_def:=replace(v_def,v_old,v_old||chr(10)||'    if v_project.input_effect_payload is not null then v_item.effect_payload:=v_project.input_effect_payload; end if;');
  v_old:='public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id)';
  if position(v_old in v_def)=0 then raise exception 'Exceptional R&D path missing.'; end if;
  v_def:=replace(v_def,v_old,'coalesce((v_project.engineer_snapshot->>''exceptionalChancePercentage'')::numeric,public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id))');
  v_old:='v_delta := public.get_equipment_rnd_setback_delta(v_project.engineer_contract_id);';
  if position(v_old in v_def)=0 then raise exception 'Protected setback path missing.'; end if;
  v_def:=replace(v_def,v_old,'v_delta := case when v_project.engineer_snapshot is null then public.get_equipment_rnd_setback_delta(v_project.engineer_contract_id)
        when (v_project.engineer_snapshot->>''setbackProtected'')::boolean then 0 else -1 end;');
  v_old:='    insert into public.equipment_catalog_items (';
  if position(v_old in v_def)=0 then raise exception 'R&D prototype creation missing.'; end if;
  v_def:=replace(v_def,v_old,'    if v_delta=0 and v_project.engineer_snapshot is not null then v_payload:=v_item.effect_payload; end if;'||chr(10)||v_old);
  v_old:='set prototype_equipment_item_id = v_new_item,';
  if position(v_old in v_def)=0 then raise exception 'R&D result write missing.'; end if;
  execute replace(v_def,v_old,'set prototype_equipment_item_id = v_new_item, output_effect_payload = v_payload,');
end $patch$;

revoke all on function public.choose_equipment_rnd_rating(text,double precision),public.equipment_rnd_origin_payload(uuid),public.equipment_rnd_engineer_profile(uuid) from public,anon,authenticated;
revoke all on function public.get_current_equipment_rnd_engineers(),public.get_current_equipment_rnd_revisions(uuid[]),public.start_current_team_equipment_rnd(uuid,uuid,text,text) from public,anon;
grant execute on function public.get_current_equipment_rnd_engineers(),public.get_current_equipment_rnd_revisions(uuid[]),public.start_current_team_equipment_rnd(uuid,uuid,text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
