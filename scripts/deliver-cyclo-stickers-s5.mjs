// Exact reviewed infrastructure/cadence only. No edition install, player action,
// attendance, fixture, booster grant, or ranking rebuild is executed here.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--inspect', '--apply-reviewed', '--verify'].includes(mode)
  || readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Exact project and delivery mode required.');
const migrations = [
  ['20261105140000', 'prepare_persistent_cyclo_stickers', '2539ceeca23c9dbdc6f47df5311c68e4a1651effa21d2cda8c2bd05bea742d10'],
  ['20261105141000', 'three_day_login_sticker_boosters', 'cb46f3e35b75bc990b3484cc5c81c753d92bb571d1ae088ff7b73db081928ce1'],
];
const folder = 'artifacts/album-finalization-20261105';
mkdirSync(folder, { recursive: true });
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
function call(args) {
  try { return execFileSync(binary, args, { encoding: 'utf8', timeout: 25000, maxBuffer: 350000 }); }
  catch (error) { throw Error(error.stderr?.slice(0, 1800) ?? error.message); }
}
function query(sql) {
  const raw = call(['db', 'query', '--linked', sql, '--output', 'json']);
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
}
const read = sql => query(`begin read only;set local statement_timeout='3s';set local lock_timeout='500ms';set local application_name='cyclo-stickers-s5-delivery';${sql};commit;`);
const functions = () => read(`select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proconfig,p.prosecdef
  from pg_proc p where p.oid=any(array['public.get_current_daily_reward_overview()'::regprocedure,
  'public.record_current_sporting_director_attendance()'::regprocedure,
  'private.record_weekly_login_booster_connection(uuid,uuid,date)'::regprocedure]) order by signature`);
const receipt = version => read(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name;
function installation() {
  return read(`select to_regclass('public.cyclo_stickers_editions') is not null persistent,
    to_regclass('public.cyclo_stickers_edition_boosters') is not null gala_inventory,
    position('three_day_stickers_v1' in pg_get_functiondef('private.record_weekly_login_booster_connection(uuid,uuid,date)'::regprocedure))>0 three_day,
    (select game_year from public.seasons where status='active' limit 1) game_year`)[0];
}
function verify() {
  const state = installation();
  assert.ok(state.persistent && state.gala_inventory && state.three_day);
  const security = read(`select
    not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('cyclo_stickers_editions','cyclo_stickers_cards','cyclo_stickers_collections',
      'cyclo_stickers_card_inventory','cyclo_stickers_openings','cyclo_stickers_trade_offers','cyclo_stickers_achievement_claims','cyclo_stickers_edition_boosters') and not c.relrowsecurity) all_rls,
    has_function_privilege('authenticated','public.install_cyclo_stickers_edition(text,jsonb,text,jsonb)','execute') player_install,
    has_function_privilege('authenticated','public.grant_cyclo_stickers_gala_boosters(text,uuid[],text)','execute') player_grant,
    has_function_privilege('anon','public.open_current_cyclo_stickers_booster(text,text,uuid)','execute') anon_open,
    has_function_privilege('authenticated','public.open_current_cyclo_stickers_booster(text,text,uuid)','execute') owner_open,
    has_table_privilege('authenticated','public.cyclo_stickers_card_inventory','update') player_write,
    has_table_privilege('authenticated','public.cyclo_stickers_booster_inventory','select') stock_read,
    (select reloptions @> array['security_invoker=true'] from pg_class where oid='public.cyclo_stickers_booster_inventory'::regclass) stock_rls,
    has_function_privilege('authenticated','private.record_weekly_login_booster_connection(uuid,uuid,date)','execute') player_set_streak`)[0];
  assert.deepEqual(security, {all_rls:true,player_install:false,player_grant:false,anon_open:false,owner_open:true,player_write:false,stock_read:true,stock_rls:true,player_set_streak:false});
  // This release prepares infrastructure; no source catalogue is published or seeded.
  const counts = read(`select (select count(*)::int from public.cyclo_stickers_editions) editions,
    (select count(*)::int from public.cyclo_stickers_cards) cards,
    (select count(*)::int from public.cyclo_stickers_openings) openings,
    (select count(*)::int from public.cyclo_stickers_achievement_claims) claims,
    (select count(*)::int from public.cyclo_stickers_edition_boosters) gala_boosters`)[0];
  assert.deepEqual(counts,{editions:0,cards:0,openings:0,claims:0,gala_boosters:0});
  return {...state,security,counts};
}
for (const [version,name,expected] of migrations) {
  const file = `supabase/migrations/${version}_${name}.sql`;
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,`Review hash changed: ${file}`);
}
const before = functions();
assert.equal(before.length,3);
const initial = installation();
if (mode === '--inspect') {
  console.log(JSON.stringify({databaseOk:true,installation:initial,receipts:migrations.map(([version])=>({version,name:receipt(version)??null}))}));
} else {
  if (mode === '--apply-reviewed') {
    assert.equal(initial.game_year,4,'Review again after a season rollover');
    for (const [version,name] of migrations) {
      const existing = receipt(version);
      if (existing) { assert.equal(existing,name,'Migration version collision'); continue; }
      const file = `supabase/migrations/${version}_${name}.sql`;
      // No rehearsal or fixture is ever combined with a production migration.
      call(['db','query','--linked','--file',file,'--output','json']);
      const sql = readFileSync(file,'utf8');
      const recordFile = `${folder}/${version}-receipt.sql`;
      writeFileSync(recordFile,`begin;set local statement_timeout='3s';set local lock_timeout='500ms';
        insert into supabase_migrations.schema_migrations(version,name,statements)
        values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`);
      call(['db','query','--linked','--file',recordFile,'--output','json']);
    }
  }
  const after = functions();
  for (const prior of before) {
    const current = after.find(row=>row.signature===prior.signature);
    assert.ok(current);
    assert.equal(current.acl,prior.acl); assert.deepEqual(current.proconfig,prior.proconfig); assert.equal(current.prosecdef,prior.prosecdef);
    if (!prior.signature.startsWith('private.')) assert.equal(current.hash,prior.hash);
  }
  for (const [version,name] of migrations) assert.equal(receipt(version),name);
  const result = {databaseOk:true,installation:verify(),existingAttendanceAndGiftFunctionsPreserved:true,playerActionsRun:false};
  writeFileSync(`${folder}/delivery-${mode.slice(2)}.json`,`${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result));
}
