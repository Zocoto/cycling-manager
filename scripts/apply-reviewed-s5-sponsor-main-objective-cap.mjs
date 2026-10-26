// Install only the reviewed S5 cap. No gameplay RPC, settlement or test fixture.
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed-fix'].includes(mode) ||
  readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg') {
  throw Error('Exact mode and expected linked project required.');
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261026110000', name = 'cap_future_sponsor_main_objective_rewards';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const md5 = value => createHash('md5').update(value).digest('hex');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const sourceHash = md5(source);
const reviewedSourceHash = 'de611598c5b699a0213d6ae0a0555e99';
if (sourceHash !== reviewedSourceHash) throw Error('The migration changed after review; review the exact SQL again.');
const functionNames = ['cap_sponsor_main_objective_reward', 'recap_sponsor_main_objectives_after_budget_change'];
const expectedFunctions = Object.fromEntries(functionNames.map(functionName => {
  const start = source.indexOf(`function private.${functionName}()`);
  const body = source.indexOf('as $$', start) + 5;
  if (start < 0 || body < 5) throw Error('Missing reviewed trigger routine.');
  return [`private.${functionName}()`, md5(source.slice(body, source.indexOf('$$;', body)))];
}));
if (!source.startsWith('begin;') || !source.includes("set local statement_timeout = '5s'") ||
  !source.includes("set local lock_timeout = '500ms'") || !/commit;\s*$/.test(source)) {
  throw Error('The reviewed migration must be transactional and bounded.');
}
const run = sql => {
  const file = path.join(tmpdir(), `s5-sponsor-cap-${randomUUID()}.sql`);
  writeFileSync(file, sql, { flag: 'wx' });
  try {
    const output = execFileSync(binary, ['db', 'query', '--linked', '--file', file, '--output', 'json'], {
      encoding: 'utf8', timeout: 20000, maxBuffer: 50000,
    });
    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  } finally {
    unlinkSync(file);
  }
};
const inspect = () => run(`begin read only;
set local application_name='s5-sponsor-main-cap-inspect';
set local statement_timeout='3s';set local lock_timeout='500ms';
with historical as (
 select t.* from public.sponsor_main_objective_terms t
 join public.sponsor_objectives o on o.id=t.sponsor_objective_id
 join public.seasons s on s.id=o.season_id and s.game_year=4
 order by t.sponsor_objective_id limit 201
)
select 1 database_ok,
 exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
 (select md5(statements[1]) from supabase_migrations.schema_migrations where version='${version}') recorded_hash,
 (select jsonb_object_agg(r.signature,md5(replace(p.prosrc,chr(13),''))) from
  (values('private.cap_sponsor_main_objective_reward()'),('private.recap_sponsor_main_objectives_after_budget_change()')) r(signature)
  left join pg_proc p on p.oid=to_regprocedure(r.signature)) functions,
 (select count(*)::int from pg_trigger where not tgisinternal and tgname in
  ('cap_future_sponsor_main_objective_reward','recap_future_main_objectives_offer_budget','recap_future_main_objectives_contract_budget')
  and tgrelid in('public.sponsor_main_objective_terms'::regclass,'public.sponsor_offers'::regclass,'public.team_sponsor_contracts'::regclass)) trigger_count,
 (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='private.settle_sponsor_main_objective()'::regprocedure) settlement_hash,
 (select count(*)::int from historical) s4_count,
 (select md5(string_agg(sponsor_objective_id::text||':'||cash_reward::text||':'||reputation_penalty::text||':'||currency_code||':'||race_category_code,'|' order by sponsor_objective_id)) from historical) s4_terms_hash,
 (select count(*)::int from (select t.sponsor_objective_id from public.sponsor_main_objective_terms t
  join public.sponsor_objectives o on o.id=t.sponsor_objective_id
  join public.seasons s on s.id=o.season_id and s.game_year>=5 limit 201) future) future_count;
commit;`)[0];

const before = inspect();
if (mode === '--inspect') { console.log(JSON.stringify(before)); process.exit(0); }
if (before.database_ok !== 1 || !before.settlement_hash || before.s4_count >= 201) throw Error('Preflight health or bounded snapshot mismatch.');
if (before.recorded && before.recorded_hash !== sourceHash) throw Error('Recorded migration differs: never replay it.');
if (!before.recorded) {
  if (Object.values(before.functions).some(Boolean) || before.trigger_count !== 0 || before.future_count !== 0) {
    throw Error('Schema or future objectives changed since review; inspect before installing.');
  }
  run(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\ncommit;`));
}
const after = inspect();
if (!after.recorded || after.recorded_hash !== sourceHash || after.trigger_count !== 3 ||
  Object.entries(expectedFunctions).some(([signature, hash]) => after.functions[signature] !== hash) ||
  after.settlement_hash !== before.settlement_hash || after.s4_count !== before.s4_count ||
  after.s4_terms_hash !== before.s4_terms_hash || after.future_count !== before.future_count) {
  throw Error('Installation receipt differs from the reviewed code or existing commitments.');
}
console.log(JSON.stringify({ migration: version, ...after, s4TermsPreserved: true, gameplayExecuted: false }));
