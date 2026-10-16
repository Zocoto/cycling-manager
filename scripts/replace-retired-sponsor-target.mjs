import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const mode=process.argv[2];
if(!['--inspect','--apply-reviewed-replacement'].includes(mode)||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Explicit mode/project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:20000});
const version='20261016200000';
if(mode==='--apply-reviewed-replacement')console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_replace_sevrinovitch_retired_sponsor_target.sql`,'--output','json']));
console.log(call(['db','query','--linked',`begin read only;set local statement_timeout='4s';
select 1 database_ok,o.name,o.description,o.target_details,o.satisfaction_points,o.evaluation_timing,
  p.status progress_status,p.current_value,p.details
from public.sponsor_objectives o left join public.objective_progress p on p.sponsor_objective_id=o.id
where o.id='e1ef99d9-208c-4854-8385-142bf7273d73' limit 2;commit;`,'--output','json']));
if(mode==='--apply-reviewed-replacement')console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
