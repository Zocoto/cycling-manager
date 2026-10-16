begin;
set local lock_timeout='2s';
set local statement_timeout='10s';

-- Preserve the full call-up/security/conflict rules. Compute the national
-- calendar once per relevant country/season instead of once per rider.
do $migration$
declare
 v_definition text;
 v_anchor text := E'  cross join lateral public.get_national_federation_selection_schedule(\n    country.id, season.id\n  ) as schedule';
begin
 select replace(pg_get_functiondef('public.get_current_director_federation_callups()'::regprocedure),chr(13),'') into v_definition;
 if position('incident_callup_schedule_once_v1' in v_definition)>0 then return; end if;
 if position(v_anchor in v_definition)=0 or position(E'  select member.id, country.iso_alpha2, country.name,' in v_definition)=0 then
  raise exception 'Unexpected call-up function definition: review before applying';
 end if;
 v_definition := replace(v_definition,E'  select member.id, country.iso_alpha2, country.name,',E'  -- incident_callup_schedule_once_v1\n  with viewer_scopes as materialized (\n    select distinct selection_list.country_id,selection_list.season_id\n    from public.sporting_directors director\n    join public.team_manager_assignments assignment\n      on assignment.sporting_director_id=director.id\n      and assignment.role=''general_manager'' and assignment.status=''active''\n    join public.national_federation_selection_members member\n      on member.owner_team_id=assignment.team_id and member.owner_director_id=director.id\n    join public.national_federation_selection_lists selection_list on selection_list.id=member.selection_list_id\n    join public.seasons season on season.id=selection_list.season_id and season.status=''active''\n    where director.auth_user_id=(select auth.uid()) and director.status=''active''\n      and member.response_status<>''draft'' and selection_list.published_at is not null\n  ), selection_schedules as materialized (\n    select scope.country_id as schedule_country_id,scope.season_id as schedule_season_id,schedule.*\n    from viewer_scopes scope\n    cross join lateral public.get_national_federation_selection_schedule(scope.country_id,scope.season_id) schedule\n  )\n  select member.id, country.iso_alpha2, country.name,');
 v_definition := replace(v_definition,v_anchor,E'  join selection_schedules as schedule\n    on schedule.schedule_country_id=country.id and schedule.schedule_season_id=season.id');
 execute v_definition;
end;
$migration$;

-- Publication, like responses, synchronizes only its own list in the same
-- transaction. This replaces the application's global forced rebuild.
do $migration$
declare v_definition text;
begin
 select replace(pg_get_functiondef('public.publish_national_federation_preselection(text,text)'::regprocedure),chr(13),'') into v_definition;
 if position('incident_publish_sync_once_v1' in v_definition)>0 then return; end if;
 if position('  return v_notified;' in v_definition)=0 then
  raise exception 'Unexpected publication function definition: review before applying';
 end if;
 v_definition:=replace(v_definition,'  return v_notified;',E'  -- incident_publish_sync_once_v1\n  perform public.sync_national_federation_championship_lineup(v_list.id);\n  return v_notified;');
 execute v_definition;
end;
$migration$;

notify pgrst,'reload schema';
commit;
