// Reviewed schema delivery only. Never executes a gameplay RPC or a fixture.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve('@supabase/cli-windows-x64/package.json')), 'bin/supabase.exe');
const version = '20261022190000';
const migration = `supabase/migrations/${version}_add_direct_transfer_trade_offers.sql`;
const mode = process.argv[2];
assert(['--verify', '--apply-reviewed-fix'].includes(mode), 'Use --verify or --apply-reviewed-fix');
assert.equal(readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'ikagfuchasnsakpouosg', 'Unexpected linked project');
const call = (args, timeout = 15000) => execFileSync(binary, args, {encoding: 'utf8', timeout, maxBuffer: 40000});
const query = sql => {
  const raw = call(['db', 'query', '--linked', `begin read only; set local application_name='direct-transfer-trade-delivery-20261022'; set local statement_timeout='3s'; set local lock_timeout='500ms'; ${sql}; rollback;`, '--output', 'json']);
  return JSON.parse(raw.slice(raw.indexOf('{'))).rows[0];
};
const inspect = () => query(`select 1 as database_ok,
  exists(select 1 from supabase_migrations.schema_migrations where version='${version}') as recorded,
  to_regprocedure('public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)') is not null as installed,
  (select count(*)::int from pg_attribute where attrelid='public.direct_transfer_offers'::regclass
    and attname in ('offered_rider_id','offered_rider_salary_per_season','salary_before_team_discounts','offered_rider_salary_before_team_discounts')
    and attnum>0 and not attisdropped) as trade_columns,
  (select count(*)::int from pg_trigger where not tgisinternal and tgenabled<>'D'
    and tgname in ('guard_race_roster_transfer_ownership','guard_form_camp_transfer_ownership','guard_reconnaissance_transfer_ownership')) as commitment_guards,
  (select count(*)::int from pg_index i join pg_class c on c.oid=i.indexrelid
    where i.indrelid='public.direct_transfer_offers'::regclass and i.indisvalid
      and c.relname in ('direct_transfer_offers_pending_offered_rider_idx','direct_transfer_offers_pending_target_rider_idx')) as pending_indexes,
  has_function_privilege('service_role','public.submit_direct_transfer_offer(uuid,numeric)','execute') as service_cash_submit,
  case when to_regprocedure('public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)') is not null
    then has_function_privilege('authenticated','public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)','execute') else false end as player_can_submit,
  case when to_regprocedure('public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)') is not null
    then has_function_privilege('anon','public.submit_direct_transfer_trade_offer(uuid,numeric,uuid,text)','execute') else false end as anonymous_can_submit,
  case when to_regprocedure('private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)') is not null
    then md5(replace(pg_get_functiondef(to_regprocedure('private.submit_direct_transfer_offer_cash_20261022(uuid,numeric)')),
      'FUNCTION private.submit_direct_transfer_offer_cash_20261022(', 'FUNCTION public.submit_direct_transfer_offer('))
    else md5(pg_get_functiondef('public.submit_direct_transfer_offer(uuid,numeric)'::regprocedure)) end as cash_submit_hash,
  md5(pg_get_functiondef('public.get_team_transfer_reserved_budget(uuid,uuid,uuid)'::regprocedure)) as reservation_hash,
  case when to_regprocedure('private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)') is not null
    then md5(replace(pg_get_functiondef(to_regprocedure('private.respond_to_direct_transfer_offer_cash_20261022(uuid,boolean)')),
      'FUNCTION private.respond_to_direct_transfer_offer_cash_20261022(', 'FUNCTION public.respond_to_direct_transfer_offer('))
    else md5(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure)) end as cash_response_core_hash,
  md5(pg_get_functiondef('public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure)) as response_hash`);
const unchangedCash = state => state.cash_submit_hash === 'a89fd68e61df7d153c31537ebd6b35fa'
  && state.reservation_hash === 'b1a108384677454acf87b5c65aac4019'
  && !state.service_cash_submit
  && state.cash_response_core_hash === '915a479051739453000889726bef123d';
const installed = state => state.database_ok === 1 && state.installed && state.trade_columns === 4
  && state.commitment_guards === 3 && state.pending_indexes === 2
  && state.player_can_submit && !state.anonymous_can_submit && unchangedCash(state)
  && state.response_hash !== '915a479051739453000889726bef123d';
const before = inspect();
if (mode === '--verify') {
  console.log(JSON.stringify(before));
} else {
  if (!before.installed) {
    assert(!before.recorded && before.trade_columns === 0 && unchangedCash(before)
      && before.response_hash === '915a479051739453000889726bef123d', 'Schema drift: review before applying');
    const source = readFileSync(migration, 'utf8');
    assert(/set local lock_timeout\s*=\s*'[^']+'/iu.test(source)
      && /set local statement_timeout\s*=\s*'[^']+'/iu.test(source), 'Migration must bound lock and statement waits');
    call(['db', 'query', '--linked', '--file', path.resolve(migration), '--output', 'json'], 25000);
  }
  const after = inspect();
  assert(installed(after), `Post-install integrity mismatch: ${JSON.stringify(after)}`);
  if (!after.recorded) call(['migration', 'repair', version, '--status', 'applied', '--linked', '--yes']);
  const final = inspect();
  assert(installed(final) && final.recorded, 'Final schema/history verification failed');
  console.log(JSON.stringify({version, ...final, productionFixtures: false, historicalOffersRewritten: false}));
}
