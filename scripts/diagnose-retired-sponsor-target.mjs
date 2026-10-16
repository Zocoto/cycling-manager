import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const sql=`begin read only;set local statement_timeout='4s';set local application_name='retired-sponsor-diagnostic';
select o.id,o.description,o.status objective_status,o.target_details,s.game_year,c.status contract_status,
  r.id rider_id,r.first_name,r.last_name,r.status rider_status,
  to_jsonb(o)->>'created_at' objective_created_at,
  (select jsonb_build_object('retirement_game_year',h.retirement_game_year,'retirement_reason',h.retirement_reason)
    from public.rider_history_archives h where h.rider_id=r.id limit 1) retirement
from public.team_sponsor_contracts c join public.sponsor_objectives o on o.sponsor_offer_id=c.sponsor_offer_id
join public.seasons s on s.id=o.season_id
left join public.riders r on r.id::text=o.target_details->>'riderId'
where c.team_id='27948dd4-0dac-416d-8f6c-118771bcb6eb' and o.objective_type='rider_recruitment'
order by s.game_year desc limit 12;
commit;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:100000});
mkdirSync('artifacts/.tmp-retired-search',{recursive:true});
writeFileSync('artifacts/.tmp-retired-search/preflight.json',raw);
console.log(raw);
