import assert from 'node:assert/strict';
import test from 'node:test';
import {MANAGED_S5_ACTION_KEYS,MANAGED_S5_SEASON} from './managed-s5-action-sql-20261106.mjs';
import {createManagedFinanceAuditSql,verifyManagedFinanceAudit} from './managed-s5-finance-audit-20261106.mjs';

function fixture(){
  let serial=0;const uuid=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
  const identity=[],teams=[],actions=[],contracts=[],salary_installments=[],inventory=[],assignments=[],receipts=[];
  const activeCounts=[12,12,12,10,12,10,10,12],oldCounts=[4,4,4,4,4,4,3,4],renewCounts=[3,3,2,2,2,2,2,2];
  const record=action=>{actions.push(action);receipts.push({bot_key:action.bot_key,cycle_key:'owner-s5-20261106:'+action.key,status:'completed',
    actions:[{key:action.key,rpc:action.rpc,args:action.args,cashCost:action.max_cash_cost??0}]});};
  for(const [index,bot_key] of MANAGED_S5_ACTION_KEYS.entries()){
    const team_id=uuid(),team_season_id=uuid(),recruits=[],renewals=[];
    identity.push({bot_key,team_id,team_season_id});
    for(let i=0;i<activeCounts[index];i++){
      const rider_id=uuid(),id=uuid(),isNew=i>=oldCounts[index],salary=10000.01;
      contracts.push({id,rider_id,team_id,bot_key,status:'active',acquisition_type:isNew?'free_agent':'initial',start_year:isNew?5:4,end_year:isNew?6:5,salary_per_season:salary,transfer_fee:null});
      if(isNew){recruits.push({rider_id});record({bot_key,key:'recruit:'+rider_id,rpc:'sign_current_team_free_agent',args:{p_rider_id:rider_id},max_salary:10500.02,max_cash_cost:0});
        for(const day_number of [7,14,21,28])salary_installments.push({contract_id:id,game_year:5,day_number,status:'pending',amount:day_number===28?-2500.01:-2500});
      }else if(i<renewCounts[index]){
        renewals.push({rider_id,active_contract_id:id,previous_end_year:5,current_salary:salary});
        contracts.push({id:uuid(),rider_id,team_id,bot_key,status:'planned',acquisition_type:'renewal',start_year:6,end_year:6,salary_per_season:salary});
        record({bot_key,key:'renew:'+rider_id+':6',rpc:'renew_current_team_rider_until',args:{p_rider_id:rider_id,p_target_end_game_year:6},max_salary:10500.02,max_cash_cost:0});
      }
    }
    const item=uuid(),rider=recruits[0].rider_id,purchases=[{equipmentItemId:item,quantity:1}],equipmentAssignments=[{riderId:rider,slot:'helmet',equipmentItemId:item}];
    inventory.push({bot_key,equipment_item_id:item,quantity:1});assignments.push({bot_key,rider_id:rider,slot_type:'helmet',equipment_item_id:item});
    record({bot_key,key:`gear-purchase:${team_id}:S5`,rpc:'purchase_current_team_equipment_cart',args:{p_items:purchases},max_cash_cost:250});
    record({bot_key,key:`gear-equip:${team_id}:S5:0`,rpc:'save_current_team_equipment_assignments',args:{p_assignments:equipmentAssignments},max_cash_cost:0});
    teams.push({bot_key,team_id,team_season_id,planned_roster:activeCounts[index],recruits,renewals,equipment:{purchases,assignments:equipmentAssignments,total_cost:250}});
  }
  const restored_sponsors=['antoine_morel_29','giulia_rinaldi'].map(bot_key=>({bot_key,status:'active',offer_status:'accepted',generation_version:12,active_objectives:10,
    contract_duration_seasons:1,start_year:5,end_year:5,budget_per_season:bot_key==='antoine_morel_29'?570000:340000,
    installments:[7,14,21,28].map(day=>({day,status:'pending',amount:(bot_key==='antoine_morel_29'?570000:340000)/4}))}));
  const snapshot={checked_at:'2026-11-06T14:00:00Z',bounds:{accounts:8,contracts:contracts.length,inventory:8,assignments:8,pending_assignments:0,ledger:1000,receipts:93},
    teams:identity.map(t=>({...t,season_id:MANAGED_S5_SEASON,game_year:5,current_day_number:1,enabled:false,automation_season_id:null,automation_end_day_number:null,
      cash_balance:100000,opening_cash_balance:100250,posted_total:-250,pending_total:-10000,ledger_cash:100000,projected_budget:90000})),
    contracts,salary_installments,inventory,assignments,pending_assignments:[],draft_conflicts:[],receipts,restored_sponsors};
  const localReceipts=receipts.map(r=>({bot_key:r.bot_key,action_key:r.actions[0].key,status:'applied',result:{cost:r.actions[0].cashCost}}));
  return {identity,rosterPlan:{teams,native_actions:actions},baseline:{inventory:[]},snapshot,manifests:[{actions}],localReceipts};
}

test('reconciles 90 riders, all 93 native actions, contracts, installments and inventory',()=>{
  const report=verifyManagedFinanceAudit(fixture());assert.equal(report.status,'passed');assert.equal(report.counts.roster,90);assert.equal(report.counts.recruits,59);
  assert.equal(report.counts.renewals,18);assert.equal(report.counts.persistent_actions,93);assert.equal(report.teams.length,8);
});
test('rejects incomplete billing, premature renewals, wrong recruitment terms and protected draft riders',()=>{
  for(const mutate of [
    f=>f.snapshot.salary_installments.pop(),
    f=>f.snapshot.salary_installments.push({contract_id:f.snapshot.contracts.find(c=>c.status==='planned').id,game_year:6,day_number:7,status:'pending',amount:-2500}),
    f=>{f.snapshot.contracts.find(c=>c.acquisition_type==='free_agent').transfer_fee=1000;},
    f=>{f.snapshot.contracts.find(c=>c.acquisition_type==='free_agent').end_year=5;},
    f=>f.snapshot.draft_conflicts.push({rider_id:'draft-reserved'})
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyManagedFinanceAudit(f));}
});
test('rejects oversubscribed stock, changed equipment, excess RPC cost and missing receipts',()=>{
  for(const mutate of [
    f=>{f.snapshot.inventory[0].quantity=0;},
    f=>{f.snapshot.assignments[0].equipment_item_id='wrong';},
    f=>{f.snapshot.receipts[0].actions[0].cashCost=5;},
    f=>f.snapshot.receipts.pop()
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyManagedFinanceAudit(f));}
});
test('rejects ledger drift, hidden projected deficit, enabled automation and truncated audit',()=>{
  for(const mutate of [
    f=>{f.snapshot.teams[0].cash_balance+=1;},
    f=>{Object.assign(f.snapshot.teams[0],{projected_budget:0,pending_total:-101000});},
    f=>{f.snapshot.teams[0].enabled=true;},
    f=>{f.snapshot.bounds.ledger=8001;},
    f=>{f.snapshot.restored_sponsors[0].budget_per_season=575000;}
  ]){const f=fixture();mutate(f);assert.throws(()=>verifyManagedFinanceAudit(f));}
});
test('SQL is a single bounded read-only transaction with no gameplay RPC or DML',()=>{
  const sql=createManagedFinanceAuditSql(fixture().identity);
  assert.match(sql,/^begin read only;/);assert.match(sql,/statement_timeout='3s'/);assert.match(sql,/lock_timeout='300ms'/);
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|truncate|create temporary)\b/i);
  assert.doesNotMatch(sql,/public\.(?:sign_|renew_|settle_|book_|save_|purchase_)/);
  assert.match(sql,/limit 8001/);assert.match(sql,/limit 1201/);
});
