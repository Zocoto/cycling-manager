// Bounded, read-only production diagnostics. No gameplay RPC is invoked.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];
const phase = process.argv[3] ?? 'before';
const queries = {
  context: `select 'timestamps' kind, jsonb_build_object(
    'progressCreated',p.created_at,'progressUpdated',p.updated_at,'achievedAt',p.achieved_at,
    'objectiveCreated',o.created_at,'objectiveUpdated',o.updated_at,
    'resultCreated',r.created_at,'resultUpdated',r.updated_at,'rank',r.final_rank,
    'mainTerms',to_jsonb(terms)) data
  from public.objective_progress p join public.sponsor_objectives o on o.id=p.sponsor_objective_id
  left join public.sponsor_main_objective_terms terms on terms.sponsor_objective_id=o.id
  join public.race_results r on r.race_edition_id='ddf6535e-fa5f-483a-9f67-a8202c142cdf'
    and r.race_roster_id='e96ca497-ff20-48eb-be67-529e039fba7b'
  where p.id='81b947f5-c704-4105-80da-19c3a3779e5c'
  union all select 'trigger',jsonb_build_object('table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',p.proname)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
  where t.tgrelid in ('public.race_editions'::regclass,'public.race_results'::regclass,'public.stages'::regclass,'public.objective_progress'::regclass)
    and not t.tgisinternal`,
  mismatches: `with candidates as (
    select o.id objective_id,o.name,o.status,o.target_details,o.satisfaction_points,
      p.id progress_id,p.status progress_status,p.current_value,p.details,p.settled_at,
      c.id contract_id,c.role,ts.id team_season_id,ts.display_name,
      e.id edition_id,e.status edition_status,
      greatest(1,coalesce(nullif(o.target_details->>'targetRank','')::integer,1)) target_rank
    from public.seasons s join public.sponsor_objectives o on o.season_id=s.id and o.objective_type='race_result' and o.status<>'cancelled'
    join public.objective_progress p on p.sponsor_objective_id=o.id and p.season_id=s.id
    join public.team_sponsor_contracts c on c.id=p.team_sponsor_contract_id and c.sponsor_offer_id=o.sponsor_offer_id and c.status='active'
      and coalesce(c.objective_season_id,c.start_season_id)=s.id
    join public.team_seasons ts on ts.team_id=c.team_id and ts.season_id=s.id
    join lateral (select ed.id,ed.status from public.race_editions ed where ed.season_id=s.id
      and (ed.id::text=o.target_details->>'raceEditionId' or (not exists(select 1 from public.race_editions expected where expected.id::text=o.target_details->>'raceEditionId' and expected.season_id=s.id) and ed.race_id::text=o.target_details->>'raceId'))
      order by ed.created_at,ed.id limit 1) e on e.status='completed'
    where s.status='active'
  ), ranked as (
    select c.*,official.best_rank from candidates c left join lateral (
      select min(r.final_rank)::integer best_rank from public.race_registrations reg
      join public.race_rosters roster on roster.race_registration_id=reg.id
      join public.race_results r on r.race_roster_id=roster.id and r.race_edition_id=reg.race_edition_id
      where reg.team_season_id=c.team_season_id and reg.race_edition_id=c.edition_id
        and r.status='classified' and r.final_rank>0
    ) official on true
  ) select * from ranked where current_value is distinct from coalesce(best_rank,0)::numeric
    or (best_rank<=target_rank and (status<>'completed' or progress_status<>'achieved'))
    or (details->>'achievementLevel'='partial' and best_rank<=target_rank)
  order by display_name,name limit 150`,
  hooks: `select n.nspname schema,p.proname name,pg_get_functiondef(p.oid) definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in (
      'settle_finished_race_conditions','settle_finished_stage_conditions',
      'reward_completed_sponsor_objective','synchronize_s3_sponsor_satisfaction_score',
      'refresh_sponsor_partials_after_combativity','evaluate_sponsor_objectives_after_race')`,
};
if (!(mode in queries) || !['before','after'].includes(phase) || ![3,4].includes(process.argv.length) || readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Expected exact project and diagnostic mode.');
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
try {
  const sql = `begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='sponsor-race-audit-20261102';${queries[mode]};commit;`;
  const raw = execFileSync(binary,['db','query','--linked',sql,'--output','json'],{encoding:'utf8',timeout:25000,maxBuffer:250000});
  const rows = JSON.parse(raw.slice(raw.indexOf('{'))).rows;
  const folder='artifacts/montecristi-sponsor-20261102';
  mkdirSync(folder,{recursive:true});
  writeFileSync(`${folder}/${mode}-${phase}.json`,JSON.stringify(rows,null,2));
  if(mode==='hooks') for(const row of rows) writeFileSync(`${folder}/${row.name}.sql`,row.definition);
  console.log(JSON.stringify(mode==='hooks'?rows.map(r=>({name:r.name,chars:r.definition.length})):rows));
} catch(error) {
  console.error('Read-only audit failed:',error.stderr?.slice(0,1800)??error.message);
  process.exitCode=1;
}
