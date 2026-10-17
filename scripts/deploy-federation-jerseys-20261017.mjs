// Production operations are explicit, bounded and serial. Never run fixtures.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if(readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Wrong linked project');
function query(sql,file=false){
 const raw=execFileSync(binary,['db','query','--linked',...(file?['--file',sql]:[sql]),'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:80000});
 const start=raw.indexOf('{');if(start<0)throw new Error('Missing receipt; inspect before retrying');return JSON.parse(raw.slice(start));
}
function health(){const start=Date.now();const r=query("begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';select 1 as alive,now() as checked_at;commit;");console.log(JSON.stringify({health:r.rows,roundTripMs:Date.now()-start}));}
const reviewed={
 '--apply-split': ['20261017120000','separate_federation_jersey_roles',"to_regclass('public.national_federation_champion_jerseys') is not null"],
 '--apply-immediate': ['20261017121000','publish_federation_jerseys_immediately',"to_regprocedure('private.publish_federation_jersey_now(text,jsonb,text)') is not null"],
};
const mode=process.argv[2];
if(mode==='--inspect'){
 health();console.log(JSON.stringify(query(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';
 select pg_get_functiondef('public.publish_national_federation_jersey(text,jsonb)'::regprocedure) as publisher,
 pg_get_functiondef('public.activate_due_national_federation_jerseys()'::regprocedure) as activator,
 (select count(*)::int from public.national_federation_jerseys) as kits,
 (select coalesce(sum(octet_length(design::text)),0)::int from public.national_federation_jerseys) as design_bytes,
 (select count(*)::int from public.national_federation_jerseys where pending_design is not null) as pending;
 commit;`).rows));
}else if(mode==='--verify'){
 health();console.log(JSON.stringify(query(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';
 select 'team' kind,count(*)::int kits,count(*) filter(where pending_design is not null)::int pending from public.national_federation_jerseys
 union all select 'champion',count(*)::int,count(*) filter(where pending_design is not null)::int from public.national_federation_champion_jerseys;
 commit;`).rows));
 console.log(JSON.stringify(query(`begin read only;set local statement_timeout='4s';set local lock_timeout='500ms';
 select c.iso_alpha2,team.design as selection_design,champ.design as champion_design,
 team.active_from_game_year as selection_season,champ.active_from_game_year as champion_season,
 r.id as rider_id,r.first_name||' '||r.last_name as champion,t.championship_type
 from public.countries c left join public.national_federation_jerseys team on team.country_id=c.id
 left join public.national_federation_champion_jerseys champ on champ.country_id=c.id
 left join public.rider_national_championship_titles t on t.country_id=c.id and t.relinquished_at is null and t.championship_type in('road','time_trial')
 left join public.riders r on r.id=t.rider_id where c.iso_alpha2='MU' limit 2;commit;`).rows));
}else if(reviewed[mode]){
 const [version,name,installedSql]=reviewed[mode];health();
 const marker=()=>query(`begin read only;set local statement_timeout='3s';select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,${installedSql} installed;commit;`).rows[0];
 const before=marker();if(before.recorded&&!before.installed)throw new Error('Recorded migration disagrees with schema');
 if(!before.recorded){
  const file=`supabase/migrations/${version}_${name}.sql`;
  if(!before.installed)query(file,true);
  const sql=readFileSync(file,'utf8').replaceAll("'","''");
  query(`begin;set local lock_timeout='2s';set local statement_timeout='4s';insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql}']::text[]) on conflict(version) do nothing;commit;`);
 }
 const after=marker();if(!after.recorded||!after.installed)throw new Error('Installation not confirmed');
 console.log(JSON.stringify({migration:version,...after,gameplayRun:false}));health();
}else throw new Error('Explicit inspect, verify or reviewed migration flag required');
