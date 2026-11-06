// Reviewed contract policy only. No recruitment, fixture, backfill or rollover on production.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const mode = process.argv[2], linkedWorkdir = path.resolve(process.argv[3] ?? '.');
assert([3, 4].includes(process.argv.length) && ['--preflight', '--apply-reviewed', '--verify'].includes(mode));
assert.equal(readFileSync(path.join(linkedWorkdir, 'supabase/.temp/project-ref'), 'utf8').trim(), 'ikagfuchasnsakpouosg');
const version = '20261106140000', name = 'guarantee_recruited_rider_next_season';
const source = readFileSync(`supabase/migrations/${version}_${name}.sql`, 'utf8').replaceAll('\r\n', '\n');
const hash = createHash('md5').update(source).digest('hex');
assert.equal(hash, '0c0ca7698fbfd4a9b211ef89b5d58297', 'Reviewed migration changed');
const patches = [...source.matchAll(/\('([^']+)',\s*\$old\$([\s\S]*?)\$old\$,\s*\$new\$([\s\S]*?)\$new\$\)/g)]
  .map(([, signature, oldText, newText]) => ({signature, oldText, newText}));
assert.equal(patches.length, 7);
const signatures = [...new Set(patches.map(p => p.signature))];
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const directory = path.resolve('artifacts/recruitment-contract-minimum-20261106');
mkdirSync(directory, {recursive: true});
const beforeFile = path.join(directory, 'before.json');
const quote = value => "'" + value.replaceAll("'", "''") + "'";
function query(sql) {
  const file = path.join(directory, 'delivery.sql'); writeFileSync(file, sql);
  const raw = execFileSync(binary, ['db', 'query', '--linked', '--workdir', linkedWorkdir, '--file', file, '--output', 'json'],
    {encoding: 'utf8', timeout: 20000, maxBuffer: 250000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read = sql => query(`begin read only; set local statement_timeout='5s'; set local lock_timeout='500ms'; set local search_path=''; set local application_name='recruitment-contract-minimum-inspect'; ${sql}; commit;`);
const receipt = () => read(`select name,md5(replace(statements[1],chr(13),'')) hash from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0];
const definitions = () => read(`select p.oid::regprocedure::text signature,replace(pg_get_functiondef(p.oid),chr(13),'') definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where p.oid in (${signatures.map(s => `${quote(s)}::regprocedure`).join(',')})
    or (n.nspname in ('public','private') and p.proname in (
      'renew_current_team_rider_until','settle_expiring_rider_contracts','guard_deferred_transfer_contract',
      'respond_to_deferred_transfer_offer','guard_season_draft_reservation','sign_current_team_free_agent',
      'recruit_current_youth_rider','complete_transfer_listing','enforce_team_roster_capacity'))
  order by signature`);
function expectedDefinitions(before) {
  return before.map(row => {
    let definition = row.definition;
    for (const patch of patches.filter(p => p.signature === row.signature)) {
      assert.equal(definition.split(patch.oldText).length - 1, 1, patch.signature);
      assert(!definition.includes(patch.newText), patch.signature);
      definition = definition.replace(patch.oldText, patch.newText);
    }
    return {...row, definition};
  });
}
const stamp = receipt(); if (stamp) assert.deepEqual(stamp, {name, hash});
if (mode === '--preflight') {
  if (!stamp) {
    const before = definitions();
    assert(signatures.every(signature => before.some(row => row.signature === signature)));
    expectedDefinitions(before);
    assert.equal(read("select to_regprocedure('private.ensure_recruited_rider_next_season_contract()') is null absent")[0].absent, true);
    writeFileSync(beforeFile, JSON.stringify({hash, definitions: before}, null, 2));
  }
  console.log(JSON.stringify({readOnly: true, alreadyInstalled: !!stamp, checkedFunctions: signatures.length, hash}));
} else {
  assert(existsSync(beforeFile));
  const before = JSON.parse(readFileSync(beforeFile, 'utf8')); assert.equal(before.hash, hash);
  if (mode === '--apply-reviewed' && !stamp) {
    assert.deepEqual(definitions(), before.definitions);
    query(source.replace(/commit;\s*$/, () => `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]); commit;`));
  }
  assert.deepEqual(receipt(), {name, hash});
  assert.deepEqual(definitions(), expectedDefinitions(before.definitions));
  const policy = read(`select pg_get_functiondef('private.ensure_recruited_rider_next_season_contract()'::regprocedure) definition,
    not has_function_privilege('authenticated','private.ensure_recruited_rider_next_season_contract()','execute') helper_protected,
    (select pg_get_triggerdef(oid) from pg_trigger where tgname='ab_recruited_rider_contract_duration'
      and tgrelid='public.rider_contracts'::regclass and tgenabled='O' and not tgisinternal) trigger_definition,
    exists(select 1 from pg_trigger where tgname='aa_season_draft_contract_reservation'
      and tgrelid='public.rider_contracts'::regclass and tgenabled='O' and not tgisinternal) draft_reservation_enabled,
    exists(select 1 from pg_trigger where tgname='enforce_team_roster_capacity_after_write'
      and tgrelid='public.rider_contracts'::regclass and tgenabled='O' and not tgisinternal) capacity_enabled,
    1 database_ok`)[0];
  const functionBody = source.split('as $$\n')[1].split('\n$$;')[0];
  assert(policy.definition.replaceAll('\r\n', '\n').includes(functionBody));
  assert(policy.helper_protected && policy.draft_reservation_enabled && policy.capacity_enabled);
  assert(policy.trigger_definition.includes('BEFORE INSERT ON public.rider_contracts'));
  assert(!policy.trigger_definition.includes('UPDATE'));
  const response = await fetch('https://cyclostratege.fr/guide', {signal: AbortSignal.timeout(10000)});
  assert.equal(response.status, 200);
  const proof = {checkedAt: new Date().toISOString(), migration: version, hash,
    databaseOk: policy.database_ok === 1, http: response.status,
    checkedFunctions: before.definitions.length, exactFunctionPatchesVerified: true,
    draftAndCapacityGuardsEnabled: true, gameplayBackfill: false, productionFixtures: 0};
  writeFileSync(path.join(directory, 'verified.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
}
