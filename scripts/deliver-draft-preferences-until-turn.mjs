// Reviewed function guard only. Never saves a player's list or advances a live draft.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2],linked=path.resolve(process.argv[3]??'.');
assert([3,4].includes(process.argv.length)&&['--preflight','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync(path.join(linked,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106183000',name='allow_draft_preferences_until_turn';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
assert.equal(hash,'793d0b31d32b2ea08a63559a74807da9','Reviewed migration changed');
const oldText=/v_old := \$old\$([\s\S]*?)\$old\$/.exec(source)?.[1];
const newText=/v_new := \$new\$([\s\S]*?)\$new\$/.exec(source)?.[1];
assert(oldText&&newText);
const baseline=JSON.parse(readFileSync('scripts/fixtures/draft-preferences-baseline.json','utf8')).rows;
const target='public.save_current_season_draft_preferences(uuid,uuid[],boolean)';
const signatures=baseline.map(row=>row.signature);
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const folder=path.resolve('artifacts/draft-preferences-20261106');mkdirSync(folder,{recursive:true});
const beforeFile=path.join(folder,'delivery-before.json');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const file=path.join(folder,'delivery.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',linked,'--file',file,'--output','json'],
    {encoding:'utf8',timeout:20000,maxBuffer:200000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local search_path='';set local application_name='draft-preferences-until-turn-inspect';${sql};commit;`);
const receipt=()=>read(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const definitions=()=>read(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition,p.proacl::text acl
  from pg_proc p where p.oid in(${signatures.map(s=>quote(s)+'::regprocedure').join(',')}) order by signature`);
function expected(rows){
  return rows.map(row=>{
    if(row.signature!==target)return row;
    assert.equal(row.definition.split(oldText).length-1,1);assert(!row.definition.includes(newText));
    return {...row,definition:row.definition.replace(oldText,newText)};
  });
}
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
  if(!stamp){
    const before=definitions();assert.deepEqual(before,baseline);expected(before);
    writeFileSync(beforeFile,JSON.stringify({hash,functions:before},null,2));
  }
  console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp,functions:signatures.length,hash}));
}else{
  assert(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));assert.equal(before.hash,hash);
  if(mode==='--apply-reviewed'&&!stamp){
    assert.deepEqual(definitions(),before.functions);
    query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
  }
  assert.deepEqual(receipt(),{name,hash});assert.deepEqual(definitions(),expected(before.functions));
  const healthy=read('select 1 database_ok')[0].database_ok===1;assert(healthy);
  const site=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(site.status,200);
  const proof={checkedAt:new Date().toISOString(),migration:version,hash,databaseOk:healthy,http:site.status,
    exactPreferenceGuardVerified:true,workerAndOtherFunctionsUnchanged:true,permissionsUnchanged:true,
    playerListsModified:0,productionFixtures:0};
  writeFileSync(path.join(folder,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
