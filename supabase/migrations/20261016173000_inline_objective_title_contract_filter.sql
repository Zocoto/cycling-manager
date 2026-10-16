begin;
set local application_name='query-performance-delivery-20261016';
set local lock_timeout='2s';
set local statement_timeout='10s';

-- Let the planner restrict contract ownership before processing title history.
-- The old SECURITY DEFINER scalar helper could not be inlined and was called
-- once for each title, six times across the career objective metrics.
do $migration$
declare
 v_definition text;
 v_helper text;
 v_anchor text:='public\.was_rider_contracted_by_team_in_season\(\s*title\.rider_id,\s*p_current_team_id,\s*title_season\.game_year\s*\)';
begin
 select replace(pg_get_functiondef('public.calculate_game_objective_progress_pre_recruitment_rewards(text,uuid,uuid,numeric)'::regprocedure),chr(13),'') into v_definition;
 if position('objective_title_contract_filter_v1' in v_definition)>0 then return; end if;
 select replace(pg_get_functiondef('public.was_rider_contracted_by_team_in_season(uuid,uuid,integer)'::regprocedure),chr(13),'') into v_helper;
 if position(E'contract.status in (''active'', ''completed'', ''terminated'')' in v_helper)=0
  or position('p_game_year between start_season.game_year and end_season.game_year' in v_helper)=0
  or (select count(*) from regexp_matches(v_definition,v_anchor,'g'))<>6 then
  raise exception 'Unexpected championship ownership rule: review before applying';
 end if;
 v_definition:=regexp_replace(v_definition,v_anchor,$replacement$exists (
          -- objective_title_contract_filter_v1
          select 1 from public.rider_contracts objective_contract
          join public.seasons objective_start on objective_start.id=objective_contract.start_season_id
          join public.seasons objective_end on objective_end.id=objective_contract.end_season_id
          where objective_contract.rider_id=title.rider_id
            and objective_contract.team_id=p_current_team_id
            and objective_contract.status in ('active','completed','terminated')
            and title_season.game_year between objective_start.game_year and objective_end.game_year
        )$replacement$,'g');
 execute v_definition;
end;
$migration$;

notify pgrst,'reload schema';
commit;
