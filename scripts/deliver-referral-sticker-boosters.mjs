// Exact reviewed DDL only. No player fixtures, test accounts or gameplay actions.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const mode = process.argv[2];
if (process.argv.length !== 3 || !['--preflight','--apply-reviewed-migration','--verify'].includes(mode) ||
  readFileSync('supabase/.temp/project-ref','utf8').trim() !== 'ikagfuchasnsakpouosg') throw Error('Exact delivery mode and linked project required.');
const require = createRequire(import.meta.url);
const bin = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')),'bin/supabase.exe');
const version='20261027180000', name='add_s5_referral_sticker_boosters';
const sql = readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const query = text => {
  const raw=execFileSync(bin,['db','query','--linked',text,'--output','json'],{encoding:'utf8',timeout:20000,maxBuffer:150000});
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows;
};
const ro = text => query(`begin read only;set local application_name='referral-sticker-boosters-delivery';set local statement_timeout='5s';set local lock_timeout='500ms';${text};commit;`);
const preserved = () => ro(`select
  md5(pg_get_functiondef('private.sync_referral_rewards(uuid)'::regprocedure)) rewards,
  md5(pg_get_functiondef('private.qualify_referral_after_email_confirmation()'::regprocedure)) confirmation,
  md5(pg_get_functiondef('private.assign_referral_from_auth_user(uuid)'::regprocedure)) assignment,
  md5(pg_get_functiondef('public.get_current_referral_overview()'::regprocedure)) overview`)[0];
const receipt = ro(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name;
if(receipt && receipt!==name) throw Error('Migration version collision');
const before=preserved();
const seasons=ro('select game_year,status,starts_on,ends_on from public.seasons where game_year in(4,5) order by game_year limit 2');
assert.equal(seasons.find(s=>s.game_year===4)?.status,'active');
assert.equal(seasons.find(s=>s.game_year===5)?.status,'planned');
if(mode==='--preflight') {
  console.log(JSON.stringify({databaseRead:'ok',alreadyInstalled:!!receipt,seasons,existingFunctions:before}));
} else {
  if(mode==='--apply-reviewed-migration'&&!receipt) {
    // Record the exact migration in the same transaction as the empty stock
    // and trigger, so an interrupted retry cannot apply the DDL twice.
    const receiptSql=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']::text[]);commit;`;
    const deliveryFile = '.codex-tools/referral-sticker-boosters-reviewed-delivery.sql';
    writeFileSync(deliveryFile, sql.replace(/commit;\s*$/i,()=>receiptSql));
    execFileSync(bin,['db','query','--linked','--file',deliveryFile,'--output','json'],
      {encoding:'utf8',timeout:20000,maxBuffer:150000});
  }
  assert.equal(ro(`select name from supabase_migrations.schema_migrations where version='${version}' limit 1`)[0]?.name,name);
  assert.deepEqual(preserved(),before,'Existing referral functions changed');
  const installed=ro(`select
    (select relrowsecurity from pg_class where oid='public.cyclo_sticker_boosters'::regclass) rls,
    has_table_privilege('authenticated','public.cyclo_sticker_boosters','select') player_read,
    has_table_privilege('authenticated','public.cyclo_sticker_boosters','insert') player_mint,
    has_table_privilege('authenticated','public.cyclo_sticker_boosters','update') player_update,
    (select count(*)::int from public.cyclo_sticker_boosters) stock_rows,
    (select count(*)::int from pg_trigger where tgrelid='public.sporting_director_referrals'::regclass and tgname='zz_grant_referral_sticker_boosters' and tgenabled='O') active_triggers,
    (select count(*)::int from pg_policies where schemaname='public' and tablename='cyclo_sticker_boosters') policies`)[0];
  assert.deepEqual(installed,{rls:true,player_read:true,player_mint:false,player_update:false,stock_rows:0,active_triggers:1,policies:1});
  const proof={databaseRead:'ok',migrationRecorded:true,existingReferralFunctionsPreserved:true,season4StockEmpty:true,installed,productionFixturesRun:false};
  writeFileSync('.codex-tools/referral-sticker-boosters-production-proof.json',JSON.stringify({...proof,functions:before},null,2));
  console.log(JSON.stringify(proof));
}
