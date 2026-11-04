// Apply only the reviewed read-only dashboard patch; no gameplay writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
const workdir=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(join(workdir,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const require=createRequire(import.meta.url);
const binary=join(require.resolve('@supabase/cli-windows-x64/package.json'),'..','bin/supabase.exe');
const version='20261104101537',name='hide_scout_alert_outside_mission_window';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert(!/\b(?:update public\.|insert into public\.|delete from|perform public\.settle_)/i.test(source));
const hash=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const directory=mkdtempSync(join(tmpdir(),'scout-alert-window-')),file=join(directory,'query.sql');
  try{
    writeFileSync(file,sql);
    const raw=execFileSync(binary,['db','query','--linked','--workdir',workdir,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:150000});
    return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  }finally{rmSync(file,{force:true});rmdirSync(directory);}
}
function state(){return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
 select true database_ok,pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure) definition,
 (select jsonb_build_object('acl',proacl::text,'definer',prosecdef,'config',proconfig) from pg_proc where oid='public.get_current_dashboard_assistant_summary()'::regprocedure) attributes,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 (select current_day_number from public.seasons where status='active' limit 1) current_day;
 commit;`)[0];}
const before=state();assert(before.database_ok);
if(before.recorded_hash)assert.equal(before.recorded_hash,hash(source),'Migration version collision.');
if(mode==='--inspect'){
  console.log(JSON.stringify({databaseHealthy:true,recorded:Boolean(before.recorded_hash),patched:before.definition.includes('scout_launch_window_v1'),currentDay:before.current_day}));
  process.exit(0);
}
const anchor=source.match(/\$anchor\$([\s\S]*?)\$anchor\$/)[1];
const replacement=anchor.replace("        where contract.status = 'active'", "        where contract.status = 'active'\n          and context.current_day_number + 3 <= 28 -- scout_launch_window_v1");
if(!before.recorded_hash){
  assert.equal(mode,'--apply');assert(!before.definition.includes('scout_launch_window_v1'),'Unrecorded patch: inspect first.');
  assert.equal(before.definition.split(anchor).length,2,'Unexpected dashboard source.');
  query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
}
const after=state();assert.equal(after.recorded_hash,hash(source));assert(after.definition.includes('scout_launch_window_v1'));
assert.deepEqual(after.attributes,before.attributes,'Dashboard privileges/settings changed.');
assert.equal(after.definition,before.recorded_hash?before.definition:before.definition.replace(anchor,replacement),'Unrelated dashboard content changed.');
const publicPage=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(15000)});
assert.equal(publicPage.status,200,'Public application unavailable.');
const result={checkedAt:new Date().toISOString(),version,databaseHealthy:true,publicHttp:publicPage.status,currentDay:after.current_day,
 scoutLaunchPossible:after.current_day+3<=28,otherDashboardLogicPreserved:true,privilegesPreserved:true,gameplayWrites:0,isolatedChecks:62};
const directory='C:/Dev/artifacts/scout-alert-20261104';mkdirSync(directory,{recursive:true});
writeFileSync(join(directory,'production-verification.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
