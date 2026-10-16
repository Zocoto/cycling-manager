import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const binary=path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
if(process.argv.includes('--schema')) {
 const query=`begin read only;set local application_name='objective-social-schema-audit-20261016';set local statement_timeout='5s';set local lock_timeout='1s';
 select 'column' kind,table_name||'.'||column_name signature,data_type definition from information_schema.columns
 where table_schema='public' and table_name in ('global_chat_messages','direct_messages','direct_transfer_offers','post_race_interviews','post_race_interview_answer_reactions','cyclogazette_comments','cyclogazette_game_completions','game_objective_definitions','game_objective_claims')
 union all select 'function',p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('calculate_game_objective_progress','claim_current_game_objective','get_current_game_objectives','get_current_game_objectives_pre_prospective','get_current_game_objective_summary_cached'))
 or(n.nspname='private' and p.proname='record_career_achievement');rollback;`;
 const out=execFileSync(binary,['db','query','--linked',query,'--output','json'],{encoding:'utf8',timeout:14000,maxBuffer:300000});
 const data=JSON.parse(out.slice(out.indexOf('{'))).rows;
 mkdirSync('.tmp-objectives-20261016',{recursive:true});writeFileSync('.tmp-objectives-20261016/schema.json',JSON.stringify(data,null,2));
 console.log(JSON.stringify({readOnly:true,functions:data.filter(r=>r.kind==='function').map(r=>r.signature),columns:data.filter(r=>r.kind==='column')}));process.exit(0);
}
const sql=`begin read only;set local application_name='objectives-catalog-audit-20261016';set local statement_timeout='5s';set local lock_timeout='1s';
select 'objective' kind,to_jsonb(d) payload from public.game_objective_definitions d order by d.display_order limit 300;rollback;`;
const raw=execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:14000,maxBuffer:500000});
const rows=JSON.parse(raw.slice(raw.indexOf('{'))).rows;
mkdirSync('.tmp-objectives-20261016',{recursive:true});writeFileSync('.tmp-objectives-20261016/catalog.json',JSON.stringify(rows.map(r=>r.payload),null,2));
console.log(JSON.stringify({total:rows.length,active:rows.filter(r=>r.payload.is_active).length,catalog:rows.map(r=>{const d=r.payload;return [d.objective_key,d.metric_key,d.target_value,d.reward_cash,d.reward_experience,d.reward_reputation,d.reward_item_definition_id];})}));
