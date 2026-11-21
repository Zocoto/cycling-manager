// Reviewed schema delivery and real, idempotent catch-up. Never uses fixtures.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const binary=path.resolve('node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const output='C:/Dev/tmp/international-rewards-20261121-delivery';
const mode=process.argv[2];
const migrations=[
  {version:'20261121110000',name:'settle_federation_race_club_rewards',sha256:'f2987e00824fff5e7fd53281845a929511348350b8030fd57d43d708e9e74eab'},
  {version:'20261121130000',name:'restore_international_selection_trophies',sha256:'cafb2c08fed764bbbf7bb35c33255e2848405c78ea83b461b42a35469b8dc6e9'},
];
if(!['--install-reviewed','--inspect','--repair-current-season','--verify'].includes(mode)||process.argv.length!==3)
  throw Error('Exact delivery mode required.');
const project=readFileSync(path.resolve('../cycling-manager-ds-trophy-merge-20261009/supabase/.temp/project-ref'),'utf8').trim();
if(project!=='ikagfuchasnsakpouosg')throw Error('Unexpected linked project.');
mkdirSync(output,{recursive:true});
function query(sql){
  const file=`${output}/query-${createHash('sha256').update(sql).digest('hex').slice(0,16)}.sql`;
  const sqlArgs=sql.length>6000 ? (writeFileSync(file,sql),['--file',file]) : [sql];
  try{
    const raw=execFileSync(binary,['db','query','--linked','--project-ref',project,...sqlArgs],{encoding:'utf8',timeout:20000,maxBuffer:160000});
    return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  }catch(error){throw Error(String(error.stderr||error.message).slice(0,1800));}
}
const read=sql=>query(`begin read only;set local application_name='international-rewards-20261121-delivery';set local statement_timeout='3s';set local lock_timeout='500ms';${sql};commit;`);
async function health(){
  const [row]=read('select 1 as database_ok');
  const response=await fetch('https://cyclostratege.fr/connexion',{signal:AbortSignal.timeout(10000)});
  if(row?.database_ok!==1||response.status!==200)throw Error('Live database/site health failed.');
}
function editions(){return read(`select e.id,e.display_name,r.competition_type,s.game_year from public.seasons s
  join public.race_editions e on e.season_id=s.id and e.status='completed'
  join public.races r on r.id=e.race_id and r.competition_type in ('continental_championship','world_championship','nations_cup')
  where s.status='active' and not exists(select 1 from public.national_federation_olympic_events g
    where g.season_id=s.id and e.id in(g.race_edition_id,g.time_trial_race_edition_id))
  order by e.id limit 80`);}
function audit(id){
  if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid edition ID.');
  return read(`select public.get_federation_race_club_reward_audit('${id}'::uuid) as audit`)[0].audit;
}
await health();
if(mode==='--install-reviewed'){
  for(const migration of migrations){
    const source=readFileSync(path.join(root,'supabase/migrations',`${migration.version}_${migration.name}.sql`),'utf8').replaceAll('\r','');
    if(createHash('sha256').update(source).digest('hex')!==migration.sha256)throw Error(`Unreviewed migration: ${migration.version}`);
    const sourceHash=createHash('md5').update(source).digest('hex');
    const existing=read(`select name,md5(array_to_string(statements,'')) hash from supabase_migrations.schema_migrations where version='${migration.version}'`)[0];
    if(existing){if(existing.name!==migration.name||existing.hash!==sourceHash)throw Error('Migration receipt mismatch.');continue;}
    if(!/^begin;/.test(source)||!/commit;\s*$/.test(source))throw Error('Atomic migration required.');
    const receipt=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${migration.version}','${migration.name}',array['${source.replaceAll("'","''")}']::text[]);commit;`;
    query(source.replace(/commit;\s*$/,receipt));
    console.log(JSON.stringify({installed:migration.version}));
  }
  await health();
  const access=read(`select has_function_privilege('authenticated','public.settle_federation_race_club_rewards(uuid)','execute') player_can_pay,
    has_function_privilege('anon','public.get_federation_race_club_reward_audit(uuid)','execute') anonymous_can_audit,
    has_function_privilege('authenticated','public.get_sporting_director_selection_trophy_wins(uuid)','execute') player_can_read_other_trophies`)[0];
  if(Object.values(access).some(Boolean))throw Error('Unexpected public access.');
  writeFileSync(`${output}/installation.json`,JSON.stringify({migrations,access,verifiedAt:new Date().toISOString()},null,2));
  console.log(JSON.stringify({health:'ok',access}));
}else{
  const targets=editions(),before=[];
  for(const edition of targets)before.push({...edition,audit:audit(edition.id)});
  writeFileSync(`${output}/${mode==='--repair-current-season'?'before-repair':'audit'}-state.json`,JSON.stringify(before,null,2));
  if(before.some(row=>!row.audit.ready))throw Error('Catch-up blocked by a beneficiary/result inconsistency.');
  if(mode==='--repair-current-season'){
    const results=[];
    for(const edition of before){
      let settlement=null;
      if(edition.audit.missingRewardCount>0){
        settlement=query(`begin;set local application_name='international-rewards-real-catchup-20261121';set local statement_timeout='6s';set local lock_timeout='500ms';select public.settle_federation_race_club_rewards('${edition.id}'::uuid) as result;commit;`)[0].result;
      }
      const notifications=query(`begin;set local application_name='international-trophy-real-catchup-20261121';set local statement_timeout='3s';set local lock_timeout='500ms';select private.notify_major_race_trophies('${edition.id}'::uuid) as created;commit;`)[0].created;
      const after=audit(edition.id);
      if(!after.ready||after.missingRewardCount!==0)throw Error(`Incomplete catch-up: ${edition.id}`);
      results.push({edition:edition.display_name,id:edition.id,settlement,notifications,after});
      writeFileSync(`${output}/repair-results.json`,JSON.stringify(results,null,2));
      console.log(JSON.stringify({edition:edition.display_name,settlement,notifications,missing:after.missingRewardCount}));
    }
    await health();
  }else{
    console.log(JSON.stringify(before.map(row=>({edition:row.display_name,...row.audit}))));
    if(mode==='--verify'&&before.some(row=>row.audit.missingRewardCount!==0))throw Error('Missing awards remain.');
  }
}
