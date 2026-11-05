// Applies only the reviewed schema/guard migration. Never starts a draft,
// rolls a season, creates fixtures or signs a contract in production.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';

const mode=process.argv[2];
assert(process.argv.length===3&&['--inspect','--apply','--verify'].includes(mode),'Exact delivery mode required.');
const linked=process.env.SUPABASE_LINKED_WORKDIR??process.cwd();
assert.equal(readFileSync(path.join(linked,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261105210000',name='reserve_season_draft_from_midnight';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
assert(source.startsWith('begin;')&&source.includes("set local lock_timeout='1s'")&&source.includes("set local statement_timeout='8s'")&&/commit;\s*$/.test(source),'Migration bounds changed.');
assert(!/^select public\.(?:process_season_draft|initialize_season_draft|reserve_season_draft_pool|settle_due_season_rollovers)\(/m.test(source),'Delivery must not execute gameplay.');
const md5=value=>createHash('md5').update(value).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const artifact='C:/Dev/artifacts/draft-midnight-20261105';mkdirSync(artifact,{recursive:true});
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
function query(sql,label){
 const file=path.join(artifact,`${label}.sql`);writeFileSync(file,sql);
 const raw=execFileSync(binary,['db','query','--linked','--workdir',linked,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:160000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
function state(label){
 const result=query(readFileSync('supabase/diagnostics/season-draft-midnight-inspection.sql','utf8'),label)[0].inspection;
 writeFileSync(path.join(artifact,`${label}.json`),JSON.stringify(result,null,2)+'\n');return result;
}
function receipt(){return query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
 select name,md5(statements[1]) hash from supabase_migrations.schema_migrations where version='${version}';commit;`,'receipt-read')[0];}
const before=state('delivery-before'),recorded=receipt();
if(recorded){assert.equal(recorded.name,name);assert.equal(recorded.hash,md5(source),'Migration version collision.');}
if(mode==='--inspect'){
 console.log(JSON.stringify({recorded:Boolean(recorded),databaseHealthy:before.databaseOk,settings:before.settings,editions:before.editions,jobs:before.jobs}));process.exit(0);
}
if(!recorded){
 assert.equal(mode,'--apply','Migration is not installed.');
 assert.equal(before.databaseOk,true);
 const known={guard_season_draft_reservation:'540ccce83604736576ada47c054d0f0d',initialize_season_draft:'0d2480e8969b2395b1af32fb0f7cc967',process_season_draft:'52fcbf8dbcd1e70cc05e59902f77a2e4'};
 const hashes=query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
 select proname,md5(prosrc) hash from pg_proc where pronamespace='public'::regnamespace and proname in (${Object.keys(known).map(quote).join(',')});commit;`,'baseline-functions');
 assert.equal(hashes.length,3);for(const row of hashes)assert.equal(row.hash,known[row.proname],`Unexpected baseline ${row.proname}; review before replacement.`);
 const install=source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements)
 values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`);
 query(install,'reviewed-install');
}
assert.equal(receipt()?.hash,md5(source));
const after=state('delivery-after');
const untouched=['rollover_game_season','settle_due_season_rollovers','settle_expiring_rider_contracts'];
const coreFunctions=before.functions.filter(row=>untouched.includes(row.signature.split('(')[0].split('.').at(-1)));
assert.equal(coreFunctions.length,untouched.length,'Required rollover functions missing.');
for(const row of coreFunctions){
 assert.equal(after.functions.find(next=>next.signature===row.signature)?.definition_md5,row.definition_md5,`Unrelated core function changed: ${row.signature}`);
}
assert.deepEqual(after.settings,before.settings);
const editionState=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='poolReservedAt')));
assert.deepEqual(editionState(after.editions),editionState(before.editions),'Delivery must not execute an edition.');
const verified=query(readFileSync('supabase/diagnostics/season-draft-midnight-verification.sql','utf8'),'delivery-feature-verification')[0].verification;
for(const [check,passed]of Object.entries(verified.checks))assert.equal(passed,true,`Feature check failed: ${check}`);
assert.equal(verified.edition.openingStillAtEight,true);assert.equal(verified.edition.selectionStillAtFourteen,true);
if(verified.edition.reservationNotDueYet){assert.equal(verified.edition.poolReservedAt,null);assert.equal(verified.edition.actualPoolCount,0);}
const response=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);
const proof={checkedAt:new Date().toISOString(),version,sourceSha256:createHash('sha256').update(source).digest('hex'),recorded:true,databaseHealthy:true,httpStatus:response.status,verification:verified,productionGameplayExecuted:false};
writeFileSync(path.join(artifact,'delivery-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
