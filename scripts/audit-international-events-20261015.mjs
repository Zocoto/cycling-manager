import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
if (process.argv.includes('--dodo')) {
  const query = `begin read only; set local application_name='dodo-callups-audit-20261015'; set local statement_timeout='4s'; set local lock_timeout='1s';
  select t.id team_id,t.internal_name,t.amateur_name,m.id member_id,m.response_status,m.professional_rider_id,
  r.first_name,r.last_name,c.iso_alpha2,l.id list_id,l.status list_status,l.slot_key,
  target.race_edition_id,target.departure_at
  from public.teams t join public.national_federation_selection_members m on m.owner_team_id=t.id
  join public.national_federation_selection_lists l on l.id=m.selection_list_id
  join public.seasons s on s.id=l.season_id and s.status='active'
  join public.countries c on c.id=l.country_id
  left join public.riders r on r.id=m.professional_rider_id
  left join lateral public.get_national_federation_selection_target(l.country_id,l.season_id,l.slot_key) target on true
  where t.id in (select ts.team_id from public.team_seasons ts where ts.season_id=s.id and ts.display_name ilike '%dodo%') limit 30; rollback;`;
  const raw=execFileSync(binary,['db','query','--linked',query,'--output','json'],{encoding:'utf8',timeout:12000,maxBuffer:30000});
  console.log(raw); process.exit(0);
}
if (process.argv.includes('--schedule')) {
 const query=`begin read only; set local application_name='international-schedule-audit-20261015'; set local statement_timeout='4s'; set local lock_timeout='1s';
 select s.game_year,s.current_day_number,c.iso_alpha2,sch.* from public.seasons s cross join public.countries c
 cross join lateral public.get_national_federation_preselection_schedule(c.id,s.id) sch
 where s.status='active' and c.iso_alpha2 in ('MU','FR') and sch.slot_key in ('cc-pro-road','cc-pro-itt','cc-junior-road'); rollback;`;
 console.log(execFileSync(binary,['db','query','--linked',query,'--output','json'],{encoding:'utf8',timeout:12000,maxBuffer:20000})); process.exit(0);
}
if (process.argv.includes('--retirement')) {
 const query=`begin read only; set local application_name='junior-cup-retirement-audit-20261015'; set local statement_timeout='5s'; set local lock_timeout='1s';
 select 'columns' kind,table_name object,jsonb_agg(jsonb_build_object('column',column_name,'type',data_type)) detail
 from information_schema.columns where table_schema='public' and table_name in ('national_federation_hosting_events','national_federation_hosting_candidacies','national_federation_hosting_awards','development_race_registrations','development_race_stages') group by table_name
 union all select 'constraint',conrelid::regclass::text,jsonb_agg(pg_get_constraintdef(oid)) from pg_constraint
 where conrelid in ('public.national_federation_hosting_awards'::regclass,'public.national_federation_hosting_candidacies'::regclass) group by conrelid
 union all select 'edition',s.game_year::text,jsonb_agg(jsonb_build_object('id',e.id,'status',e.status,'day',e.start_day_number)) from public.development_race_editions e join public.seasons s on s.id=e.season_id where e.competition_type='nations_cup_junior' group by s.game_year;
 rollback;`;
 console.log(execFileSync(binary,['db','query','--linked',query,'--output','json'],{encoding:'utf8',timeout:13000,maxBuffer:20000})); process.exit(0);
}
if (process.argv.includes('--hosting')) {
 const query=`begin read only;set local application_name='junior-cup-hosting-audit-20261015';set local statement_timeout='3s';set local lock_timeout='1s';
 select 'awards' kind,target_game_year,status,count(*) total,sum(hosting_cost) cost from public.national_federation_hosting_awards where event_type='nations_cup_junior' group by target_game_year,status
 union all select 'candidacies',target_game_year,status,count(*),sum(hosting_cost) from public.national_federation_hosting_candidacies where event_type='nations_cup_junior' group by target_game_year,status;rollback;`;
 console.log(execFileSync(binary,['db','query','--linked',query,'--output','json'],{encoding:'utf8',timeout:11000,maxBuffer:10000}));process.exit(0);
}
const sql = `begin read only;
set local application_name='international-events-audit-20261015';
set local statement_timeout='5s'; set local lock_timeout='1s';
select p.oid::regprocedure::text signature, pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
'respond_to_national_federation_preselection','sync_national_federation_championship_lineup',
'get_national_federation_selection_target','assert_federation_callup_response_open',
'ensure_federation_junior_championship_calendar','get_current_director_federation_callups',
'prioritize_federation_championship_rider','get_federation_selection_rider_limit',
'get_national_federation_selection_schedule','publish_national_federation_preselection',
'get_national_federation_hosting_events','select_national_federation_hosts','submit_national_federation_hosting_candidacy',
'sync_national_federation_junior_lineup','get_current_federation_hosting_calendar',
'ensure_automatic_federation_junior_lineups');
rollback;`;
const raw = execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:300000});
const rows = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
mkdirSync('.tmp-international-events',{recursive:true});
writeFileSync('.tmp-international-events/functions.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify({readOnly:true,functions:rows.map(r=>r.signature)}));
