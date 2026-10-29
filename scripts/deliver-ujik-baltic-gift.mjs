// Exact owner-requested compensation only. No simulation or reward redemption.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';

const mode=process.argv[2];
const version='20261029153000',name='grant_ujik_baltic_failed_chase_gift';
const directory='C:/Dev/artifacts/ujik-baltic-gift-20261029';
const linkedRoot='C:/Dev/cycling-manager';
if(process.argv.length!==3||!['--apply-reviewed','--verify'].includes(mode)||
 readFileSync(linkedRoot+'/supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw Error('Exact mode and linked project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const sql=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(sql).digest('hex');
if(!sql.startsWith('begin;')||!sql.includes("set local lock_timeout = '1s'")||!sql.includes("set local statement_timeout = '5s'")||!/commit;\s*$/.test(sql))throw Error('Bounded atomic migration required');
mkdirSync(directory,{recursive:true});
const query=text=>{
 const file=path.join(directory,'delivery-command.sql');writeFileSync(file,text);
 const raw=execFileSync(binary,['db','query','--linked','--workdir',linkedRoot,'--file',file,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:30000});
 return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro=text=>query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='ujik-baltic-gift-verification';${text};commit;`);
const receipt=()=>ro(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const before=receipt();
if(before&&(before.name!==name||before.hash!==hash))throw Error('Migration receipt mismatch; do not replay');
if(mode==='--apply-reviewed'&&!before){
 const quote=value=>"'"+value.replaceAll("'","''")+"'";
 query(sql.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(sql)}]);\ncommit;`));
}
assert.deepEqual(receipt(),{name,hash});
const rows=ro(`select g.id grant_id,g.sporting_director_id,g.team_season_id,g.reward_key,
 c.name reward_name,c.importance,i.id inventory_id,i.status,i.expires_after_game_year,
 (select count(*)::int from public.sporting_director_messages m where m.sporting_director_id=g.sporting_director_id and m.source_reference='race-incident-compensation:'||g.incident_key||':'||g.sporting_director_id::text) notifications
 from public.race_incident_compensation_grants g
 join public.daily_reward_inventory i on i.source_race_incident_compensation_id=g.id
 join public.daily_reward_catalog c on c.reward_key=i.reward_key
 where g.incident_key='ujik-baltic-cobbles-failed-chase-20261029'
 and g.sporting_director_id='d7ec0ccf-bcb4-4802-8a14-b458eccf41d7' limit 2`);
assert.equal(rows.length,1);const gift=rows[0];
assert.equal(gift.team_season_id,'3945ad38-a7bc-41c2-b3b1-4826044f2e9b');
assert.equal(gift.reward_key,'primary-breakthrough');assert.equal(gift.importance,9);assert.equal(gift.expires_after_game_year,5);assert.equal(gift.notifications,1);
assert.ok(['available','used'].includes(gift.status));
const response=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(15000)});
assert.equal(response.status,200,'Live application health check failed');
const proof={checkedAt:new Date().toISOString(),mode,version,recorded:true,databaseHealthy:true,publicHttp:response.status,gift};
writeFileSync(path.join(directory,'production-verification.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));
