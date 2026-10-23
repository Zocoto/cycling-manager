// Policy repair only. Never accepts, declines, withdraws or recreates an offer.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const mode=process.argv[2];
if(process.argv.length!==3||!['--inspect','--apply-reviewed-fix'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261023093000',name='fix_direct_offer_participant_read_policy';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
if(!source.startsWith('begin;')||!source.includes("set local lock_timeout = '1s'")||!source.includes("set local statement_timeout = '5s'")||!/commit;\s*$/.test(source))throw Error('Migration bounds changed');
const hash=createHash('md5').update(source).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const run=sql=>{
 mkdirSync('artifacts/direct-offer-read-policy-20261023',{recursive:true});
 const file=path.resolve('artifacts/direct-offer-read-policy-20261023/reviewed-command.sql');writeFileSync(file,sql);
 let raw;
 try{raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:18000,maxBuffer:40000});}
 catch(error){throw Error(`Bounded SQL failed: ${error.status??error.code}; ${String(error.stderr??'').slice(0,1000)}`);}
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const read=sql=>run(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';set local application_name='direct-offer-read-policy-audit-20261023';${sql};commit;`);
const inspect=()=>read(`select 1 database_ok,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 pg_get_expr(policy.polqual,policy.polrelid) policy_expression,md5(pg_get_expr(policy.polqual,policy.polrelid)) policy_hash,
 policy.polcmd::text='r' and policy.polroles=array['authenticated'::regrole::oid] authenticated_select_only,
 has_table_privilege('authenticated','public.direct_transfer_offers','select') offer_read,
 not has_table_privilege('authenticated','public.team_manager_assignments','select') assignments_private,
 (select relrowsecurity from pg_class where oid='public.direct_transfer_offers'::regclass) rls_enabled,
 (select jsonb_object_agg(signature,fingerprint) from (select oid::regprocedure::text signature,md5(replace(pg_get_functiondef(oid),chr(13),'')) fingerprint from pg_proc where oid in(
  to_regprocedure('public.current_user_manages_team(uuid)'),to_regprocedure('public.respond_to_direct_transfer_offer(uuid,boolean)'),
  to_regprocedure('public.cancel_current_direct_transfer_offer(uuid)'),to_regprocedure('public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'))) unchanged) unchanged_functions
 from pg_policy policy where polrelid='public.direct_transfer_offers'::regclass and polname='direct_transfer_offers_select_managed_teams'`)[0];
const before=inspect();
if(mode==='--inspect'){console.log(JSON.stringify(before));process.exit(0);}
if(before?.database_ok!==1||!before.authenticated_select_only||!before.assignments_private||!before.offer_read||!before.rls_enabled||Object.keys(before.unchanged_functions??{}).length!==4)throw Error('Preflight or permissions failed');
if(before.recorded&&before.recorded_hash!==hash)throw Error('Recorded source differs; never replay');
if(!before.recorded){
 if(before.policy_hash!=='987f2a6be56aec95ae719181c23b189f')throw Error('Policy changed since review');
 run(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after=inspect();
if(!after.recorded||after.recorded_hash!==hash||!after.authenticated_select_only||!after.assignments_private||!after.offer_read||!after.rls_enabled
 ||after.policy_expression!=='(current_user_manages_team(buyer_team_id) OR current_user_manages_team(seller_team_id))'
 ||JSON.stringify(after.unchanged_functions)!==JSON.stringify(before.unchanged_functions))throw Error('Policy receipt not verified');
const receipt={migration:version,...after,acceptedOnPlayerBehalf:false,gameplayWrites:0};
writeFileSync('artifacts/direct-offer-read-policy-20261023/installation-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
