// Change the default and only unprepared pending entries before the draft starts.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
assert.ok(process.argv.length===3&&['--apply','--verify'].includes(mode));
assert.equal(readFileSync('supabase/.temp/project-ref','utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106103000',name='draft_auto_enabled_by_default';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert.equal(createHash('sha256').update(source).digest('hex'),'74530fa9d170282f35eae3843df1400add23f6b86986d0d36f3f5e6129c880d8');
const folder='C:/Dev/artifacts/draft-preparation-indicator-20261106';mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url);
const cli=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const md5=value=>createHash('md5').update(value).digest('hex');
function query(sql,label){
 const file=path.join(folder,label+'.sql');writeFileSync(file,sql);
 const raw=execFileSync(cli,['db','query','--linked','--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function state(label){return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='300ms';set local application_name='draft-auto-default-delivery-20261106';
 select (select column_default from information_schema.columns where table_schema='public' and table_name='season_draft_participants' and column_name='auto_enabled') auto_default,
 (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') receipt_hash,
 md5(pg_get_functiondef('public.advance_season_draft(uuid)'::regprocedure)) advance_hash,
 md5(pg_get_functiondef('public.save_current_season_draft_preferences(uuid,uuid[],boolean)'::regprocedure)) save_hash,
 md5(pg_get_functiondef('public.get_season_draft_view(boolean)'::regprocedure)) view_hash,
 (select jsonb_agg(to_jsonb(e)) from (select id,game_year,status,version,current_position,pick_deadline,
   (select count(*) from public.season_draft_participants p where p.edition_id=d.id and p.status='pending' and cardinality(p.preferences)=0 and not p.auto_enabled) unprepared_manual_count,
   (select count(*) from public.season_draft_participants p where p.edition_id=d.id and cardinality(p.preferences)>0 and not p.auto_enabled) saved_manual_count
   from public.season_draft_editions d order by game_year desc limit 2) e) editions;commit;`,label)[0];}
const before=state('auto-default-before');
assert.equal(before.advance_hash,'c8065e460f1829874af9a09b13de9dda');
assert.equal(before.save_hash,'e12d1e2995a4196ad5f43252dd470f96');
assert.equal(before.view_hash,'0060e971e50afa76443b5479172b483f');
if(mode==='--apply'&&!before.receipt){
 writeFileSync(path.join(folder,'auto-default-before.json'),JSON.stringify(before,null,2));
 assert.ok(source.endsWith('commit;\n'));
 query(source.slice(0,-'commit;\n'.length)+`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);\ncommit;`,'auto-default-reviewed-install');
}
const after=state('auto-default-after');
assert.equal(after.auto_default,'true');assert.equal(after.receipt,name);assert.equal(after.receipt_hash,md5(source));
for(const key of ['advance_hash','save_hash','view_hash'])assert.equal(after[key],before[key]);
const proof={checkedAt:new Date().toISOString(),receipt:version,automaticDefault:true,functionsUnchanged:true,editions:after.editions};
writeFileSync(path.join(folder,'auto-default-verification.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
