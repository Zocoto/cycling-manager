// Apply only the reviewed function optimizations. No fixtures or gameplay RPCs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if(process.argv.length!==3||process.argv[2]!=='--apply-reviewed-fixes'
 ||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact reviewed flag and project required');
const hash=value=>createHash('sha256').update(value.replaceAll('\r','')).digest('hex');
const helper='public.was_rider_contracted_by_team_in_season(uuid,uuid,integer)';
const fixes=[
 {version:'20261016173000',file:'inline_objective_title_contract_filter',signature:'public.calculate_game_objective_progress_pre_recruitment_rewards(text,uuid,uuid,numeric)',
  originalHash:'af8cccb460104c607d7a95d36fda33b563fecbe95b994f91b460af415f08636b',marker:'objective_title_contract_filter_v1'},
 {version:'20261016171000',file:'materialize_team_roster_projection',signature:'private.get_team_roster_projection(uuid,integer)',
  originalHash:'1e5cd87858fef41af36fe7cfbabff9ed3e26141534d572ef6e93cf3f1fc6b122',marker:'with projection as materialized ('},
 {version:'20261016172000',file:'scope_roster_auction_leader_ranking',signature:'public.get_team_roster_commitment_count(uuid,integer)',
  originalHash:'46984fb2e71132035e6a150e4d3520b623d78a4ac739bd12abb82d307d0e5336',marker:'team_bid.team_id = p_team_id'},
];
const call=(args,timeout=15000)=>execFileSync(binary,args,{encoding:'utf8',timeout,maxBuffer:150000});
const query=sql=>{
 const raw=call(['db','query','--linked',`begin read only;set local application_name='query-performance-verification-20261016';set local statement_timeout='3s';set local lock_timeout='500ms';${sql};rollback;`,'--output','json']);
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const inspect=()=>query(`select requested.signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,
 pg_get_userbyid(p.proowner) owner,p.proacl::text privileges,p.proconfig settings,p.provolatile stability,p.prosecdef security_definer,p.prorettype::text return_type
 from unnest(array[${[helper,...fixes.map(f=>f.signature)].map(s=>`'${s}'`).join(',')}]) requested(signature)
 join pg_proc p on p.oid=to_regprocedure(requested.signature)`);
const metadata=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='definition'));
const initial=inspect();
assert.equal(initial.length,fixes.length+1,'Every audited function must exist');
assert.equal(hash(initial.find(r=>r.signature===helper).definition),'850c397d2753fc4879d7332f6b1621aca41d9f66cda328037c9a3b0ef8f7526e','Contract ownership helper changed since review');
for(const fix of fixes){
 const before=initial.find(row=>row.signature===fix.signature);
 const recorded=query(`select exists(select 1 from supabase_migrations.schema_migrations where version='${fix.version}') recorded`)[0].recorded;
 if(!before.definition.includes(fix.marker)){
  assert.equal(recorded,false,'History indicates a different deployed function');
  assert.equal(hash(before.definition),fix.originalHash,`Function changed since review: ${fix.signature}`);
  // Each file has its own bounded transaction; no other pending migration runs.
  call(['db','query','--linked','--file',`supabase/migrations/${fix.version}_${fix.file}.sql`,'--output','json'],20000);
 }
 const after=inspect().find(row=>row.signature===fix.signature);
 assert.ok(after.definition.includes(fix.marker),'Expected optimization missing');
 assert.deepEqual(metadata(after),metadata(before),'Function permissions or contract changed');
 if(!recorded)call(['migration','repair',fix.version,'--status','applied','--linked','--yes']);
 console.log(JSON.stringify({version:fix.version,installed:true,permissionsUnchanged:true}));
}
const health=query(`select 1 database_ok,
 (select count(*)::integer from pg_stat_activity where pid<>pg_backend_pid() and application_name='query-performance-delivery-20261016' and state<>'idle') task_transactions_remaining,
 (select count(*)::integer from pg_stat_activity where cardinality(pg_blocking_pids(pid))>0) blocked_sessions`)[0];
assert.equal(health.database_ok,1);assert.equal(health.task_transactions_remaining,0);
assert.equal(hash(inspect().find(r=>r.signature===helper).definition),'850c397d2753fc4879d7332f6b1621aca41d9f66cda328037c9a3b0ef8f7526e');
console.log(JSON.stringify(health));
