// SQL for real, explicitly requested one-shot gameplay. No worker or cron.
import assert from 'node:assert/strict';
import {managedS5YouthTuitionPostcheckSql} from './managed-s5-youth-tuition-20261106.mjs';

export const MANAGED_S5_ACTION_KEYS=Object.freeze(['antoine_morel_29','elodie_martin','giulia_rinaldi','mikkel_sorensen','pixel_sprint','rafael_costa','shadow_peloton','thomas_vermeulen']);
export const MANAGED_S5_SEASON='7ea43c15-30fd-4878-b18f-ab2a43ad3be8';
export function managedS5ActionBatches(actions){
  // Teams are independent; preserve each team's order while avoiding a new
  // database connection for every alternating entry of the offline planner.
  const byTeam=new Map();
  for(const action of actions){
    assert.ok(MANAGED_S5_ACTION_KEYS.includes(action.bot_key));
    if(!byTeam.has(action.bot_key))byTeam.set(action.bot_key,[]);
    byTeam.get(action.bot_key).push(action);
  }
  const batches=[];
  for(const teamActions of byTeam.values())for(const action of teamActions){
    const last=batches.at(-1),limit=action.rpc==='sign_current_team_free_agent'?2:4;
    if(last&&last[0].bot_key===action.bot_key&&last[0].rpc===action.rpc&&last.length<limit)last.push(action);else batches.push([action]);
  }
  return batches;
}
const definitions={
  sign_current_team_free_agent:{p_rider_id:'uuid'},
  renew_current_team_rider_until:{p_rider_id:'uuid',p_target_end_game_year:'integer'},
  save_current_team_race_roster:{p_race_edition_id:'uuid',p_rider_ids:'uuid[]'},
  save_current_team_race_preparation_with_sprint:{p_race_edition_id:'uuid',p_stage_id:'uuid',p_roles:'jsonb',p_strategy:'jsonb'},
  save_current_team_time_trial_preparation:{p_race_edition_id:'uuid',p_stage_id:'uuid',p_plan:'jsonb'},
  book_current_team_form_camps:{p_rider_ids:'uuid[]',p_camp_type:'text',p_start_day_number:'integer',p_end_day_number:'integer'},
  book_current_team_stage_reconnaissance:{p_stage_id:'uuid',p_rider_ids:'uuid[]',p_start_day_number:'integer',p_preparer_contract_id:'uuid?'},
  start_current_team_rider_performance_preparation:{p_rider_id:'uuid',p_preparation_type:'text'},
  start_current_team_infrastructure_project:{p_infrastructure_code:'text',p_country_id:'uuid?',p_architect_contract_id:'uuid?'},
  start_current_team_youth_scouting:{p_scout_contract_id:'uuid',p_country_id:'uuid',p_duration_days:'integer'},
  sign_current_team_youth_candidate:{p_candidate_id:'uuid'},
  create_current_development_team:{p_academy_rider_ids:'uuid[]',p_jersey_pattern:'text',p_jersey_primary_color:'text',p_jersey_secondary_color:'text',p_jersey_accent_color:'text'},
  register_current_development_race:{p_race_edition_id:'uuid',p_academy_rider_ids:'uuid[]'},
  save_current_youth_training_settings_bulk:{p_changes:'jsonb'},
  save_current_rider_training_plans_v2:{p_plans:'jsonb'},
  save_current_team_training_settings:{p_minimum_form:'percentage'},
  hire_current_team_staff:{p_listing_id:'uuid'},
  assign_current_team_physiotherapist_matrix:{p_assignments:'jsonb'},
  apply_current_team_nutrition_interventions:{p_interventions:'jsonb'},
  purchase_current_team_equipment_cart:{p_items:'jsonb'},
  save_current_team_equipment_assignments:{p_assignments:'jsonb'},
};
export const sqlText=value=>"'"+String(value).replaceAll("'","''")+"'";
export function sqlUuid(value){assert.match(value??'',/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);return sqlText(value)+'::uuid';}
function typedValue(value,type){
  if(type==='uuid?')return value===null?'null::uuid':sqlUuid(value);
  if(type==='uuid')return sqlUuid(value);
  if(type==='uuid[]'){assert.ok(Array.isArray(value)&&value.length>0&&value.length<=35);assert.equal(new Set(value).size,value.length);return `array[${value.map(sqlUuid).join(',')}]::uuid[]`;}
  if(type==='integer'){assert.ok(Number.isInteger(value)&&value>=1&&value<=28);return String(value);}
  if(type==='percentage'){assert.ok(Number.isInteger(value)&&value>=0&&value<=100);return String(value);}
  if(type==='text'){assert.equal(typeof value,'string');assert.ok(value.length>0&&value.length<=100);return sqlText(value);}
  assert.equal(type,'jsonb');assert.ok(value!==null&&typeof value==='object');assert.ok(JSON.stringify(value).length<=150000);
  return sqlText(JSON.stringify(value))+'::jsonb';
}
export function nativeActionCall(action){
  let spec=definitions[action.rpc];assert.ok(spec,'RPC not authorized for this one-shot');
  if(action.rpc==='save_current_team_time_trial_preparation'){
    if(Object.hasOwn(action.args,'p_roles')||Object.hasOwn(action.args,'p_strategy'))spec={...spec,p_roles:'jsonb',p_strategy:'jsonb'};
    const plans=action.args.p_plan;
    assert.ok(Array.isArray(plans)&&plans.length>0&&plans.length<=35,'A complete time-trial roster is required');
    assert.equal(new Set(plans.map(p=>p.riderId)).size,plans.length,'Duplicate time-trial rider');
    for(const p of plans){sqlUuid(p.riderId);assert.ok(['conserve','normal','all_in'].includes(p.effortMode),'Invalid time-trial effort');}
    if(Object.hasOwn(spec,'p_roles')){
      assert.ok(plans.every(p=>Number.isFinite(p.relaySharePct)&&p.relaySharePct>=0&&p.relaySharePct<=100),'Invalid relay share');
      assert.equal(plans.reduce((sum,p)=>sum+Math.round(p.relaySharePct*100),0),10000,'Relays must total exactly 100 percent');
      assert.deepEqual(action.args.p_roles.map(p=>p.riderId).sort(),plans.map(p=>p.riderId).sort(),'TTT roles must cover the plan');
    }
  }
  assert.deepEqual(Object.keys(action.args).sort(),Object.keys(spec).sort(),'RPC argument mismatch');
  return `public.${action.rpc}(${Object.entries(spec).map(([key,type])=>`${key} => ${typedValue(action.args[key],type)}`).join(',')})`;
}
function money(value){assert.ok(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=10000000);return String(value);}
export function managedS5ActionSql(action,team){
  assert.ok(MANAGED_S5_ACTION_KEYS.includes(action.bot_key));assert.equal(action.bot_key,team.bot_key);
  assert.match(action.key??'',/^[a-z0-9:_-]{3,150}$/i);assert.equal(team.season_id,MANAGED_S5_SEASON);
  const call=nativeActionCall(action);
  const marker='owner-s5-20261106:'+action.key;
  const rider=action.args.p_rider_id;
  const isRecruit=action.rpc==='sign_current_team_free_agent';
  const isRenew=action.rpc==='renew_current_team_rider_until';
  let pre='',post='';
  if(isRecruit){
    pre=`if not exists(select 1 from public.riders r where r.id=${sqlUuid(rider)} and r.status='free_agent')
      or exists(select 1 from public.rider_contracts c where c.rider_id=${sqlUuid(rider)} and c.status in('active','planned'))
      or exists(select 1 from public.transfer_market_listings l where l.rider_id=${sqlUuid(rider)} and l.status='open')
      or exists(select 1 from public.season_draft_riders p join public.season_draft_editions e on e.id=p.edition_id
        where p.rider_id=${sqlUuid(rider)} and (e.status in('preparing','running') or (e.status='scheduled' and e.pool_reserved_at is not null)))
      then raise exception 'Recruitment eligibility changed: %',${sqlUuid(rider)};end if;`;
  }
  if(isRecruit||isRenew){
    assert.ok(Number.isFinite(action.max_salary)&&action.max_salary>0);
    post=`if not exists(select 1 from public.rider_contracts c join public.seasons e on e.id=c.end_season_id
      where c.rider_id=${sqlUuid(rider)} and c.team_id=${sqlUuid(team.team_id)}
        and c.status=${sqlText(isRecruit?'active':'planned')} and c.salary_per_season<=${money(action.max_salary)}
        and e.game_year=${isRecruit?6:action.args.p_target_end_game_year}) then
      raise exception 'Contract result or salary exceeded the reviewed plan';end if;`;
  }
  if(action.rpc==='hire_current_team_staff'){
    assert.ok(Number.isFinite(action.max_salary)&&action.max_salary>0);
    post+=`if not exists(select 1 from public.staff_contracts c where c.id=(v_result->>0)::uuid
      and c.team_id=${sqlUuid(team.team_id)} and c.status='active' and c.salary_per_season<=${money(action.max_salary)})
      then raise exception 'Unexpected staff contract or salary';end if;`;
  }
  if(action.rpc==='sign_current_team_youth_candidate'){
    assert.ok(Number.isFinite(action.max_annual_tuition)&&action.max_annual_tuition>0);
    post+=managedS5YouthTuitionPostcheckSql(action,team);
    post+=`if not exists(select 1 from public.youth_academy_riders a where a.id=(v_result->>0)::uuid
      and a.team_id=${sqlUuid(team.team_id)} and a.tuition_per_season<=${money(action.max_annual_tuition)})
      then raise exception 'Academy tuition exceeded the reviewed ceiling';end if;`;
  }
  if(action.rpc==='save_current_team_race_roster')post+=`
    if (v_result#>>'{0,registration_status}') is distinct from 'accepted'
      or (v_result#>>'{0,registered_rider_count}')::integer<>${action.args.p_rider_ids.length}
      then raise exception 'Expected accepted roster was not saved';end if;`;
  if(action.rpc==='save_current_team_time_trial_preparation')post+=`
    if (v_result#>>'{0,saved_stage_id}')::uuid is distinct from ${sqlUuid(action.args.p_stage_id)}
      or (v_result#>>'{0,updated_rider_count}')::integer is distinct from ${action.args.p_plan.length}
      then raise exception 'Expected individual time-trial preparation was not saved';end if;`;
  if(action.rpc==='create_current_development_team')post+=`
    if (v_result->0->>'rosterCount')::integer is distinct from ${action.args.p_academy_rider_ids.length}
      then raise exception 'Unexpected development team roster';end if;`;
  if(action.rpc==='register_current_development_race')post+=`
    if (v_result->0->>'riderCount')::integer is distinct from ${action.args.p_academy_rider_ids.length}
      then raise exception 'Unexpected development race roster';end if;`;
  if(action.rpc==='assign_current_team_physiotherapist_matrix')post+=`
    if (v_result->>0)::integer is distinct from ${action.args.p_assignments.length}
      then raise exception 'Unexpected physiotherapist assignment count';end if;`;
  if(action.rpc==='apply_current_team_nutrition_interventions')post+=`
    if jsonb_typeof(v_result->0) is distinct from 'array' or jsonb_array_length(v_result->0)<>${action.args.p_interventions.length}
      then raise exception 'Unexpected nutrition intervention count';end if;`;
  if(action.rpc==='save_current_rider_training_plans_v2')post+=`
    if jsonb_typeof(v_result->0->'results') is distinct from 'array'
      or jsonb_array_length(v_result->0->'results')<>${action.args.p_plans.length}
      or exists(select 1 from jsonb_array_elements(v_result->0->'results') item where item->>'status' is distinct from 'saved')
      then raise exception 'Training returned a failed rider';end if;`;
  return `do $managed_action$
    declare v_manager uuid;v_receipt uuid;v_previous jsonb;v_before_cash numeric;v_after_cash numeric;v_projected numeric;v_result jsonb;
    begin
      if (clock_timestamp() at time zone 'Europe/Paris')::date<>date '2026-11-06' then raise exception 'One-shot date changed';end if;
      if not pg_try_advisory_xact_lock(hashtextextended(${sqlText(team.bot_key+':'+marker)},0)) then raise exception 'Action already running';end if;
      select b.id into v_manager from public.alpha_bot_managers b
      join public.sporting_directors d on d.id=b.sporting_director_id and d.auth_user_id=b.auth_user_id
      join public.team_manager_assignments a on a.team_id=b.team_id and a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
      join public.team_seasons ts on ts.team_id=b.team_id join public.seasons s on s.id=ts.season_id
      where b.bot_key=${sqlText(team.bot_key)} and b.team_id=${sqlUuid(team.team_id)} and d.id=${sqlUuid(team.director_id)}
        and b.auth_user_id=${sqlUuid(team.auth_user_id)} and d.status='active' and not b.enabled
        and b.automation_season_id is null and b.automation_end_day_number is null
        and ts.id=${sqlUuid(team.team_season_id)} and s.id=${sqlUuid(MANAGED_S5_SEASON)} and s.status='active'
        and s.game_year=5 and s.current_day_number=1;
      if v_manager is null then raise exception 'Managed team identity, scope or season changed';end if;
      select id,actions into v_receipt,v_previous from public.alpha_bot_cycles where manager_id=v_manager and cycle_key=${sqlText(marker)} and status='completed';
      if found then
        if v_previous->0->>'rpc' is distinct from ${sqlText(action.rpc)}
          or v_previous->0->'args' is distinct from ${sqlText(JSON.stringify(action.args))}::jsonb then
          raise exception 'Receipt payload changed; review a distinct action key';
        end if;
        insert into managed_results values(${sqlText(action.bot_key)},${sqlText(action.key)},'already_done','null'::jsonb);
        return;
      end if;
      if exists(select 1 from public.alpha_bot_cycles where manager_id=v_manager and cycle_key=${sqlText(marker)}) then raise exception 'Unexpected prior action state';end if;
      perform set_config('request.jwt.claim.sub',${sqlText(team.auth_user_id)},true);
      perform set_config('request.jwt.claims',${sqlText(JSON.stringify({sub:team.auth_user_id,role:'authenticated'}))},true);
      select cash_balance into v_before_cash from public.team_seasons where id=${sqlUuid(team.team_season_id)};
      ${pre}
      select coalesce(jsonb_agg(to_jsonb(native_result)),'[]'::jsonb) into v_result from ${call} native_result;
      ${post}
      select ts.cash_balance,ts.cash_balance+coalesce((select sum(f.amount) from public.team_finance_transactions f
        where f.team_season_id=ts.id and f.status='pending'),0) into v_after_cash,v_projected
        from public.team_seasons ts where ts.id=${sqlUuid(team.team_season_id)};
      if v_after_cash<${money(action.min_cash??15000)} or v_projected<${money(action.min_projected??25000)}
        or v_before_cash-v_after_cash>${money(action.max_cash_cost??0)}+.01 then
        raise exception 'Reviewed cash/projection/cost limit exceeded for %: cash %, projected %, cost %',${sqlText(action.key)},v_after_cash,v_projected,v_before_cash-v_after_cash;
      end if;
      insert into public.alpha_bot_cycles(manager_id,cycle_key,slot,status,attempt_count,actions,started_at,completed_at)
        values(v_manager,${sqlText(marker)},'morning','completed',1,
          jsonb_build_array(jsonb_build_object('key',${sqlText(action.key)},'rpc',${sqlText(action.rpc)},'args',${sqlText(JSON.stringify(action.args))}::jsonb,'result',v_result,'cashCost',v_before_cash-v_after_cash)),now(),now());
      insert into managed_results values(${sqlText(action.bot_key)},${sqlText(action.key)},'applied',jsonb_build_object('native',v_result,'cash',v_after_cash,'projected',v_projected,'cost',v_before_cash-v_after_cash));
    end;
    $managed_action$;`;
}
export function managedS5BatchSql(actions,teams){
  assert.ok(actions.length>0&&actions.length<=4);assert.equal(new Set(actions.map(a=>a.bot_key)).size,1);
  assert.equal(new Set(actions.map(a=>a.key)).size,actions.length);
  return `begin;set local application_name='managed-s5-one-shot-20261106';set local statement_timeout='8s';set local lock_timeout='500ms';
    create temporary table managed_results(bot_key text,action_key text,status text,result jsonb) on commit drop;
    ${actions.map(a=>managedS5ActionSql(a,teams.find(t=>t.bot_key===a.bot_key))).join('\n')}
    select * from managed_results order by action_key;commit;`;
}
