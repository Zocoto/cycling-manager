// Bounded read-only preflight; explicit mode installs only the reviewed migration.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
if(!['--preflight','--apply-reviewed-migration','--verify'].includes(mode) || process.argv.length!==3 ||
  readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg') throw new Error('Exact mode/project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:300000});
const query=sql=>{const raw=call(['db','query','--linked',sql,'--output','json']);return JSON.parse(raw.slice(raw.indexOf('{'))).rows;};
const ro=sql=>`begin read only;set local statement_timeout='4s';set local application_name='olympic-itt-delivery';${sql};commit;`;
const version='20261016180000';
const snapshot=()=>query(ro(`select s.id,s.game_year,s.current_day_number,o.race_edition_id,o.qualification_frozen_at,
  (select md5(string_agg(q.country_id::text||':'||q.qualification_rank||':'||q.rider_quota||':'||coalesce(q.exception_reason,''),',' order by q.country_id))
    from public.national_federation_olympic_qualifications q where q.season_id=s.id) road_quota_hash,
  (select count(*)::int from public.national_federation_selection_lists l join public.national_federation_selection_members m on m.selection_list_id=l.id
    where l.season_id=s.id and l.slot_key='nc-hills' and m.response_status='confirmed') road_confirmed_calls
  from public.seasons s join public.national_federation_olympic_events o on o.season_id=s.id where s.status='active' limit 1`));
if(mode==='--preflight') {
  console.log(JSON.stringify({database_ok:query(ro('select 1 ok'))[0].ok,programme:snapshot()}));
} else {
  if(mode==='--apply-reviewed-migration') {
    const expected=JSON.parse(readFileSync('artifacts/.tmp-olympic-itt/functions.json','utf8'));
    const signatures=expected.map(r=>`'public.${r.signature}'::regprocedure`).join(',');
    const live=query(ro(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p where p.oid in (${signatures})`));
    if(live.length!==expected.length || live.some(r=>r.definition!==expected.find(e=>e.signature===r.signature)?.definition)) throw new Error('Function drift since isolated review');
    const before=snapshot();
    console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_olympic_individual_time_trial.sql`,'--output','json']));
    if(JSON.stringify(snapshot())!==JSON.stringify(before)) throw new Error('Road snapshot unexpectedly changed');
    console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
  }
  console.log(JSON.stringify(query(ro(`select 1 database_ok,s.game_year,o.time_trial_race_edition_id,
    t.stage_type,t.distance_km,t.departure_at,t.day_slot,e.field_limit,e.registration_policy,
    (select count(*)::int from public.national_federation_olympic_qualifications q where q.season_id=s.id and q.time_trial_rider_quota>0) invited_nations,
    (select sum(q.time_trial_rider_quota)::int from public.national_federation_olympic_qualifications q where q.season_id=s.id) allocated_places
    from public.seasons s join public.national_federation_olympic_events o on o.season_id=s.id
    join public.race_editions e on e.id=o.time_trial_race_edition_id join public.stages t on t.race_edition_id=e.id
    where s.status='active' limit 1`))));
}
