// Reviewed schema delivery only: no player mutation, fixture, gameplay call or
// production benchmark. Each diagnostic is bounded and executed sequentially.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';

const mode=process.argv[2];
assert(['--inspect','--apply'].includes(mode),'Use --inspect or --apply');
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261102090000',name='add_deferred_direct_transfers';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>`'${value.replaceAll("'","''")}'`;
const require=createRequire(import.meta.url);
const binary=join(dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin','supabase.exe');
function query(sql){
  const directory=mkdtempSync(join(tmpdir(),'deferred-transfers-reviewed-')),file=join(directory,'query.sql');
  try{
    writeFileSync(file,sql);
    const output=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{
      encoding:'utf8',timeout:30000,maxBuffer:250000,
    });
    assert(output.includes('{'),'Missing receipt; inspect before retrying.');
    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  }finally{rmSync(file,{force:true});rmdirSync(directory);}
}
function inspect(){return query(`begin read only;
  set local application_name='deferred-transfers-receipt-20261102';
  set local statement_timeout='3s';set local lock_timeout='500ms';
  select true database_ok,
    (select md5(statements[1]) from supabase_migrations.schema_migrations where version=${quote(version)}) recorded_hash,
    replace(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure),chr(13),'') response_definition,
    replace(pg_get_functiondef('public.enforce_team_roster_capacity()'::regprocedure),chr(13),'') capacity_definition,
    (select jsonb_object_agg(p.oid::regprocedure::text,jsonb_build_object('acl',p.proacl::text,'definer',p.prosecdef,'config',p.proconfig))
      from pg_proc p where p.oid in('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure,'public.enforce_team_roster_capacity()'::regprocedure)) changed_attributes,
    (select jsonb_object_agg(p.oid::regprocedure::text,md5(replace(pg_get_functiondef(p.oid),chr(13),''))) from pg_proc p where p.oid in(
      'private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)'::regprocedure,
      'private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)'::regprocedure,
      'public.submit_direct_transfer_offer_with_message(uuid,numeric,text)'::regprocedure,
      'public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)'::regprocedure,
      'public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure,
      'public.cancel_current_direct_transfer_offer(uuid)'::regprocedure,
      'public.cancel_pending_direct_transfer_offers(uuid,uuid,text)'::regprocedure,
      'public.settle_expiring_rider_contracts()'::regprocedure,
      'public.handle_rider_contract_transition()'::regprocedure,
      'public.sync_rider_salary_installments(uuid)'::regprocedure,
      'public.apply_data_room_salary_discount()'::regprocedure,
      'public.apply_data_room_transfer_rebate()'::regprocedure,
      'public.validate_direct_message_links()'::regprocedure)) protected_functions,
    (select count(*)::integer from pg_attribute where attrelid='public.direct_transfer_offers'::regclass and attnum>0 and not attisdropped
      and attname in('effective_season_id','effective_contract_id','offered_effective_contract_id','escrowed_at','released_at','released_team_season_id')) deferred_columns,
    (select count(*)::integer from pg_trigger where tgrelid in('public.rider_contracts'::regclass,'public.team_seasons'::regclass,'public.seasons'::regclass,'public.transfer_market_listings'::regclass) and not tgisinternal and tgenabled<>'D'
      and tgname in('guard_deferred_transfer_contract_before_change','cleanup_deferred_transfer_departure_after_status',
        'release_deferred_transfer_escrow_after_activation','release_deferred_escrow_on_team_account_after_activation',
        'zz_release_deferred_escrow_on_season_activation','guard_deferred_transfer_listing_before_write')) deferred_triggers,
    (select count(*)::integer from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid='public.direct_transfer_offers'::regclass and i.indisvalid
      and c.relname in('direct_transfer_offers_effective_contract_idx','direct_transfer_offers_offered_effective_contract_idx',
        'direct_transfer_offers_deferred_departure_idx','direct_transfer_offers_deferred_counterpart_departure_idx',
        'direct_transfer_offers_deferred_received_idx','direct_transfer_offers_unreleased_escrow_idx')) deferred_indexes,
    (select jsonb_object_agg(n.nspname||'.'||p.proname,jsonb_build_object('definer',p.prosecdef,'config',p.proconfig,
      'authenticated',has_function_privilege('authenticated',p.oid,'execute'),'anonymous',has_function_privilege('anon',p.oid,'execute'),
      'service',has_function_privilege('service_role',p.oid,'execute')))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
      (n.nspname='public' and p.proname='submit_deferred_direct_transfer_offer') or
      (n.nspname='private' and p.proname in('assert_deferred_rider_eligible','assert_deferred_roster_capacity',
        'respond_to_deferred_direct_transfer_offer','guard_deferred_transfer_contract','cleanup_deferred_transfer_departure',
        'release_deferred_transfer_escrow_for_offer','release_deferred_transfer_escrow','release_deferred_escrow_on_team_account',
        'release_deferred_escrow_on_season_activation','guard_deferred_transfer_listing'))) new_function_permissions;
  commit;`)[0];}
const summarize=row=>({database_ok:row.database_ok,recorded:Boolean(row.recorded_hash),
  response_hash:hash(row.response_definition),capacity_hash:hash(row.capacity_definition),
  deferred_columns:row.deferred_columns,deferred_triggers:row.deferred_triggers,deferred_indexes:row.deferred_indexes,
  new_function_permissions:row.new_function_permissions,protected_functions:row.protected_functions});
function verifyInstalled(row){
  assert(row.database_ok);
  assert.equal(row.recorded_hash,hash(source),'Recorded migration differs.');
  assert.equal(row.deferred_columns,6);assert.equal(row.deferred_triggers,6);assert.equal(row.deferred_indexes,6);
  assert.equal(Object.keys(row.new_function_permissions??{}).length,11);
  for(const [name,value] of Object.entries(row.new_function_permissions)){
    assert(value.definer && value.config?.includes('search_path=""'),`Unsafe function configuration: ${name}`);
    assert.equal(value.anonymous,false);assert.equal(value.service,false);
    assert.equal(value.authenticated,name==='public.submit_deferred_direct_transfer_offer');
  }
}
const before=inspect();
if(before.recorded_hash)verifyInstalled(before);
if(mode==='--inspect'){console.log(JSON.stringify(summarize(before)));process.exit(0);}
if(before.recorded_hash){console.log(JSON.stringify({...summarize(before),already_applied:true}));process.exit(0);}
assert(before.database_ok && before.deferred_columns===0 && before.deferred_triggers===0 && before.deferred_indexes===0);
assert.equal(hash(before.response_definition),'e59e973844a59dd7cc902e8a8df0baa8');
assert.equal(hash(before.capacity_definition),'ce9b957ae9406ecde64b62c8e78e8ad3');
assert.equal(Object.keys(before.protected_functions).length,13);
const replacements=marker=>{
  const block=source.split(`$${marker}$`)[1];
  assert(block);return {old:block.split('$old$')[1],replacement:block.split('$new$')[1]};
};
const response=replacements('dispatch'),capacity=replacements('capacity');
assert.equal(before.response_definition.split(response.old).length,2);
assert.equal(before.capacity_definition.split(capacity.old).length,2);
query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
  values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
const after=inspect();
verifyInstalled(after);
assert.equal(after.response_definition,before.response_definition.replace(response.old,response.replacement));
assert.equal(after.capacity_definition,before.capacity_definition.replace(capacity.old,capacity.replacement));
assert.deepEqual(after.changed_attributes,before.changed_attributes,'Existing response/capacity ACL or configuration changed.');
assert.deepEqual(after.protected_functions,before.protected_functions,'Legacy transfer, finance or rollover core changed.');
console.log(JSON.stringify({...summarize(after),productionFixtures:false,historicalOffersRewritten:false,existingImmediateCoresPreserved:true}));
