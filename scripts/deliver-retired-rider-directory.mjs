import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
if(process.argv[2]!=='--apply-reviewed-migration'||readFileSync('supabase/.temp/project-ref','utf8').trim()!=='ikagfuchasnsakpouosg')throw new Error('Explicit mode/project required');
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const call=args=>execFileSync(binary,args,{encoding:'utf8',timeout:30000,maxBuffer:20000});
const version='20261016190000';
console.log(call(['db','query','--linked','--file',`supabase/migrations/${version}_include_retired_riders_in_directory.sql`,'--output','json']));
console.log(call(['db','query','--linked',`begin read only;set local statement_timeout='4s';
select 1 database_ok,position('on rider.status in (''active'', ''free_agent'', ''retired'')' in
  pg_get_functiondef('public.search_game_directory(text,integer)'::regprocedure))>0 retired_enabled,
  exists(select 1 from pg_indexes where schemaname='public' and indexname='riders_directory_full_name_trgm_idx') name_index_present;
commit;`,'--output','json']));
console.log(call(['migration','repair',version,'--status','applied','--linked','--yes']));
