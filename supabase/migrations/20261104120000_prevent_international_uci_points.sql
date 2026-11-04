begin;
set local application_name = 'international-uci-guard-install';
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- Harden the two official reward entry points against stale callers. Resolve
-- the competition in the existing roster context lookup, without another
-- per-rider query, new trigger, table or ranking refresh. Keep historical
-- S1-S3 accounting and the full S3 continental void unchanged.
do $international_uci_guard$
declare
  v_function regprocedure;
  v_definition text;
  v_context_before text := $context$  select exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
    where roster.id = p_race_roster_id
  ) into v_void_rewards;$context$;
  v_context_after text := $context$  -- International championship UCI exclusion from S4.
  select
    season.game_year = 3 and race.competition_type = 'continental_championship',
    season.game_year >= 4 and race.competition_type in (
      'world_championship', 'continental_championship', 'nations_cup'
    )
  into v_void_rewards, v_no_uci
  from public.race_rosters as roster
  join public.race_registrations as registration on registration.id = roster.race_registration_id
  join public.race_editions as edition on edition.id = registration.race_edition_id
  join public.seasons as season on season.id = edition.season_id
  join public.races as race on race.id = edition.race_id
  where roster.id = p_race_roster_id;$context$;
  v_uci_before text := 'case when v_void_rewards then 0 else p_uci_points end';
begin
  v_context_before := replace(v_context_before,chr(13),'');
  v_context_after := replace(v_context_after,chr(13),'');
  foreach v_function in array array[
    'public.apply_race_roster_competition_reward(text,text,uuid,uuid,integer,integer,numeric,integer,boolean,text)'::regprocedure,
    'public.apply_detection_rider_competition_reward(text,text,uuid,uuid,integer,boolean,text)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(v_function),chr(13),'') into v_definition;
    if position('-- International championship UCI exclusion from S4.' in v_definition)>0 then continue; end if;
    if (length(v_definition)-length(replace(v_definition,v_context_before,'')))/length(v_context_before)<>1
      or (length(v_definition)-length(replace(v_definition,v_uci_before,'')))/length(v_uci_before)<>1
      or position('  v_void_rewards boolean;' in v_definition)=0 then
      raise exception 'Unexpected international reward function; review required: %',v_function;
    end if;
    v_definition:=replace(v_definition,'  v_void_rewards boolean;',E'  v_void_rewards boolean;\n  v_no_uci boolean;');
    v_definition:=replace(v_definition,v_context_before,v_context_after);
    v_definition:=replace(v_definition,v_uci_before,'case when v_void_rewards or v_no_uci then 0 else p_uci_points end');
    execute v_definition;
  end loop;
end;
$international_uci_guard$;

commit;
