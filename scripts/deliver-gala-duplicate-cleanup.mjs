// Owner-authorized deletion of the obsolete duplicate only. No live fixtures,
// exports, simulated races, finance RPCs or changes of rider ownership.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];assert(['--inspect','--apply','--verify'].includes(mode));
const root=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(path.join(root,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261104193037',name='remove_babacar_sow_stale_gala_entry';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r','');
const hash=text=>createHash('md5').update(text).digest('hex');
const folder='C:/Dev/artifacts/gala-roster-audit-20261104';mkdirSync(folder,{recursive:true});
const require=createRequire(import.meta.url),binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql){const file=path.join(folder,'delivery-command.sql');writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--workdir',root,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:100000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;}
const read=sql=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';${sql};commit;`);
const rider='9ae5e40f-1503-4537-9469-5232529db373',oldReg='3e040827-121d-4447-84ac-fea828f17e29';
function state(){return read(`with src as(select id from seasons where game_year=4),lineups as(
 select rr.*,r.team_id,r.program from season_gala_registration_riders rr join season_gala_registrations r on r.id=rr.registration_id where r.season_id=(select id from src)
 ) select 'duplicate' kind,rider_id::text key,jsonb_build_object('clubs',count(distinct team_id)) data from lineups group by rider_id having count(distinct team_id)>1
 union all select 'target',registration_id::text,to_jsonb(lineups) from lineups where registration_id='${oldReg}' and profile='mountain'
 union all select 'kept',registration_id::text,to_jsonb(lineups) from lineups where rider_id='${rider}' and registration_id<>'${oldReg}'
 union all select 'invalid',registration_id::text,jsonb_build_object('profile',profile,'count',count(*),'min',min(position),'max',max(position)) from lineups group by registration_id,profile having count(*) not between 7 and 8 or min(position)<>1 or max(position)<>count(*)
 union all select 'receipt',version,jsonb_build_object('name',name,'hash',md5(statements[1])) from supabase_migrations.schema_migrations where version='${version}'`);}
const before=state(),receipt=before.find(r=>r.kind==='receipt');
if(receipt){assert.equal(receipt.data.name,name);assert.equal(receipt.data.hash,hash(source),'Migration version collision.');}
if(mode==='--inspect'){writeFileSync(folder+'/cleanup-before.json',JSON.stringify(before,null,2));console.log(JSON.stringify({recorded:Boolean(receipt),duplicateRiders:before.filter(r=>r.kind==='duplicate').length,invalidLineups:before.filter(r=>r.kind==='invalid').length,oldLineup:before.filter(r=>r.kind==='target').length,currentClubEntries:before.filter(r=>r.kind==='kept').length}));process.exit(0);}
if(!receipt){
 assert.equal(mode,'--apply');assert.equal(before.filter(r=>r.kind==='invalid').length,0,'Unrelated invalid lineup: audit before proceeding.');
 assert.equal(before.filter(r=>r.kind==='duplicate').length,1);assert.equal(before.find(r=>r.kind==='duplicate').key,rider);
 assert.equal(before.filter(r=>r.kind==='target').length,8);assert.equal(before.filter(r=>r.kind==='kept').length,2);
 query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${source.replaceAll("'","''")}']);commit;`));
}
const after=state();assert.equal(after.find(r=>r.kind==='receipt')?.data.hash,hash(source));
assert.equal(after.filter(r=>r.kind==='duplicate').length,0);assert.equal(after.filter(r=>r.kind==='invalid').length,0);
assert.equal(after.filter(r=>r.kind==='target').length,7);assert(!after.some(r=>r.kind==='target'&&r.data.rider_id===rider));
assert.equal(after.filter(r=>r.kind==='kept').length,2);
const sorted=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
assert.deepEqual(sorted(after.filter(r=>r.kind==='kept')),sorted(before.filter(r=>r.kind==='kept')),'Current-club selections changed.');
if(!receipt){
 const expected=before.filter(r=>r.kind==='target'&&r.data.rider_id!==rider).sort((a,b)=>a.data.position-b.data.position).map((r,i)=>({...r,data:{...r.data,position:i+1}}));
 assert.deepEqual(sorted(after.filter(r=>r.kind==='target')),sorted(expected),'Surviving riders/order changed.');
}
const response=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
const proof={checkedAt:new Date().toISOString(),version,recorded:true,databaseHealthy:true,publicHttp:response.status,
  removedRider:'Babacar Sow',removedFrom:'Yukikaze Outdoor',keptAt:'Okavango Stack',remainingDuplicateRiders:0,invalidLineups:0,oldClubRiders:7,currentClubEntries:2};
writeFileSync(folder+'/cleanup-verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
