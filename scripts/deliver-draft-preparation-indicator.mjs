// Only the reviewed readiness projection/revision. No draft worker or fixture.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106100000',name='draft_preparation_indicator';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'21822bf3ebe7c7acc2e08a04f021f8affce79a58237a2b9aa55b0a39adbd91a9');
const folder='C:/Dev/artifacts/draft-preparation-indicator-20261106';mkdirSync(folder,{recursive:true});
const baseline=JSON.parse(readFileSync(path.join(folder,'functions-before.json'),'utf8'));
const expected=new Map([
 ['get_season_draft_view(boolean)','0060e971e50afa76443b5479172b483f'],
 ['save_current_season_draft_preferences(uuid,uuid[],boolean)','e12d1e2995a4196ad5f43252dd470f96'],
]);
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const md5=value=>createHash('md5').update(value).digest('hex');
function metadataOf(row){const metadata={...row};delete metadata.definition;return metadata;}
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 const raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function read(sql,label){return query("begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';set local application_name='draft-ready-delivery-20261106';"+sql+';commit;',label);}
function state(label){return read(`select
 (select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'oid',p.oid::bigint,'definition_md5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'proconfig',p.proconfig))
 from pg_proc p where p.oid in (${baseline.map(row=>quote('public.'+row.signature)+'::regprocedure').join(',')})) functions,
 (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') receipt_hash`,label)[0];}
const before=state('before-install');
if(mode==='--apply'&&!before.receipt){
 for(const metadata of baseline.map(metadataOf))assert.deepEqual(before.functions.find(row=>row.signature===metadata.signature),metadata,'Function changed since review.');
 assert.ok(source.endsWith('commit;\n'));
 query(source.slice(0,-'commit;\n'.length)+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'reviewed-install');
}
const after=state('after-install');
assert.equal(after.receipt,name);assert.equal(after.receipt_hash,md5(source));
for(const metadata of baseline.map(metadataOf)){
 metadata.definition_md5=expected.get(metadata.signature)??metadata.definition_md5;
 assert.deepEqual(after.functions.find(row=>row.signature===metadata.signature),metadata,'Unexpected definition, OID, permissions or configuration.');
}
const proof={checkedAt:new Date().toISOString(),receipt:version,functionsVerified:3,advanceUnchanged:true,permissionsPreserved:true,noGameplayExecuted:true};
writeFileSync(path.join(folder,'migration-verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
