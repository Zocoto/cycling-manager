// Reviewed publication infrastructure only; never invokes a rollover, worker,
// player mutation, test fixture or source capture in production.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const mode=process.argv[2],version='20261105160000',name='automatic_cyclo_stickers_s4_publication';
const file=`supabase/migrations/${version}_${name}.sql`,folder='artifacts/cyclo-stickers-automatic-20261105';
assert.ok(process.argv.length===3&&['--inspect','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const sql=readFileSync(file,'utf8');
assert.equal(createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex'),'4dd2447fe27911c3bb2d5078a0df4e257b2bb79db02b3e0a8686143610150306');
mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function call(args){try{return execFileSync(binary,args,{encoding:'utf8',timeout:25000,maxBuffer:350000});}catch(error){throw Error(error.stderr?.slice(0,1500)??error.message);}}
function query(command){const raw=call(['db','query','--linked',command,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
const read=command=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='cyclo_stickers_automatic_delivery';${command};commit;`);
function protectedFunctions(){return read(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proconfig,p.prosecdef
  from pg_proc p where p.oid=any(array['public.settle_due_season_rollovers()'::regprocedure,
  'public.get_current_game_header_indicators_v3()'::regprocedure,'public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure,
  'private.record_weekly_login_booster_connection(uuid,uuid,date)'::regprocedure]) order by signature`);}
const receipt=()=>read(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name;
const installation=()=>read(`select to_regclass('public.cyclo_stickers_publication_jobs') is not null jobs,
  (select game_year from public.seasons where status='active' limit 1) game_year,
  position('empty-profile-after-all-riders' in pg_get_functiondef('public.claim_current_cyclo_stickers_achievement(text,text)'::regprocedure))>0 empty_profile_rule`)[0];
const before=protectedFunctions();assert.equal(before.length,4);
if(mode==='--inspect'){
  const state=installation(); assert.equal(state.game_year,4);
  writeFileSync(`${folder}/functions-before.json`,JSON.stringify(before,null,2));
  console.log(JSON.stringify({databaseOk:true,installation:state,receipt:receipt()??null}));
}else{
  if(mode==='--apply-reviewed'&&!receipt()){
    assert.deepEqual(installation(),{empty_profile_rule:false,game_year:4,jobs:false});
    call(['db','query','--linked','--file',file,'--output','json']);
    const recordFile=`${folder}/receipt.sql`;
    writeFileSync(recordFile,`begin;set local statement_timeout='3s';set local lock_timeout='500ms';insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`);
    call(['db','query','--linked','--file',recordFile,'--output','json']);
  }
  assert.equal(receipt(),name);
  const after=protectedFunctions();
  for(const prior of before){const current=after.find(row=>row.signature===prior.signature);assert.ok(current);assert.equal(current.acl,prior.acl);assert.deepEqual(current.proconfig,prior.proconfig);assert.equal(current.prosecdef,prior.prosecdef);
    assert.equal(current.hash,prior.hash);
  }
  const state=installation(); assert.ok(state.jobs&&!state.empty_profile_rule);
  const catalogueRules=read(`select position('72' in pg_get_functiondef('public.install_cyclo_stickers_edition(text,jsonb,text,jsonb)'::regprocedure))>0 supports_72,
    (select (entry->>'target')::integer from jsonb_array_elements(private.cyclo_stickers_default_configuration()->'achievements') entry where entry->>'id'='count-50') final_target,
    (select count(*)::integer from jsonb_array_elements(private.cyclo_stickers_default_configuration()->'achievements')) achievements`)[0];
  assert.deepEqual(catalogueRules,{achievements:19,final_target:72,supports_72:true});
  const rights=read(`select (select relrowsecurity from pg_class where oid='public.cyclo_stickers_publication_jobs'::regclass) rls,
    has_table_privilege('authenticated','public.cyclo_stickers_publication_jobs','select') player_read,
    has_table_privilege('authenticated','public.cyclo_stickers_publication_jobs','insert') player_write,
    has_function_privilege('authenticated','public.claim_cyclo_stickers_publication(uuid,integer)','execute') player_claim,
    has_function_privilege('authenticated','public.publish_cyclo_stickers_publication(uuid,uuid,jsonb,text)','execute') player_publish,
    has_function_privilege('service_role','public.publish_cyclo_stickers_publication(uuid,uuid,jsonb,text)','execute') service_publish,
    has_function_privilege('authenticated','public.get_current_game_header_indicators_v4()','execute') owner_header,
    has_function_privilege('anon','public.get_current_game_header_indicators_v4()','execute') anonymous_header,
    (select count(*)::int from public.cyclo_stickers_publication_jobs) jobs,
    (select count(*)::int from public.cyclo_stickers_editions) editions`)[0];
  assert.deepEqual(rights,{anonymous_header:false,editions:0,jobs:0,owner_header:true,player_claim:false,player_publish:false,player_read:false,player_write:false,rls:true,service_publish:true});
  const result={databaseOk:true,installation:state,rights,catalogueRules,rolloverAndOriginalHeaderAndLoginPreserved:true,playerOrWorkerRpcRun:false};
  writeFileSync(`${folder}/delivery-${mode.slice(2)}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
