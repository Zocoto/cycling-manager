import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const mode=process.argv[2];
if(!['--install-reviewed-queue','--install-reviewed-health','--state'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Exact mode/project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:20000,maxBuffer:30000});
const version='20261016210000';
if(mode==='--install-reviewed-queue'){
  console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_bound_national_championship_settlement_queue.sql`,'--output','json']));
  console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
}
if(mode==='--install-reviewed-health'){
  console.log(call(['db','query','--linked','--file','supabase/migrations/20261016213000_monitor_national_championship_backlog.sql','--output','json']));
  console.log(call(['migration','repair','20261016213000','--status','applied','--linked','--yes']));
}
console.log(call(['db','query','--linked',`begin read only;set local statement_timeout='4s';set local application_name='cn-settlement-state';
select 1 database_ok,r.competition_type,e.status,count(*)::int editions,
  (select count(*)::int from public.get_due_national_championship_edition_ids(s.id,r.competition_type,now())) due_queue
from public.seasons s join public.race_editions e on e.season_id=s.id join public.races r on r.id=e.race_id
where s.status='active' and r.competition_type in('national_time_trial','national_road') group by s.id,r.competition_type,e.status
order by r.competition_type,e.status;commit;`,'--output','json']));
