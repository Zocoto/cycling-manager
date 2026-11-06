-- Draft signings remain free of fees. A negative projection does not prevent
-- acquiring the rider; normal salary and all roster/ownership guards remain.
begin;
set local lock_timeout='500ms';
set local statement_timeout='5s';
do $patch$
declare
  v_signature regprocedure;
  v_source text;
  v_old text;
begin
  v_signature := 'public.try_season_draft_pick(uuid,uuid,uuid)'::regprocedure;
  v_source := replace(pg_get_functiondef(v_signature),chr(13),'');
  v_old := $old$  if greatest(0,coalesce(public.get_projected_transfer_budget(v_ts),0)-coalesce(public.get_team_transfer_reserved_budget(p_team,null,null),0))<v_salary then return 'budget'; end if;$old$;
  if (length(v_source)-length(replace(v_source,v_old,'')))<>length(v_old) then
    raise exception 'Unexpected draft pick budget guard; correction aborted';
  end if;
  execute replace(v_source,v_old,'  -- Projected debt is allowed for draft signings; the normal salary remains due.');

  v_signature := 'public.advance_season_draft(uuid)'::regprocedure;
  v_source := replace(pg_get_functiondef(v_signature),chr(13),'');
  v_old := $old$select greatest(0,public.get_projected_transfer_budget(ts.id)-coalesce(public.get_team_transfer_reserved_budget(ts.team_id,null,null),0)) budget,
        coalesce(public.get_team_specialization_power(ts.team_id,'recruitment_data_room','deal_room'),0)*3 discount,
        public.get_team_roster_commitment_count$old$;
  if (length(v_source)-length(replace(v_source,v_old,'')))<>length(v_old) then
    raise exception 'Unexpected draft automatic budget quote; correction aborted';
  end if;
  v_source := replace(v_source,v_old,'select public.get_team_roster_commitment_count');
  v_old := $old$          and round(round(pool.salary_per_season*(1-v_auto.discount/100),2) / case
            when public.is_team_homegrown_rider(v_player.team_id,pool.rider_id) and exists(select 1 from public.rider_special_abilities a where a.rider_id=pool.rider_id and a.ability_code='homegrown') then 2 else 1 end,2)<=v_auto.budget$old$;
  if (length(v_source)-length(replace(v_source,v_old,'')))<>length(v_old) then
    raise exception 'Unexpected draft automatic affordability filter; correction aborted';
  end if;
  execute replace(v_source,v_old,'          -- Automatic draft choices depend on availability and roster capacity, not projected cash.');
end;
$patch$;
-- No edition, participant, previous pick, clock, contract or balance is changed.
commit;
