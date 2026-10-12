// Exact task migration only. No fixtures, simulation or gameplay actions.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const version='20261012160000',name='global_olympic_quotas_and_callups';
if(process.argv[2]!=='--apply-reviewed-fix' || process.argv.length!==3 ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact reviewed flag/project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const migration=fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`,import.meta.url));
const sql=readFileSync(migration,'utf8').replaceAll('\r','');
const lit=s=>"'"+s.replaceAll("'","''")+"'";
const patches=Array.from(sql.matchAll(/\('([^']+)', \$before\$([\s\S]*?)\$before\$, \$after\$([\s\S]*?)\$after\$, (\d+)\)/g),m=>({signature:m[1],before:m[2],after:m[3],count:Number(m[4])}));
if(patches.length!==14) throw new Error('Unexpected patch set.');
const preserved=['public.respond_to_national_federation_preselection(uuid,boolean)',
  'public.prioritize_federation_championship_rider(uuid,uuid)',
  'public.get_current_director_federation_callups()',
  'public.get_national_federation_callup_response_closes_at(text,text,timestamp with time zone)',
  'public.assert_federation_callup_response_open(uuid,uuid,text)',
  'public.federation_professional_call_up_is_due(text,timestamp with time zone,timestamp with time zone)',
  'public.get_national_federation_nations_cup_movement_projection(uuid)'];
const signatures=[...new Set([...patches.map(p=>p.signature),...preserved])];
function query(input,file=false){
  let output;
  try { output=execFileSync(binary,['db','query','--linked',...(file?['--file',input]:[input]),'--output','json'],{encoding:'utf8',timeout:45000,maxBuffer:400000}); }
  catch(error){throw new Error(String(error.stderr??error.code??'Query failed').slice(0,2500));}
  const start=output.indexOf('{'); if(start<0) throw new Error('Receipt missing: inspect before retrying.');
  return JSON.parse(output.slice(start)).rows;
}
const ro=select=>`begin read only;set local statement_timeout='5s';${select};commit;`;
const marker=()=>query(ro(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
  to_regclass('public.national_federation_olympic_events') is not null installed`))[0];
const metadata=()=>new Map(query(ro(`select signature,replace(pg_get_functiondef(signature::regprocedure),chr(13),'') definition,
  (select proacl::text from pg_proc where oid=signature::regprocedure) permissions from unnest(array[${signatures.map(lit).join(',')}]) signature`))
  .map(r=>[r.signature,r]));
const initial=marker(),before=metadata();
if(!initial.installed){
  const expected=new Map([...before].map(([s,r])=>[s,r.definition]));
  for(const p of patches){const definition=expected.get(p.signature);
    if(definition.split(p.before).length-1!==p.count) throw new Error(`Anchor drift: ${p.signature}`);
    expected.set(p.signature,definition.replaceAll(p.before,p.after));}
  query(migration,true);
  const after=metadata();
  for(const [s,r] of after) if(r.definition!==expected.get(s) || r.permissions!==before.get(s).permissions)
    throw new Error(`Exact function/ACL preservation failed: ${s}. Inspect outcome, do not retry blindly.`);
}
const integrity=query(ro(`with target as(select id from public.seasons where status='active' and game_year=4),
  event as(select o.* from public.national_federation_olympic_events o join target t on t.id=o.season_id),
  audit as(select a.snapshot from public.olympic_global_migration_audits a join target t on t.id=a.season_id)
  select (select count(*)::int from event) global_events,
  (select count(*)::int from event o join public.stages s on s.race_edition_id=o.race_edition_id
    join public.race_editions e on e.id=o.race_edition_id where s.distance_km=194 and s.profile_type='mixed' and s.status='planned' and e.field_limit=220) correct_course,
  (select count(*)::int from target t join public.national_federation_nations_cup_heats h on h.season_id=t.id
    join public.race_editions e on e.id=h.race_edition_id where e.status<>'cancelled') active_legacy_editions,
  (select sum(q.rider_quota)::int from public.national_federation_olympic_qualifications q join target t on t.id=q.season_id) allocated_places,
  (select count(*)::int from public.national_federation_olympic_qualifications q join target t on t.id=q.season_id where q.rider_quota>0) invited_nations,
  (select count(*)::int from public.national_federation_olympic_qualifications q join target t on t.id=q.season_id
    join public.countries c on c.id=q.country_id where c.iso_alpha2='JP' and q.qualification_rank=67
      and q.rider_quota=2 and q.exception_reason='existing_confirmed_selection') japan_exception,
  (select count(*)::int from public.national_federation_olympic_qualifications q join target t on t.id=q.season_id
    where q.qualification_rank=60 and q.rider_quota=0 and q.exception_reason='reallocated_for_confirmed_selection') exchanged_invitation,
  (select count(*)::int from target t join public.national_federation_selection_lists l on l.season_id=t.id
    join public.countries c on c.id=l.country_id and c.iso_alpha2='JP'
    join public.national_federation_selection_members m on m.selection_list_id=l.id
    join public.national_federation_selection_race_links link on link.selection_list_id=l.id
    join event o on o.race_edition_id=link.race_edition_id
    join public.race_rosters r on r.race_registration_id=link.race_registration_id and r.rider_id=m.professional_rider_id
    where l.slot_key='nc-hills' and m.response_status='confirmed' and r.status='confirmed') japan_confirmed,
  (select count(*)::int from audit a cross join lateral jsonb_array_elements(a.snapshot->'members') old
    left join public.national_federation_selection_members m on m.id=(old->>'id')::uuid where to_jsonb(m) is distinct from old) changed_members,
  (select count(*)::int from audit a cross join lateral jsonb_array_elements(a.snapshot->'rosters') old
    left join public.race_rosters r on r.id=(old->>'id')::uuid where to_jsonb(r) is distinct from old) changed_rosters,
  (select count(*)::int from audit a cross join lateral jsonb_array_elements(a.snapshot->'assignments') old
    left join public.national_federation_nations_cup_assignments x on x.country_id=(old->>'country_id')::uuid and x.season_id=(old->>'season_id')::uuid
    where to_jsonb(x) is distinct from old) changed_nc_assignments,
  (select count(*)::int from event o join public.national_federation_selection_lists l on l.season_id=o.season_id and l.slot_key='nc-hills'
    join public.national_federation_selection_race_links link on link.selection_list_id=l.id
    join public.race_registrations g on g.id=link.race_registration_id
    where link.race_edition_id<>o.race_edition_id or g.race_edition_id<>o.race_edition_id) incorrect_links,
  (select count(*)::int from event o join public.race_results r on r.race_edition_id=o.race_edition_id) unexpected_results`))[0];
if(integrity.global_events!==1 || integrity.correct_course!==1 || integrity.active_legacy_editions!==1 ||
  integrity.allocated_places<1 || integrity.allocated_places>220 || integrity.invited_nations>60 ||
  integrity.japan_exception!==1 || integrity.exchanged_invitation!==1 || integrity.japan_confirmed!==1 ||
  integrity.changed_members || integrity.changed_rosters || integrity.changed_nc_assignments || integrity.incorrect_links || integrity.unexpected_results)
  throw new Error(`Olympic integrity check failed: ${JSON.stringify(integrity)}`);
if(!initial.recorded) query(`begin;set local lock_timeout='3s';set local statement_timeout='5s';
  insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${lit(sql)}]::text[])
  on conflict(version) do nothing;commit;`);
const final=marker(); if(!final.recorded || !final.installed) throw new Error('Missing final registry receipt.');
console.log(JSON.stringify({migration:version,...final,...integrity,noFixturesOrSimulation:true,explicitAgreementCodePreserved:true}));
