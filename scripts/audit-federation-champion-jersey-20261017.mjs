// One-country, bounded read-only inspection. No gameplay RPC or publication.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const code=(process.argv[2]??'MU').toUpperCase();
if(!/^[A-Z]{2}$/.test(code)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact country and linked project required');
const sql=`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';
 set local application_name='federation-champion-jersey-audit-20261017';
 select 'jersey' kind,jsonb_build_object('country_id',c.id,'code',c.iso_alpha2,'country',c.name,
  'design',j.design,'version',j.version,'published_at',j.published_at,'active_from_game_year',j.active_from_game_year,
  'pending_design',j.pending_design,'pending_activation_game_year',j.pending_activation_game_year,
  'game_year',(select game_year from public.seasons where status='active' limit 1)) payload
 from public.countries c left join public.national_federation_jerseys j on j.country_id=c.id where c.iso_alpha2='${code}'
 union all
 select 'active_champion',jsonb_build_object('rider_id',r.id,'name',r.first_name||' '||r.last_name,
  'type',t.championship_type,'won_at',t.won_at,'season_id',t.season_id)
 from public.countries c join public.rider_national_championship_titles t on t.country_id=c.id
 join public.riders r on r.id=t.rider_id
 where c.iso_alpha2='${code}' and t.championship_type in('road','time_trial') and t.relinquished_at is null limit 5;
 rollback;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:20000});
console.log(JSON.stringify(JSON.parse(raw.slice(raw.indexOf('{'))).rows,null,2));
