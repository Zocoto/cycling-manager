import assert from 'node:assert/strict';
import {MANAGED_S5_ACTION_KEYS,MANAGED_S5_SEASON,sqlText,sqlUuid} from './managed-s5-action-sql-20261106.mjs';

export const FINANCE_AUDIT_LIMITS=Object.freeze({contracts:201,inventory:401,assignments:801,pending_assignments:401,ledger:8001,receipts:1201});
const number=value=>Number(value??0);
const sum=values=>values.reduce((total,value)=>total+number(value),0);
const close=(actual,expected,label)=>assert.ok(Math.abs(number(actual)-number(expected))<0.011,`${label}: ${actual} != ${expected}`);
const key=(...parts)=>parts.join(':');
export function unwrapManagedSnapshot(value){return Array.isArray(value)&&value.length===1&&value[0].snapshot?value[0].snapshot:value;}

export function createManagedFinanceAuditSql(identity){
  assert.equal(identity.length,8);assert.deepEqual(identity.map(t=>t.bot_key).sort(),[...MANAGED_S5_ACTION_KEYS].sort());
  const targets=identity.map(t=>`(${sqlText(t.bot_key)},${sqlUuid(t.team_id)},${sqlUuid(t.team_season_id)})`).join(',\n');
  return `begin read only;
set local statement_timeout='3s';set local lock_timeout='300ms';
set local application_name='managed-s5-final-finance-20261106';
with wanted(bot_key,team_id,team_season_id) as(values ${targets}),
target as materialized(
 select w.*,b.id manager_id,b.enabled,b.automation_season_id,b.automation_end_day_number,
   s.id season_id,s.game_year,s.current_day_number,ts.cash_balance,ts.opening_cash_balance
 from wanted w join public.alpha_bot_managers b on b.bot_key=w.bot_key and b.team_id=w.team_id
 join public.team_seasons ts on ts.id=w.team_season_id and ts.team_id=w.team_id
 join public.seasons s on s.id=ts.season_id and s.id=${sqlUuid(MANAGED_S5_SEASON)} and s.status='active'
 order by w.bot_key limit 9
), accounts as materialized(
 select t.bot_key,ts.id team_season_id,s.game_year from target t
 join public.team_seasons ts on ts.team_id=t.team_id join public.seasons s on s.id=ts.season_id
 where s.game_year in(5,6) order by t.bot_key,s.game_year limit 17
), ledger as materialized(
 select a.bot_key,a.game_year,f.team_season_id,f.id,f.day_number,f.amount,f.category,f.status,f.source_reference,f.created_at
 from accounts a join public.team_finance_transactions f on f.team_season_id=a.team_season_id
 order by a.bot_key,a.game_year,f.id limit ${FINANCE_AUDIT_LIMITS.ledger}
), contracts as materialized(
 select t.bot_key,c.id,c.team_id,c.rider_id,c.status,c.acquisition_type,c.salary_per_season,c.transfer_fee,c.signed_at,
   sy.game_year start_year,ey.game_year end_year,c.start_season_id,c.end_season_id
 from target t join public.rider_contracts c on c.team_id=t.team_id and c.status in('active','planned')
 join public.seasons sy on sy.id=c.start_season_id join public.seasons ey on ey.id=c.end_season_id
 order by t.bot_key,c.rider_id,sy.game_year,c.id limit ${FINANCE_AUDIT_LIMITS.contracts}
), owned as materialized(select distinct bot_key,team_id,rider_id from contracts where status='active'),
inventory as materialized(
 select t.bot_key,i.equipment_item_id,i.quantity,i.last_purchase_price
 from target t join public.team_equipment_inventory i on i.team_season_id=t.team_season_id
 order by t.bot_key,i.equipment_item_id limit ${FINANCE_AUDIT_LIMITS.inventory}
), assignments as materialized(
 select o.bot_key,a.rider_id,a.slot_type,a.equipment_item_id
 from owned o join public.rider_equipment_assignments a on a.rider_id=o.rider_id
 order by o.bot_key,a.rider_id,a.slot_type limit ${FINANCE_AUDIT_LIMITS.assignments}
), pending_assignments as materialized(
 select t.bot_key,a.rider_id,a.slot_type,a.equipment_item_id,a.effective_at
 from target t join public.rider_equipment_pending_assignments a on a.team_season_id=t.team_season_id
 order by t.bot_key,a.rider_id,a.slot_type limit ${FINANCE_AUDIT_LIMITS.pending_assignments}
), receipts as materialized(
 select t.bot_key,c.cycle_key,c.status,c.actions,c.started_at,c.completed_at
 from target t join public.alpha_bot_cycles c on c.manager_id=t.manager_id
 where c.cycle_key like 'owner-s5-20261106:%'
 order by t.bot_key,c.cycle_key limit ${FINANCE_AUDIT_LIMITS.receipts}
), finance as materialized(
 select t.bot_key,t.team_id,t.team_season_id,t.season_id,t.game_year,t.current_day_number,
 t.enabled,t.automation_season_id,t.automation_end_day_number,t.cash_balance,t.opening_cash_balance,
 coalesce(sum(l.amount) filter(where l.status='posted'),0) posted_total,
 coalesce(sum(l.amount) filter(where l.status='pending'),0) pending_total,
 t.opening_cash_balance+coalesce(sum(l.amount) filter(where l.status='posted'),0) ledger_cash,
 t.cash_balance+coalesce(sum(l.amount) filter(where l.status='pending'),0) projected_budget
 from target t left join ledger l on l.team_season_id=t.team_season_id
 group by t.bot_key,t.team_id,t.team_season_id,t.season_id,t.game_year,t.current_day_number,
 t.enabled,t.automation_season_id,t.automation_end_day_number,t.cash_balance,t.opening_cash_balance
), finance_categories as materialized(
 select bot_key,game_year,category,status,count(*)::integer count,sum(amount) amount
 from ledger group by bot_key,game_year,category,status order by bot_key,game_year,category,status
), salary_installments as materialized(
 select c.bot_key,c.id contract_id,l.game_year,l.day_number,l.amount,l.status,l.source_reference
 from contracts c join ledger l on l.bot_key=c.bot_key and l.category='rider_salary'
 and l.source_reference like 'rider-salary:'||c.id::text||':%'
 order by c.bot_key,c.id,l.game_year,l.day_number
), draft_conflicts as materialized(
 select c.bot_key,c.rider_id,p.edition_id,e.status
 from contracts c join public.season_draft_riders p on p.rider_id=c.rider_id
 join public.season_draft_editions e on e.id=p.edition_id
 where c.status='active' and(e.status in('preparing','running') or(e.status='scheduled' and e.pool_reserved_at is not null))
 order by c.bot_key,c.rider_id limit 201
), restored_sponsors as materialized(
 select t.bot_key,c.id,c.sponsor_offer_id,c.status,c.budget_per_season,c.contract_duration_seasons,
 sy.game_year start_year,ey.game_year end_year,o.status offer_status,o.generation_version,
 (select count(*) from public.sponsor_objectives so where so.sponsor_offer_id=o.id and so.status='active' and not so.is_provisional) active_objectives,
 (select coalesce(jsonb_agg(jsonb_build_object('day',l.day_number,'amount',l.amount,'status',l.status) order by l.day_number),'[]')
 from ledger l where l.bot_key=t.bot_key and l.game_year=5 and l.source_reference like 'sponsor:'||c.id::text||':%') installments
 from target t join public.team_sponsor_contracts c on c.team_id=t.team_id
 join public.sponsor_offers o on o.id=c.sponsor_offer_id
 join public.seasons sy on sy.id=c.start_season_id join public.seasons ey on ey.id=c.end_season_id
 where c.id in('476e16f2-d644-41b0-9715-c4ac64ed9872'::uuid,'10e6063e-7928-43b8-a361-b9c2d0239413'::uuid)
 order by t.bot_key limit 3
)
select jsonb_build_object('checked_at',clock_timestamp(),
 'bounds',jsonb_build_object('accounts',(select count(*) from accounts),'contracts',(select count(*) from contracts),
 'inventory',(select count(*) from inventory),'assignments',(select count(*) from assignments),
 'pending_assignments',(select count(*) from pending_assignments),'ledger',(select count(*) from ledger),'receipts',(select count(*) from receipts)),
 'teams',(select coalesce(jsonb_agg(to_jsonb(f) order by f.bot_key),'[]') from finance f),
 'finance_categories',(select coalesce(jsonb_agg(to_jsonb(f) order by f.bot_key,f.game_year,f.category,f.status),'[]') from finance_categories f),
 'contracts',(select coalesce(jsonb_agg(to_jsonb(c) order by c.bot_key,c.rider_id,c.start_year,c.id),'[]') from contracts c),
 'salary_installments',(select coalesce(jsonb_agg(to_jsonb(l) order by l.bot_key,l.contract_id,l.game_year,l.day_number),'[]') from salary_installments l),
 'inventory',(select coalesce(jsonb_agg(to_jsonb(i) order by i.bot_key,i.equipment_item_id),'[]') from inventory i),
 'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.bot_key,a.rider_id,a.slot_type),'[]') from assignments a),
 'pending_assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.bot_key,a.rider_id,a.slot_type),'[]') from pending_assignments a),
 'draft_conflicts',(select coalesce(jsonb_agg(to_jsonb(d) order by d.bot_key,d.rider_id),'[]') from draft_conflicts d),
 'restored_sponsors',(select coalesce(jsonb_agg(to_jsonb(c) order by c.bot_key),'[]') from restored_sponsors c),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.bot_key,r.cycle_key),'[]') from receipts r)) snapshot;
commit;
`;
}

export function verifyManagedFinanceAudit({snapshot:rawSnapshot,identity,rosterPlan,baseline:rawBaseline,manifests,localReceipts=[]}){
  const snapshot=unwrapManagedSnapshot(rawSnapshot),baseline=unwrapManagedSnapshot(rawBaseline);
  assert.equal(identity.length,8);assert.equal(snapshot.teams.length,8);
  assert.deepEqual(snapshot.teams.map(t=>t.bot_key).sort(),[...MANAGED_S5_ACTION_KEYS].sort());
  for(const [field,limit] of Object.entries(FINANCE_AUDIT_LIMITS))assert.ok(number(snapshot.bounds[field])<limit,`${field} audit truncated`);
  assert.ok(number(snapshot.bounds.accounts)<=16,'accounts audit truncated');
  const rosterActions=rosterPlan.native_actions;
  const counts=Object.fromEntries(['sign_current_team_free_agent','renew_current_team_rider_until','purchase_current_team_equipment_cart','save_current_team_equipment_assignments'].map(rpc=>[rpc,rosterActions.filter(a=>a.rpc===rpc).length]));
  assert.deepEqual(Object.values(counts),[59,18,8,8],'Frozen roster scope changed');
  const expectedActions=new Map();
  for(const manifest of manifests)for(const action of manifest.actions??manifest.native_actions??[]){
    assert.ok(MANAGED_S5_ACTION_KEYS.includes(action.bot_key),'Unmanaged action in manifest');
    const id=key(action.bot_key,action.key),previous=expectedActions.get(id);
    if(previous)assert.deepEqual(previous,action,'Conflicting manifest action');else expectedActions.set(id,action);
  }
  for(const action of rosterActions)assert.ok(expectedActions.has(key(action.bot_key,action.key)),'Roster action manifest missing');
  const receiptMap=new Map();
  for(const receipt of snapshot.receipts){
    const id=key(receipt.bot_key,receipt.cycle_key.replace(/^owner-s5-20261106:/,''));
    assert.ok(!receiptMap.has(id),'Duplicate persistent receipt');receiptMap.set(id,receipt);
  }
  for(const [id,action] of expectedActions){
    const receipt=receiptMap.get(id);assert.ok(receipt,`Missing persistent receipt ${id}`);
    assert.equal(receipt.status,'completed',`Incomplete receipt ${id}`);assert.equal(receipt.actions.length,1);
    const actual=receipt.actions[0];assert.equal(actual.key,action.key);assert.equal(actual.rpc,action.rpc);
    assert.deepEqual(actual.args,action.args,`Receipt args changed ${id}`);
    assert.ok(number(actual.cashCost)<=number(action.max_cash_cost)+0.011,`Receipt exceeds cost ${id}`);
  }
  for(const [id] of receiptMap)assert.ok(expectedActions.has(id),`Unreviewed persistent action ${id}`);
  let localCompared=0;
  for(const local of localReceipts){
    const id=key(local.bot_key,local.action_key),receipt=receiptMap.get(id);
    assert.ok(receipt,`Local receipt missing in database ${id}`);
    if(local.status==='applied'){
      assert.ok(local.result,'Missing applied local result');close(receipt.actions[0].cashCost,local.result.cost,`Local receipt cost ${id}`);localCompared++;
    }else assert.equal(local.status,'already_done','Failed local execution');
  }
  assert.equal(snapshot.draft_conflicts.length,0,'An owned rider is still protected by an open draft');
  assert.equal(snapshot.restored_sponsors.length,2,'Both authorized S5 sponsors retained');
  for(const sponsor of snapshot.restored_sponsors){
    const budget=sponsor.bot_key==='antoine_morel_29'?570000:340000;
    assert.ok(['antoine_morel_29','giulia_rinaldi'].includes(sponsor.bot_key));
    assert.equal(sponsor.status,'active');assert.equal(sponsor.offer_status,'accepted');assert.equal(sponsor.generation_version,12);
    assert.equal(sponsor.active_objectives,10);assert.equal(sponsor.contract_duration_seasons,1);
    assert.equal(sponsor.start_year,5);assert.equal(sponsor.end_year,5);close(sponsor.budget_per_season,budget,'Authorized sponsor budget');
    assert.equal(sponsor.installments.length,4);assert.deepEqual(sponsor.installments.map(i=>i.day),[7,14,21,28]);
    assert.ok(sponsor.installments.every(i=>i.status==='pending'),'Normal sponsor installment status');
    close(sum(sponsor.installments.map(i=>i.amount)),budget,'Authorized sponsor installments');
  }
  const reports=[];
  for(const teamPlan of rosterPlan.teams){
    const current=snapshot.teams.find(t=>t.bot_key===teamPlan.bot_key),original=identity.find(t=>t.bot_key===teamPlan.bot_key);
    assert.equal(current.team_id,original.team_id);assert.equal(current.team_season_id,original.team_season_id);
    assert.equal(current.season_id,MANAGED_S5_SEASON);assert.equal(current.game_year,5);assert.equal(current.current_day_number,1);
    assert.equal(current.enabled,false);assert.equal(current.automation_season_id,null);assert.equal(current.automation_end_day_number,null);
    close(current.cash_balance,current.ledger_cash,`${teamPlan.bot_key} ledger reconciliation`);
    close(current.ledger_cash,number(current.opening_cash_balance)+number(current.posted_total),'Opening + posted');
    close(current.projected_budget,number(current.cash_balance)+number(current.pending_total),'Unclamped projection');
    assert.ok(number(current.cash_balance)>=15000,`${teamPlan.bot_key} liquidity reserve`);
    assert.ok(number(current.projected_budget)>=25000,`${teamPlan.bot_key} projected reserve`);
    const contracts=snapshot.contracts.filter(c=>c.team_id===teamPlan.team_id);
    const active=contracts.filter(c=>c.status==='active');assert.equal(active.length,teamPlan.planned_roster,'Actual roster count');
    assert.equal(new Set(active.map(c=>c.rider_id)).size,active.length,'Duplicate active rider contracts');
    for(const recruit of teamPlan.recruits){
      const rows=active.filter(c=>c.rider_id===recruit.rider_id);assert.equal(rows.length,1,'FA active contract missing');
      const c=rows[0],action=rosterActions.find(a=>a.rpc==='sign_current_team_free_agent'&&a.args.p_rider_id===c.rider_id);
      assert.equal(c.acquisition_type,'free_agent');assert.equal(c.start_year,5);assert.equal(c.end_year,6);
      close(c.transfer_fee,0,'Free-agent transfer fee');assert.ok(number(c.salary_per_season)<=action.max_salary+0.011,'Recruit salary ceiling');
      const lines=snapshot.salary_installments.filter(f=>f.contract_id===c.id&&f.game_year===5&&f.status!=='cancelled');
      assert.equal(lines.length,4,'Four S5 recruit salary installments');
      assert.deepEqual(lines.map(f=>f.day_number).sort((a,b)=>a-b),[7,14,21,28]);
      close(sum(lines.map(f=>f.amount)),-number(c.salary_per_season),'Annual recruit salary');
      const quarter=Math.round(number(c.salary_per_season)*100/4)/100;
      for(const line of lines){assert.equal(line.status,'pending','Future S5 salary already posted');
        close(line.amount,line.day_number===28?-(number(c.salary_per_season)-quarter*3):-quarter,'Salary installment rounding');}
    }
    for(const renewal of teamPlan.renewals){
      const prior=contracts.find(c=>c.id===renewal.active_contract_id);assert.ok(prior,'Existing contract retained');
      assert.equal(prior.status,'active');assert.equal(prior.end_year,renewal.previous_end_year);close(prior.salary_per_season,renewal.current_salary,'Existing salary untouched');
      const planned=contracts.filter(c=>c.rider_id===renewal.rider_id&&c.status==='planned');assert.equal(planned.length,1,'Single S6 renewal');
      const c=planned[0],action=rosterActions.find(a=>a.rpc==='renew_current_team_rider_until'&&a.args.p_rider_id===c.rider_id);
      assert.equal(c.acquisition_type,'renewal');assert.equal(c.start_year,6);assert.equal(c.end_year,6);
      assert.ok(number(c.salary_per_season)<=action.max_salary+0.011,'Renewal salary ceiling');
      assert.equal(snapshot.salary_installments.filter(f=>f.contract_id===c.id&&f.status!=='cancelled').length,0,'Planned S6 renewal billed prematurely');
    }
    const owned=snapshot.inventory.filter(i=>i.bot_key===teamPlan.bot_key),oldOwned=baseline.inventory.filter(i=>i.bot_key===teamPlan.bot_key);
    const purchases=teamPlan.equipment.purchases;
    const itemIds=new Set([...owned,...oldOwned].map(i=>i.equipment_item_id));
    for(const purchase of purchases)itemIds.add(purchase.equipmentItemId);
    for(const itemId of itemIds){
      const actual=number(owned.find(i=>i.equipment_item_id===itemId)?.quantity),before=number(oldOwned.find(i=>i.equipment_item_id===itemId)?.quantity);
      const bought=sum(purchases.filter(i=>i.equipmentItemId===itemId).map(i=>i.quantity));
      close(actual,before+bought,'Inventory matches reviewed cart');
      const assigned=snapshot.assignments.filter(a=>a.bot_key===teamPlan.bot_key&&a.equipment_item_id===itemId).length;
      assert.ok(actual>=assigned,`Inventory oversubscribed ${teamPlan.bot_key}/${itemId}`);
    }
    const assignments=snapshot.assignments.filter(a=>a.bot_key===teamPlan.bot_key);
    assert.equal(new Set(assignments.map(a=>key(a.rider_id,a.slot_type))).size,assignments.length,'Duplicate equipment slots');
    for(const wanted of teamPlan.equipment.assignments){
      const actual=assignments.find(a=>a.rider_id===wanted.riderId&&a.slot_type===wanted.slot);
      assert.equal(actual?.equipment_item_id,wanted.equipmentItemId,'Equipment assignment differs from reviewed manifest');
      assert.ok(!snapshot.pending_assignments.some(a=>a.rider_id===wanted.riderId&&a.slot_type===wanted.slot),'Reviewed equipment still deferred');
    }
    const originalRiders=new Set(baseline.contracts?.filter(c=>c.team_id===teamPlan.team_id&&c.status==='active').map(c=>c.rider_id)??[]);
    for(const old of baseline.assignments??[]){
      if(!originalRiders.has(old.rider_id)||teamPlan.equipment.assignments.some(a=>a.riderId===old.rider_id&&a.slot===old.slot_type))continue;
      assert.equal(assignments.find(a=>a.rider_id===old.rider_id&&a.slot_type===old.slot_type)?.equipment_item_id,old.equipment_item_id,'Unchanged original equipment preserved');
    }
    const purchaseReceipt=receiptMap.get(key(teamPlan.bot_key,`gear-purchase:${teamPlan.team_id}:S5`));
    close(purchaseReceipt.actions[0].cashCost,teamPlan.equipment.total_cost,'Exact reviewed equipment cart spend');
    reports.push({bot_key:teamPlan.bot_key,team_id:teamPlan.team_id,riders:active.length,recruits:teamPlan.recruits.length,renewals:teamPlan.renewals.length,
      annual_active_salary:sum(active.map(c=>c.salary_per_season)),planned_s6_salary:sum(contracts.filter(c=>c.status==='planned').map(c=>c.salary_per_season)),
      equipment_cost:teamPlan.equipment.total_cost,cash:number(current.cash_balance),pending:number(current.pending_total),projected:number(current.projected_budget),
      ledger_difference:number(current.cash_balance)-number(current.ledger_cash),automation_enabled:false});
  }
  return {verified_at:new Date().toISOString(),source_checked_at:snapshot.checked_at,status:'passed',scope:'one-shot S5 J1 eight managed teams',
    counts:{recruits:59,renewals:18,equipment_carts:8,equipment_assignment_batches:8,roster:sum(reports.map(t=>t.riders)),persistent_actions:expectedActions.size,local_receipts_compared:localCompared},
    checks:['active FA S5–S6 and four S5 installments','best-only planned S6 renewals retain S5 contracts','reviewed gear carts and assignments, sufficient stock',
      'cash = opening + posted; projection = cash + pending','minimum 15k cash and 25k projected reserves','no protected draft rider','all action receipts match native RPC manifests','all automatic managers remain disabled'],
    note:'Planned S6 renewals acquire their salary installments through normal activation; no S6 advance billing is introduced.',teams:reports};
}
