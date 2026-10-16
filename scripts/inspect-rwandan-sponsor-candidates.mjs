import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const sql=`begin read only;set local statement_timeout='4s';set local application_name='rwandan-sponsor-candidates';
select r.id,r.first_name,r.last_name,r.status,to_jsonb(r)->>'birth_game_year' birth_game_year,to_jsonb(rt) ratings,
  (select jsonb_build_object('team_id',c.team_id,'status',c.status,'salary',c.salary_per_season) from public.rider_contracts c
    where c.rider_id=r.id and c.status in('active','planned') order by (c.status='planned') desc limit 1) current_contract
from public.riders r join public.countries c on c.id=r.country_id and c.iso_alpha2='RW'
join public.seasons s on s.status='active'
join public.rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=s.id
where r.status in('active','free_agent') order by r.status desc,r.last_name limit 40;commit;`;
console.log(execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:30000,maxBuffer:60000}));
