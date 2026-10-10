// Apply this exact reviewed migration, with no gameplay tests or fixtures.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const version = '20261010180000', name = 'halloween_avatar_wardrobe';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg' ||
    process.argv.length !== 3 || process.argv[2] !== '--apply-reviewed-fix') throw new Error('Reviewed flag and expected linked project required.');
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const migration = fileURLToPath(new URL(`../supabase/migrations/${version}_${name}.sql`, import.meta.url));
const literal = value => "'" + value.replaceAll("'", "''") + "'";
function query(sql, file = false) {
  let output;
  try { output = execFileSync(binary, ['db','query','--linked',...(file ? ['--file',sql] : [sql]),'--output','json'], { encoding:'utf8',timeout:45000,maxBuffer:100000 }); }
  catch (error) { throw new Error(String(error.stderr ?? error.code ?? 'Database query failed').slice(0,1500)); }
  const start = output.indexOf('{');
  if (start < 0) throw new Error('Missing receipt: inspect outcome before retrying.');
  return JSON.parse(output.slice(start));
}
const marker = `begin read only; set local statement_timeout='5s';
  select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
    to_regprocedure('public.save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[])') is not null as installed,
    (select count(*)=8 and bool_and(catalog.price=prices.price) from (values ('lord-vlad',50),('halloween-background',30),('devil-trident',24),('pumpkin-cap',14),('pocket-bat',8),('spectral-wheel',16),('cobweb-frame',14),('ghost-scarf',20)) prices(id,price) join halloween_catalog catalog on catalog.id=prices.id) as prices_ok,
    (select effect->>'slot'='frame_corner' from halloween_catalog where id='cobweb-frame') as corner_ok,
    coalesce(has_function_privilege('authenticated',to_regprocedure('public.save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[])'),'execute'),false) as player_access,
    coalesce(has_function_privilege('service_role',to_regprocedure('public.save_sporting_director_avatar_cosmetics(uuid,text,uuid,text,text,boolean,text[])'),'execute'),false) as server_access,
    md5(pg_get_functiondef('public.apply_halloween_avatar()'::regprocedure)) as portrait_rule,
    md5(pg_get_functiondef('public.halloween_action(uuid,uuid,text,jsonb)'::regprocedure)) as event_rule;
  commit;`;
const complete = row => row.installed && row.prices_ok && row.corner_ok && !row.player_access && row.server_access;
const before = query(marker).rows[0];
if (before.recorded && !complete(before)) throw new Error('Recorded migration and installed rules disagree.');
if (!before.recorded && before.installed && !complete(before)) throw new Error('Partial installation: inspect before applying anything.');
if (!before.recorded) {
  if (!complete(before)) query(migration, true);
  const after = query(marker).rows[0];
  if (!complete(after) || after.portrait_rule !== before.portrait_rule || after.event_rule !== before.event_rule) throw new Error('Installation/preservation not confirmed: inspect before retrying.');
  const sql = readFileSync(migration,'utf8');
  query(`begin; set local lock_timeout='3s'; set local statement_timeout='5s'; insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${literal(sql)}]::text[]) on conflict(version) do nothing; commit;`);
}
const receipt = query(marker).rows[0];
if (!receipt.recorded || !complete(receipt)) throw new Error('Migration receipt not confirmed.');
console.log(JSON.stringify({ migration: version, installed:true, recorded:true, pricesAligned:true,
  existingEventRulesPreserved:receipt.event_rule===before.event_rule && receipt.portrait_rule===before.portrait_rule, gameplayRun:false }));
