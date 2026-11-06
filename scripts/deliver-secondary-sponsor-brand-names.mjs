// Reviewed name correction only. No contract, objective, payment or season activation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2],linked=path.resolve(process.argv[3]??'.');
assert([3,4].includes(process.argv.length)&&['--preflight','--apply-reviewed','--verify'].includes(mode));
assert.equal(readFileSync(path.join(linked,'supabase/.temp/project-ref'),'utf8').trim(),'ikagfuchasnsakpouosg');
const version='20261106193000',name='remove_secondary_sponsor_country_suffixes';
const source=readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8').replaceAll('\r\n','\n');
const hash=createHash('md5').update(source).digest('hex');
assert.equal(hash,'e243fbbe9e5d5d7bbfb777f5aebf2e44','Reviewed migration changed');
const templates=/with templates\(slot_number, brand_name\) as \(values\n([\s\S]*?)\n\)/.exec(source)?.[1];assert(templates);
const folder=path.resolve('artifacts/secondary-sponsor-names-20261106');mkdirSync(folder,{recursive:true});
const beforeFile=path.join(folder,'before.json');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
function query(sql){
  const file=path.join(folder,'delivery.sql');writeFileSync(file,sql);
  const raw=execFileSync(binary,['db','query','--linked','--workdir',linked,'--file',file,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:160000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read=sql=>query(`begin read only;set local statement_timeout='5s';set local lock_timeout='500ms';set local search_path='';set local application_name='secondary-sponsor-names-inspect';${sql};commit;`);
const receipt=()=>read(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const protectedFunctions=()=>read(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl
  from pg_proc p where p.oid in(
    'private.apply_secondary_sponsor_team_season_transition()'::regprocedure,
    'private.evaluate_secondary_sponsor_objectives_after_race()'::regprocedure,
    'public.sign_secondary_sponsor_offer(uuid)'::regprocedure,
    'private.season_finale_gala_team_identity(uuid)'::regprocedure) order by signature`);
const scope=`with templates(slot_number,brand_name) as (values ${templates}), catalog as (
  select sponsor.id,sponsor.catalog_key,sponsor.name,template.brand_name,country.iso_alpha2,
    template.brand_name||' '||country.iso_alpha2 old_name
  from public.secondary_sponsor_catalog sponsor join public.countries country on country.id=sponsor.country_id
  join templates template on template.slot_number=sponsor.slot_number
  where sponsor.catalog_key='secondary-'||lower(country.iso_alpha2)||'-'||template.slot_number
    and sponsor.name in(template.brand_name,template.brand_name||' '||country.iso_alpha2)
), identities as (
  select team.id,team.season_id,team.display_name,team.short_name,catalog.brand_name,catalog.old_name,catalog.iso_alpha2
  from catalog join public.secondary_sponsor_contracts contract on contract.secondary_sponsor_id=catalog.id
  join public.team_seasons team on team.team_id=contract.team_id and team.season_id=contract.season_id
  join public.seasons season on season.id=team.season_id
  where contract.status in('active','planned') and team.status in('active','planned') and season.status in('active','planned')
), expected as (
  select id,season_id,display_name,short_name,
    case when right(display_name,length(' - '||old_name))=' - '||old_name
      then left(display_name,length(display_name)-length(old_name))||brand_name else display_name end new_name,
    case when right(short_name,length('-'||old_name))='-'||old_name
      then left(short_name,length(short_name)-length(old_name))||brand_name
      when length(short_name)=30 and right(short_name,length('-'||brand_name||' '||left(iso_alpha2,1)))='-'||brand_name||' '||left(iso_alpha2,1)
      then left(short_name,length(short_name)-2) else short_name end new_short_name
  from identities
)`;
const counts=()=>read(scope+` select
  (select count(*)::int from catalog where name=old_name) old_catalog_names,
  (select count(*)::int from expected where (display_name,short_name) is distinct from (new_name,new_short_name)) old_team_names,
  (select count(*)::int from expected e join public.team_seasons other on other.season_id=e.season_id and other.id<>e.id and other.display_name=e.new_name
    where e.display_name<>e.new_name) existing_name_collisions,
  (select count(*)::int from (select season_id,new_name from expected group by season_id,new_name having count(*)>1) duplicate_names) generated_name_collisions,
  1 database_ok`)[0];
const changedTeams=()=>read(scope+` select id,display_name,short_name,new_name,new_short_name from expected
  where (display_name,short_name) is distinct from (new_name,new_short_name) order by id limit 501`);
const stamp=receipt();if(stamp)assert.deepEqual(stamp,{name,hash});
if(mode==='--preflight'){
  const before=counts();assert.equal(before.database_ok,1);
  assert.equal(before.existing_name_collisions,0);assert.equal(before.generated_name_collisions,0);
  if(!stamp){
    assert.equal(read("select to_regprocedure('private.normalize_secondary_sponsor_brand_name()') is null absent")[0].absent,true);
    const teams=changedTeams();assert(teams.length<=500);assert.equal(teams.length,before.old_team_names);
    writeFileSync(beforeFile,JSON.stringify({hash,counts:before,teams,functions:protectedFunctions()},null,2));
  }
  console.log(JSON.stringify({readOnly:true,alreadyInstalled:!!stamp,hash,...before}));
}else{
  assert(existsSync(beforeFile));const before=JSON.parse(readFileSync(beforeFile,'utf8'));assert.equal(before.hash,hash);
  if(mode==='--apply-reviewed'&&!stamp){
    assert.deepEqual(protectedFunctions(),before.functions);assert.deepEqual(counts(),before.counts);assert.deepEqual(changedTeams(),before.teams);
    query(source.replace(/commit;\s*$/,()=>`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);commit;`));
  }
  assert.deepEqual(receipt(),{name,hash});assert.deepEqual(protectedFunctions(),before.functions);
  const after=counts();assert.equal(after.old_catalog_names,0);assert.equal(after.old_team_names,0);assert.equal(after.database_ok,1);
  if(before.teams.length){
    const current=read(`select id,display_name,short_name from public.team_seasons where id in(${before.teams.map(team=>quote(team.id)+'::uuid').join(',')}) order by id`);
    assert.deepEqual(current,before.teams.map(team=>({id:team.id,display_name:team.new_name,short_name:team.new_short_name})));
  }
  const policy=read(`select pg_get_functiondef('private.normalize_secondary_sponsor_brand_name()'::regprocedure) definition,
    not has_function_privilege('authenticated','private.normalize_secondary_sponsor_brand_name()','execute') protected,
    exists(select 1 from pg_trigger where tgrelid='public.secondary_sponsor_catalog'::regclass
      and tgname='normalize_secondary_sponsor_brand_name_before_write' and tgenabled='O' and not tgisinternal) trigger_enabled`)[0];
  assert(policy.definition.includes(source.split('as $$\n')[1].split('\n$$;')[0]));assert(policy.protected&&policy.trigger_enabled);
  const site=await fetch('https://cyclostratege.fr/guide',{signal:AbortSignal.timeout(10000)});assert.equal(site.status,200);
  const proof={checkedAt:new Date().toISOString(),migration:version,hash,databaseOk:true,http:site.status,
    catalogNamesCorrected:before.counts.old_catalog_names,teamNamesCorrected:before.teams.length,
    futureWritesProtected:true,contractsAndBusinessFunctionsUnchanged:true,productionFixtures:0};
  writeFileSync(path.join(folder,'verified.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}
