// Apply only the reviewed duration change. Never start/advance a draft or create player fixtures.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--inspect','--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261105220000',name='draft_ten_minute_turns';
const source=readFileSync('supabase/migrations/'+version+'_'+name+'.sql','utf8').replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'b9737667973b8fe4ae91989d4866fcefb34a593b17f6a8019f28c14ede8727fb');
const folder='C:/Dev/artifacts/draft-ten-minutes-20261105';
mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const md5=value=>createHash('md5').update(value).digest('hex');
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:160000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function read(sql,label){return query("begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';"+sql+';commit;',label);}
function state(label){
 const inspection=readFileSync('supabase/diagnostics/season-draft-midnight-inspection.sql','utf8')
  .replace("'initializedAt',edition.initialized_at,","'currentPosition',edition.current_position,'deadline',edition.pick_deadline,'version',edition.version,'initializedAt',edition.initialized_at,");
 assert.ok(inspection.includes("'deadline',edition.pick_deadline"));
 return query(inspection,label)[0].inspection;
}
function metadata(label){return read("select "+
 "md5(replace(pg_get_functiondef('public.initialize_season_draft(uuid)'::regprocedure),'vous aurez 5 minutes','vous aurez 10 minutes')) expected_initializer,"+
 "md5(replace(replace(replace(pg_get_functiondef('public.advance_season_draft(uuid)'::regprocedure),'interval ''5 minutes''','interval ''10 minutes'''),'Vous avez 5 minutes','Vous avez 10 minutes'),'Le délai de 5 minutes','Le délai de 10 minutes')) expected_advance,"+
 "(select pg_get_expr(conbin,conrelid) from pg_constraint where conrelid='public.season_draft_settings'::regclass and conname='season_draft_settings_pick_seconds_check') duration_check,"+
 "(select column_default from information_schema.columns where table_schema='public' and table_name='season_draft_settings' and column_name='pick_seconds') duration_default,"+
 "(select name from supabase_migrations.schema_migrations where version='"+version+"') receipt,"+
 "(select md5(statements[1]) from supabase_migrations.schema_migrations where version='"+version+"') receipt_hash",label)[0];}

const current=state('current'),meta=metadata('metadata');
assert.equal(current.databaseOk,true);
if(mode==='--inspect'){
 writeFileSync(path.join(folder,'before.json'),JSON.stringify({state:current,metadata:meta},null,2));
 console.log(JSON.stringify({databaseOk:true,settings:current.settings,editions:current.editions,installed:!!meta.receipt}));
}else{
 const baseline=JSON.parse(readFileSync(path.join(folder,'before.json'),'utf8'));
 if(!meta.receipt){
  assert.equal(mode,'--apply');
  assert.equal(current.settings.pick_seconds,300);
  assert.ok(current.editions.every(edition=>edition.status!=='running'),'Review any already-running edition before applying a duration change.');
  assert.ok(source.endsWith('commit;\n'));
  query(source.slice(0,-'commit;\n'.length)+
   'insert into supabase_migrations.schema_migrations(version,name,statements) values('+
   quote(version)+','+quote(name)+',array['+quote(source)+']);\ncommit;','reviewed-install');
 }
 const after=state('after'),verified=metadata('verified');
 assert.equal(verified.receipt,name);assert.equal(verified.receipt_hash,md5(source));
 assert.equal(verified.duration_default,'600');
 assert.equal(verified.duration_check.replace(/[\s()]/g,''),'pick_seconds=600');
 assert.deepEqual(after.settings,{...baseline.state.settings,pick_seconds:600});
 assert.deepEqual(after.editions,baseline.state.editions);
 assert.deepEqual(after.jobs,baseline.state.jobs);assert.deepEqual(after.triggers,baseline.state.triggers);
 const expected={initialize_season_draft:baseline.metadata.expected_initializer,advance_season_draft:baseline.metadata.expected_advance};
 for(const prior of baseline.state.functions){
  const next=after.functions.find(row=>row.signature===prior.signature);assert.ok(next);
  const key=prior.signature.split('(')[0].split('.').at(-1);
  assert.deepEqual(next,{...prior,definition_md5:expected[key]??prior.definition_md5},'Unexpected function or permission change: '+key);
 }
 assert.equal(verified.expected_initializer,baseline.metadata.expected_initializer);
 assert.equal(verified.expected_advance,baseline.metadata.expected_advance);
 const proof={checkedAt:new Date().toISOString(),databaseOk:true,pickSeconds:after.settings.pick_seconds,
  editionsUnchanged:true,midnightReservationPreserved:true,functionsAndRightsVerified:true,gameplayExecuted:false,receipt:verified.receipt};
 writeFileSync(path.join(folder,'verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
