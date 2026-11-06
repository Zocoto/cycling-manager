// Install only the reviewed function checks. No fixture or rollover is executed.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106010000',name='fix_post_olympic_nations_cup_integrity';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const folder='C:/Dev/artifacts/rollover-recovery-20261106';
mkdirSync(folder,{recursive:true});
const baseline=JSON.parse(readFileSync(path.join(folder,'functions-before.json'),'utf8'));
const patches=new Map([
 ['get_season_rollover_integrity(uuid,uuid)',["n.source_season_id is distinct from p_source_season_id",`n.source_season_id is distinct from (select source.id from public.seasons source
        where source.game_year<t.game_year and source.game_year%4<>0
        order by source.game_year desc limit 1)`]],
 ['get_season_rollover_health()',["n.source_season_id is distinct from s.id",`n.source_season_id is distinct from (select source.id from public.seasons source
            where source.game_year<t.game_year and source.game_year%4<>0
            order by source.game_year desc limit 1)`]],
 ['repair_nations_cup_opening_budgets(uuid)',["select id into v_source_id from public.seasons where game_year=v_target.game_year-1;",`select id into v_source_id from public.seasons
  where game_year<v_target.game_year and game_year%4<>0
  order by game_year desc limit 1;`]],
]);
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const md5=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 const raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:240000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function read(sql,label){return query("begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='rollover-integrity-delivery-20261106';"+sql+';commit;',label);}
const receipt=read(`select name,md5(statements[1]) hash from supabase_migrations.schema_migrations where version='${version}'`,'receipt-before');
if(mode==='--apply'&&!receipt.length){
 assert.equal(createHash('sha256').update(source).digest('hex'),'f4c48bb5c6e3e9b2bb3619c08f3f862bc2516d4695000214b27ad56015bf85e1');
 assert.ok(source.endsWith('commit;\n'));
 query(source.slice(0,-'commit;\n'.length)+
  `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'reviewed-install');
}
const after=read(`select p.oid::regprocedure::text signature,p.oid,md5(pg_get_functiondef(p.oid)) definition_md5,p.proacl::text acl,p.proconfig
from pg_proc p where p.oid in (${baseline.map(row=>quote('public.'+row.signature)+'::regprocedure').join(',')})`,'functions-after');
for(const prior of baseline){
 const {definition,...metadata}=prior;
 const patch=patches.get(prior.signature);
 if(patch){
  assert.equal(definition.split(patch[0]).length-1,1);
  metadata.definition_md5=md5(definition.replace(patch[0],patch[1]));
 }
 assert.deepEqual(after.find(row=>row.signature===prior.signature),metadata,'Unexpected function, permission or configuration change: '+prior.signature);
}
const installed=read(`select name,md5(statements[1]) hash from supabase_migrations.schema_migrations where version='${version}'`,'receipt-after');
assert.deepEqual(installed,[{name,hash:md5(source)}]);
const proof={checkedAt:new Date().toISOString(),receipt:version,functionsVerified:after.length,onlyThreeChecksChanged:true,permissionsPreserved:true,gameplayExecuted:false};
writeFileSync(path.join(folder,'migration-verification.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof));
