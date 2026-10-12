// Run from the linked project directory. Exact reviewed migration only;
// no fixtures, callups, simulations, replays or season rollover actions.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const version='20261012130000',name='single_hybrid_olympic_road_event';
if(process.argv.length!==3 || process.argv[2]!=='--apply-reviewed-fix' ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Reviewed flag and exact linked project required.');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const migration=fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`,import.meta.url));
const sql=readFileSync(migration,'utf8').replaceAll('\r','');
const lit=value=>"'"+value.replaceAll("'","''")+"'";
const patches=Array.from(sql.matchAll(/\('([^']+)', \$before\$([\s\S]*?)\$before\$, \$after\$([\s\S]*?)\$after\$, (\d+)\)/g),m=>({signature:m[1],previous:m[2],replacement:m[3],count:Number(m[4])}));
if(patches.length!==25) throw new Error('Unexpected reviewed patch set.');
const preserved=[
  'public.prioritize_federation_championship_rider(uuid,uuid)',
  'public.sync_national_federation_championship_lineup(uuid)',
  'public.get_current_director_federation_callups()',
  'public.get_national_federation_callup_response_closes_at(text,text,timestamp with time zone)',
  'public.assert_federation_callup_response_open(uuid,uuid,text)',
  'public.get_national_federation_nations_cup_standings(uuid)',
  'public.get_national_federation_nations_cup_movement_projection(uuid)',
];
const signatures=[...new Set([...patches.map(p=>p.signature),...preserved])];
function query(input,file=false){
  let output;
  try{output=execFileSync(binary,['db','query','--linked',...(file?['--file',input]:[input]),'--output','json'],{encoding:'utf8',timeout:45000,maxBuffer:300000});}
  catch(error){throw new Error(String(error.stderr??error.code??'Query failed').slice(0,2000));}
  const start=output.indexOf('{');
  if(start<0) throw new Error('Missing receipt: inspect outcome before retrying.');
  return JSON.parse(output.slice(start)).rows;
}
const readOnly=select=>`begin read only; set local statement_timeout='5s'; ${select}; commit;`;
const marker=()=>query(readOnly(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
  to_regprocedure('public.federation_selection_slot_is_available(text,integer)') is not null installed,
  (select count(*)::int from public.seasons where status='active' and game_year=4) active_s4`))[0];
const metadata=()=>new Map(query(readOnly(`select signature,replace(pg_get_functiondef(signature::regprocedure),chr(13),'') definition,
  (select proacl::text from pg_proc where oid=signature::regprocedure) permissions
  from unnest(array[${signatures.map(lit).join(',')}]) signature`)).map(row=>[row.signature,row]));
const beforeMarker=marker();
if(beforeMarker.recorded!==beforeMarker.installed && beforeMarker.recorded) throw new Error('Registry/install mismatch.');
if(beforeMarker.active_s4!==1) throw new Error('Expected one active S4 season.');
const before=metadata();
if(!beforeMarker.installed){
  const expected=new Map([...before].map(([signature,row])=>[signature,row.definition]));
  for(const patch of patches){
    const definition=expected.get(patch.signature);
    if(definition.split(patch.previous).length-1!==patch.count) throw new Error(`Anchor drift: ${patch.signature}`);
    expected.set(patch.signature,definition.replaceAll(patch.previous,patch.replacement));
  }
  query(migration,true);
  const after=metadata();
  for(const [signature,row] of after){
    if(row.definition!==expected.get(signature) || row.permissions!==before.get(signature).permissions)
      throw new Error(`Exact function/permission preservation failed: ${signature}. Inspect, do not retry blindly.`);
  }
}
// Independent integrity checks against the private before-image; only S4 rows.
const integrity=()=>query(readOnly(`with target as(select id from public.seasons where status='active' and game_year=4),
  road as(select e.id,s.id stage_id,s.profile_type,s.distance_km,s.stage_type from target t
    join public.national_federation_nations_cup_heats h on h.season_id=t.id and h.slot_key='nc-hills'
    join public.race_editions e on e.id=h.race_edition_id and e.status<>'cancelled'
    join public.stages s on s.race_edition_id=e.id),
  snapshot as(select a.snapshot from public.quadrennial_programme_migration_audits a join target t on t.id=a.season_id)
  select (select count(*)::int from road) road_heats,
    (select count(*)::int from road where profile_type='mixed' and distance_km=194 and stage_type='road') correct_profiles,
    (select count(*)::int from road r where (select sum(x.distance_km) from public.stage_segments x where x.stage_id=r.stage_id)=194
      and (select sum(x.distance_km) from public.stage_segments x where x.stage_id=r.stage_id and x.surface_type='cobbles')=19) complete_routes,
    (select count(*)::int from target t join public.national_federation_nations_cup_heats h on h.season_id=t.id
      join public.race_editions e on e.id=h.race_edition_id where h.slot_key<>'nc-hills' and e.status<>'cancelled') obsolete_active_editions,
    (select count(*)::int from target t join public.national_federation_selection_lists l on l.season_id=t.id
      join public.national_federation_selection_members m on m.selection_list_id=l.id
      where l.slot_key in('nc-mountain','nc-sprint','nc-cobbles','nc-time-trial') and m.response_status in('pending','confirmed','draft')) obsolete_active_calls,
    (select count(*)::int from snapshot snap cross join lateral jsonb_array_elements(snap.snapshot->'members') old_member
      join public.national_federation_selection_members m on m.id=(old_member->>'id')::uuid
      join public.national_federation_selection_lists l on l.id=m.selection_list_id
      where l.slot_key='nc-hills' and to_jsonb(m) is distinct from old_member) changed_road_members,
    (select count(*)::int from snapshot snap cross join lateral jsonb_array_elements(snap.snapshot->'stages') old_stage
      where not exists(select 1 from public.stages s where s.id=(old_stage->>'id')::uuid)) missing_stage_ids,
    (select count(*)::int from target t join public.national_federation_nations_cup_heats h on h.season_id=t.id
      join public.race_results r on r.race_edition_id=h.race_edition_id) unexpected_results`))[0];
const validate=row=>{
  if(row.road_heats!==8 || row.correct_profiles!==8 || row.complete_routes!==8 || row.obsolete_active_editions!==0 ||
    row.obsolete_active_calls!==0 || row.changed_road_members!==0 || row.missing_stage_ids!==0 || row.unexpected_results!==0)
    throw new Error(`Programme integrity not confirmed: ${JSON.stringify(row)}`);
};
const checked=integrity();validate(checked);
if(!beforeMarker.recorded) query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s';
  insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${lit(sql)}]::text[])
  on conflict(version) do nothing; commit;`);
const receipt=marker();
if(!receipt.recorded || !receipt.installed) throw new Error('Final migration receipt missing.');
const after=metadata();
for(const signature of preserved) if(after.get(signature).definition!==before.get(signature).definition) throw new Error(`Unrelated rule changed: ${signature}`);
console.log(JSON.stringify({migration:version,recorded:true,installed:true,...checked,callupOwnershipDeadlinesAndApprovalPreserved:true,
  noPlayerActions:true,noSimulationOrReplay:true}));
