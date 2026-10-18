begin;
set local application_name = 'callup-fix-migration-20261018';
set local lock_timeout = '2s';
set local statement_timeout = '10s';

alter table public.national_federation_selection_members
  drop constraint if exists national_federation_selection_members_response_allowed;
alter table public.national_federation_selection_members
  add constraint national_federation_selection_members_response_allowed
  check (response_status in ('draft', 'pending', 'confirmed', 'declined', 'ineligible'));

-- The same indexed checks serve display, replies and background maintenance.
-- NULL departure is a cheap suspect filter: any active injury merits checking
-- against the real departure, but is not by itself grounds for invalidation.
create or replace function public.get_federation_callup_ineligibility_reason(
  p_member_id uuid, p_departure_at timestamptz
) returns text language plpgsql stable security definer set search_path = ''
as $$
declare v_member record;
begin
  select member.*, selection_list.country_id, selection_list.season_id,
    season.game_year, season.status as season_status,
    slot.rider_category, slot.competition_code, slot.slot_key,
    coalesce(pro.status, junior.status) as rider_status,
    coalesce(pro.country_id, junior.country_id) as rider_country_id,
    junior.team_id as junior_team_id, junior.birth_game_year
  into v_member
  from public.national_federation_selection_members member
  join public.national_federation_selection_lists selection_list on selection_list.id=member.selection_list_id
  join public.seasons season on season.id=selection_list.season_id
  join public.national_federation_selection_slots slot on slot.slot_key=selection_list.slot_key
  left join public.riders pro on pro.id=member.professional_rider_id
  left join public.youth_academy_riders junior on junior.id=member.junior_rider_id
  where member.id=p_member_id;
  if not found then return 'missing_rider'; end if;
  if v_member.season_status <> 'active'
     or not public.federation_selection_slot_is_available(v_member.slot_key,v_member.game_year)
  then return 'inactive_competition'; end if;
  if v_member.rider_country_id is distinct from v_member.country_id then return 'nationality_changed'; end if;
  if v_member.professional_rider_id is not null then
    if v_member.rider_category <> 'professional'
       or v_member.rider_status is null or v_member.rider_status not in ('active','free_agent')
    then return 'rider_inactive'; end if;
    if v_member.owner_team_id is not null and not exists (
      select 1 from public.rider_contracts contract
      join public.teams team on team.id=contract.team_id and team.status='active'
      where contract.rider_id=v_member.professional_rider_id
        and contract.team_id=v_member.owner_team_id and contract.status='active'
    ) then return 'ownership_changed'; end if;
    if exists (
      select 1 from public.rider_injuries injury
      where injury.rider_id=v_member.professional_rider_id and injury.status='active'
        and (p_departure_at is null or (injury.started_at < p_departure_at and injury.expected_recovery_at > p_departure_at))
    ) then return 'injury'; end if;
    if v_member.competition_code='nations_cup'
       and coalesce(public.get_federation_selection_rider_limit(v_member.country_id,v_member.season_id,v_member.slot_key),0)=0
    then return 'nation_unqualified'; end if;
    if v_member.competition_code in ('continental_championship','world_championship') and not exists (
      select 1 from public.international_nation_qualification_snapshots qualification
      where qualification.season_id=v_member.season_id and qualification.country_id=v_member.country_id
        and qualification.competition_code=v_member.competition_code and qualification.is_qualified
    ) then return 'nation_unqualified'; end if;
  else
    if v_member.rider_category <> 'junior'
       or v_member.rider_status is null or v_member.rider_status not in ('active','recruited')
    then return 'rider_inactive'; end if;
    if v_member.game_year-v_member.birth_game_year not between 16 and 18 then return 'junior_age'; end if;
    if v_member.junior_team_id is distinct from v_member.owner_team_id then return 'ownership_changed'; end if;
  end if;
  if v_member.owner_director_id is not null and not exists (
    select 1 from public.team_manager_assignments assignment
    join public.sporting_directors director on director.id=assignment.sporting_director_id and director.status='active'
    join public.teams team on team.id=assignment.team_id and team.status='active'
    where assignment.team_id=v_member.owner_team_id and assignment.sporting_director_id=v_member.owner_director_id
      and assignment.role='general_manager' and assignment.status='active'
  ) then return 'ownership_changed'; end if;
  return null;
end;
$$;
revoke all on function public.get_federation_callup_ineligibility_reason(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.get_federation_callup_ineligibility_reason(uuid,timestamptz) to service_role;

create or replace function public.invalidate_ineligible_federation_callups(
  p_selection_list_id uuid, p_departure_at timestamptz
) returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if p_departure_at is null or p_departure_at <= now() then return 0; end if;
  perform 1 from public.national_federation_selection_lists where id=p_selection_list_id for update;
  update public.national_federation_selection_members member
  set response_status='ineligible',responded_at=now()
  where member.selection_list_id=p_selection_list_id and member.response_status in ('pending','confirmed')
    and public.get_federation_callup_ineligibility_reason(member.id,p_departure_at) is not null;
  get diagnostics v_count=row_count;
  if v_count>0 then
    update public.national_federation_selection_lists selection_list
    set updated_at=now(),status=case when selection_list.status='draft' then 'draft' when exists (
      select 1 from public.national_federation_selection_members member
      where member.selection_list_id=selection_list.id and member.response_status='pending'
    ) then 'pending_confirmation' else 'finalized' end
    where selection_list.id=p_selection_list_id;
  end if;
  return v_count;
end;
$$;
revoke all on function public.invalidate_ineligible_federation_callups(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.invalidate_ineligible_federation_callups(uuid,timestamptz) to service_role;

-- No new cron and no writes on page visits. Only suspect lists load a calendar;
-- at most twenty lists are repaired by each existing maintenance pass.
create or replace function public.reconcile_federation_callup_eligibility(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = '' set statement_timeout='10s'
as $$
declare v_list record; v_count integer; v_total integer:=0;
begin
  for v_list in
    with suspect_lists as materialized (
      select selection_list.id,selection_list.country_id,selection_list.season_id,selection_list.slot_key
      from public.national_federation_selection_lists selection_list
      join public.seasons season on season.id=selection_list.season_id and season.status='active'
      where selection_list.published_at is not null and exists (
        select 1 from public.national_federation_selection_members member
        where member.selection_list_id=selection_list.id and member.response_status in ('pending','confirmed')
          and public.get_federation_callup_ineligibility_reason(member.id,null) is not null
      )
    ), scopes as materialized (
      select distinct country_id,season_id from suspect_lists
    ), schedules as materialized (
      select scopes.country_id,scopes.season_id,schedule.* from scopes
      cross join lateral public.get_national_federation_selection_schedule(scopes.country_id,scopes.season_id) schedule
    )
    select selection_list.id,schedule.departure_at,schedule.rider_category
    from public.national_federation_selection_lists selection_list
    join suspect_lists suspect on suspect.id=selection_list.id
    join schedules schedule on schedule.country_id=suspect.country_id and schedule.season_id=suspect.season_id and schedule.slot_key=suspect.slot_key
    where schedule.departure_at>p_now and exists (
      select 1 from public.national_federation_selection_members member
      where member.selection_list_id=selection_list.id and member.response_status in ('pending','confirmed')
        and public.get_federation_callup_ineligibility_reason(member.id,schedule.departure_at) is not null
    )
    order by selection_list.id limit 20 for update of selection_list skip locked
  loop
    v_count:=public.invalidate_ineligible_federation_callups(v_list.id,v_list.departure_at);
    if v_count=0 then continue; end if;
    if v_list.rider_category='professional' then
      perform public.refill_national_federation_professional_selection(v_list.id,p_now);
      perform public.sync_national_federation_championship_lineup(v_list.id);
    else
      perform public.sync_national_federation_junior_lineup(v_list.id);
    end if;
    v_total:=v_total+v_count;
  end loop;
  return v_total;
end;
$$;
revoke all on function public.reconcile_federation_callup_eligibility(timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_federation_callup_eligibility(timestamptz) to service_role;

do $patch$
declare v_definition text; v_anchor text;
begin
  select replace(pg_get_functiondef('public.get_current_director_federation_callups()'::regprocedure),chr(13),'') into v_definition;
  if position('callup_eligibility_v1' in v_definition)=0 then
    v_anchor:=E'  )\n  select member.id, country.iso_alpha2, country.name,';
    if position(v_anchor in v_definition)=0 or position('incident_callup_schedule_once_v1' in v_definition)=0 then raise exception 'Unexpected callup directory: retain bounded schedules'; end if;
    v_definition:=replace(v_definition,v_anchor,$replacement$  ), member_eligibility as materialized (
    select member.id,case when member.response_status in ('pending','confirmed') and schedule.departure_at>now()
      then public.get_federation_callup_ineligibility_reason(member.id,schedule.departure_at) else null end as reason
    from public.national_federation_selection_members member
    join public.national_federation_selection_lists selection_list on selection_list.id=member.selection_list_id
    join selection_schedules schedule on schedule.schedule_country_id=selection_list.country_id
      and schedule.schedule_season_id=selection_list.season_id and schedule.slot_key=selection_list.slot_key
    where member.owner_director_id in (select director.id from public.sporting_directors director where director.auth_user_id=(select auth.uid()))
  )
  -- callup_eligibility_v1
  select member.id, country.iso_alpha2, country.name,$replacement$);
    v_definition:=replace(v_definition,'schedule.rider_category, member.response_status,',E'schedule.rider_category, case when eligibility.reason is not null then ''ineligible'' else member.response_status end,');
    v_definition:=replace(v_definition,E'member.response_status = ''pending''\n      and',E'member.response_status = ''pending''\n      and eligibility.reason is null\n      and');
    v_anchor:='  join public.national_federation_selection_lists as selection_list';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing callup eligibility join'; end if;
    v_definition:=replace(v_definition,v_anchor,E'  join member_eligibility eligibility on eligibility.id=member.id\n'||v_anchor);
    execute v_definition;
  end if;

  select replace(pg_get_functiondef('public.respond_to_national_federation_preselection(uuid,boolean)'::regprocedure),chr(13),'') into v_definition;
  if position('callup_eligibility_v1' in v_definition)=0 then
    v_anchor:='  if v_member.response_status <> ''pending'' then';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing pending-response guard'; end if;
    v_definition:=replace(v_definition,v_anchor,E'  if v_member.response_status = ''ineligible'' then return ''ineligible''; end if;\n'||v_anchor);
    v_definition:=replace(v_definition,'  v_president_id uuid;',E'  v_president_id uuid;\n  v_callup_departure timestamptz;');
    v_anchor:='  if p_accept is null then raise exception ''Décision invalide.''; end if;';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing callup response guard'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||$replacement$
  -- callup_eligibility_v1: an invalidation is committed, not rolled back by an exception.
  select schedule.departure_at into v_callup_departure
  from public.get_national_federation_selection_schedule(v_list.country_id,v_list.season_id) schedule
  where schedule.slot_key=v_list.slot_key;
  if public.get_federation_callup_ineligibility_reason(v_member.id,v_callup_departure) is not null then
    perform public.invalidate_ineligible_federation_callups(v_list.id,v_callup_departure);
    if v_member.professional_rider_id is not null then
      perform public.refill_national_federation_professional_selection(v_list.id,now());
      perform public.sync_national_federation_championship_lineup(v_list.id);
    else
      perform public.sync_national_federation_junior_lineup(v_list.id);
    end if;
    return 'ineligible';
  end if;$replacement$);
    execute v_definition;
  end if;

  select replace(pg_get_functiondef('public.publish_national_federation_preselection(text,text)'::regprocedure),chr(13),'') into v_definition;
  if position('callup_eligibility_v1' in v_definition)=0 then
    v_definition:=replace(v_definition,'  v_notified integer := 0;',E'  v_notified integer := 0;\n  v_callup_departure timestamptz;');
    v_anchor:='  perform public.assert_federation_selection_open(v_list.country_id, v_list.season_id, v_list.slot_key);';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing publication guard'; end if;
    v_definition:=replace(v_definition,v_anchor,v_anchor||$replacement$
  -- callup_eligibility_v1: no invalid draft is sent to a DS.
  select schedule.departure_at into v_callup_departure
  from public.get_national_federation_selection_schedule(v_list.country_id,v_list.season_id) schedule
  where schedule.slot_key=v_list.slot_key;
  update public.national_federation_selection_members member
  set response_status='ineligible',responded_at=now()
  where member.selection_list_id=v_list.id and member.response_status in ('draft','pending','confirmed')
    and public.get_federation_callup_ineligibility_reason(member.id,v_callup_departure) is not null;$replacement$);
    execute v_definition;
  end if;

  select replace(pg_get_functiondef('public.sync_national_federation_championship_lineup(uuid)'::regprocedure),chr(13),'') into v_definition;
  if position('callup_eligibility_v1' in v_definition)=0 then
    v_anchor:='  select link.race_registration_id, link.race_edition_id';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing scoped startlist sync anchor'; end if;
    v_definition:=replace(v_definition,v_anchor,E'  -- callup_eligibility_v1\n  if public.invalidate_ineligible_federation_callups(v_list.id,v_departure_at)>0 then\n    perform public.refill_national_federation_professional_selection(v_list.id,now());\n  end if;\n\n'||v_anchor);
    execute v_definition;
  end if;

  select replace(pg_get_functiondef('public.prepare_due_automatic_federation_professional_lineups(timestamptz)'::regprocedure),chr(13),'') into v_definition;
  if position('callup_eligibility_v1' in v_definition)=0 then
    v_anchor:=E'begin\n  select * into v_season';
    if position(v_anchor in v_definition)=0 then raise exception 'Missing maintenance hook'; end if;
    v_definition:=replace(v_definition,v_anchor,E'begin\n  -- callup_eligibility_v1\n  perform public.reconcile_federation_callup_eligibility(p_now);\n  select * into v_season');
    execute v_definition;
  end if;
end;
$patch$;

notify pgrst,'reload schema';
commit;
