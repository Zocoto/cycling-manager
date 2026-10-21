// All fixtures live ONLY inside a disposable in-memory PostgreSQL database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

if (!process.env.FINANCE_SQL_TEST_MODULE) throw Error('An isolated PGlite module is required');
const { PGlite } = await import(pathToFileURL(process.env.FINANCE_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const read = path => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20261021121000_align_df_purchase_projection.sql');
const extract = (source, name) => {
  const match = new RegExp(`create(?: or replace)? function ${name.replaceAll('.', '\\.')}\\(`).exec(source);
  assert.ok(match, name);
  const end = source.indexOf('$$;', source.indexOf('as $$', match.index));
  assert.ok(end > match.index, name);
  return source.slice(match.index, end + 3);
};
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];
const number = async (sql, params = []) => Number(await scalar(sql, params));
const purchase = () => db.query('select * from public.get_current_team_purchase_financial_risk(600)');
const definition = async signature => (await scalar('select pg_get_functiondef($1::regprocedure)', [signature])).replaceAll('\r', '');
const purchaseSignature = 'public.get_current_team_purchase_financial_risk(numeric)';
const restockSignature = 'private.restock_fan_club_shop(uuid,integer)';

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user', true), '')::uuid$$;
    create table sporting_directors(id uuid, auth_user_id uuid, status text);
    create table team_manager_assignments(sporting_director_id uuid, team_id uuid, role text, status text);
    create table seasons(id uuid, status text, game_year integer, current_day_number integer);
    create table season_days(id uuid, season_id uuid, day_number integer);
    create table team_seasons(id uuid, team_id uuid, season_id uuid, status text, cash_balance numeric, opening_cash_balance numeric, currency text);
    create table team_finance_transactions(team_season_id uuid, season_day_id uuid, day_number integer, amount numeric, category text, description text, status text, source_reference text, posted_at timestamptz);
    create table fan_club_shop_restock_settings(team_id uuid, enabled boolean, allow_negative_projection boolean, minimum_stocks jsonb, last_restock_game_day integer);
    create table team_infrastructures(team_id uuid, infrastructure_code text, level integer);
    create table fan_club_shop_inventory(team_id uuid, product_code text, quantity integer, average_unit_cost numeric, sale_price numeric, collector_season_id uuid, updated_at timestamptz, primary key(team_id, product_code));
    create table fan_club_wholesale_prices(season_id uuid, day_number integer, product_code text, unit_cost numeric);
    create table private.test_director_projection(team_season_id uuid, amount numeric);
    create function private.get_team_financial_director_projection(p_team_season_id uuid) returns table(amount numeric)
      language sql stable as $$select p.amount from private.test_director_projection p where p.team_season_id = p_team_season_id$$;
    create function public.get_fan_club_shop_product_config(text)
      returns table(required_level integer, suggested_price numeric, is_collector boolean, wholesale_product_code text)
      language sql as $$select 1, 69::numeric, false, 'team-jersey'::text$$;
    create function public.team_won_fan_club_collector_gt(uuid, uuid, text) returns boolean language sql as $$select false$$;
    create function public.get_team_club_shop_wholesale_cost_multiplier(uuid) returns numeric language sql as $$select 1::numeric$$;
    create function public.ensure_fan_club_wholesale_prices(uuid, integer) returns void language plpgsql as $$begin end$$;
    create function public.expire_fan_club_collector_stock(uuid, uuid) returns void language plpgsql as $$begin end$$;
    insert into sporting_directors values('${id(1)}', '${id(2)}', 'active');
    insert into team_manager_assignments values('${id(1)}', '${id(3)}', 'general_manager', 'active');
    insert into seasons values('${id(4)}', 'active', 4, 13);
    insert into season_days values('${id(5)}', '${id(4)}', 13);
    insert into team_seasons values('${id(6)}', '${id(3)}', '${id(4)}', 'active', 1000, 1000, 'EUR');
    insert into team_infrastructures values('${id(3)}', 'club_shop', 5);
    insert into fan_club_wholesale_prices values('${id(4)}', 13, 'team-jersey', 10);
    select set_config('test.user', '${id(2)}', false);
  `);
  let purchaseFunction = extract(read('supabase/migrations/20260921113000_add_projected_deficit_purchase_warning.sql'), 'public.get_current_team_purchase_financial_risk');
  let restockFunction = extract(read('supabase/migrations/20261012120000_add_fan_club_auto_restock.sql'), 'private.restock_fan_club_shop');
  // Optional captured read-only production definitions detect deployment drift;
  // they are still executed ONLY in this isolated in-memory database.
  if (process.env.FINANCE_PROJECTION_FUNCTION_SNAPSHOT) {
    const snapshot = JSON.parse(read(process.env.FINANCE_PROJECTION_FUNCTION_SNAPSHOT).replace(/^\uFEFF/u, ''));
    const rows = Array.isArray(snapshot) ? snapshot : snapshot.rows;
    purchaseFunction = rows.find(row => row.proname === 'get_current_team_purchase_financial_risk' || row.signature?.includes('get_current_team_purchase_financial_risk(')).definition;
    restockFunction = rows.find(row => row.proname === 'restock_fan_club_shop' || row.signature?.includes('restock_fan_club_shop(')).definition;
  }
  await db.exec(purchaseFunction);
  await db.exec(restockFunction);
  await db.exec(`
    revoke all on function public.get_current_team_purchase_financial_risk(numeric) from public, anon;
    grant execute on function public.get_current_team_purchase_financial_risk(numeric) to authenticated, service_role;
    revoke all on function private.restock_fan_club_shop(uuid, integer) from public, anon, authenticated;
    grant execute on function private.restock_fan_club_shop(uuid, integer) to service_role;
  `);
  const beforePurchase = await definition(purchaseSignature);
  const beforeRestock = await definition(restockSignature);
  const properties = () => db.query(`select oid::regprocedure::text signature, proowner, prosecdef, proconfig, proacl::text from pg_proc where oid in($1::regprocedure, $2::regprocedure) order by signature`, [purchaseSignature, restockSignature]);
  const beforeProperties = (await properties()).rows;
  await db.exec(migration);
  check((await properties()).rows, beforeProperties);
  const afterPurchase = await definition(purchaseSignature);
  const afterRestock = await definition(restockSignature);
  // The only semantic changes are two extra SELECTs into the forecast variable.
  check(afterPurchase.replace(/\n  -- financial_director_purchase_projection_v1:[\s\S]*? as projection;\n/u, ''), beforePurchase);
  check(afterRestock.replace(/\n  -- financial_director_restock_projection_v1:[\s\S]*? as projection;/u, ''), beforeRestock);
  await db.exec(migration);
  check(await definition(purchaseSignature), afterPurchase);
  check(await definition(restockSignature), afterRestock);

  await db.exec(`
    insert into team_finance_transactions(team_season_id, day_number, amount, status) values
      ('${id(6)}', 14, -900, 'pending'), ('${id(6)}', 13, 100, 'posted'),
      ('${id(6)}', 14, -99999, 'cancelled');
    insert into private.test_director_projection values('${id(6)}', 450), ('${id(6)}', 200), ('${id(999)}', 999999);
  `);
  let risk = (await purchase()).rows[0];
  check(Number(risk.current_projected_balance), 850);
  check(Number(risk.projected_balance_after_purchase), 250);
  check(risk.requires_confirmation, false);
  check(risk.was_already_negative, false);
  check(await number('select cash_balance from team_seasons'), 1000);
  check(await number('select count(*) from team_finance_transactions'), 3);
  await db.exec(`delete from private.test_director_projection where team_season_id='${id(6)}'`);
  risk = (await purchase()).rows[0];
  check(Number(risk.current_projected_balance), 200);
  check(risk.requires_confirmation, true);
  // A posted director receipt replaces its virtual forecast, never adds twice.
  await db.exec(`insert into private.test_director_projection values('${id(6)}', 650)`);
  const beforePosting = Number((await purchase()).rows[0].current_projected_balance);
  await db.exec(`delete from private.test_director_projection where team_season_id='${id(6)}'; insert into team_finance_transactions(team_season_id, day_number, amount, status) values('${id(6)}', 13, 650, 'posted')`);
  check(Number((await purchase()).rows[0].current_projected_balance), beforePosting);
  for (const amount of [null, 0, -1, 1000000001, 'NaN', 'Infinity', '-Infinity']) {
    await assert.rejects(db.query('select * from public.get_current_team_purchase_financial_risk($1::numeric)', [amount]), /invalide/u); checks++;
  }
  await db.exec(`select set_config('test.user', '', false)`);
  await assert.rejects(purchase(), /Authentification/u); checks++;
  await db.exec(`select set_config('test.user', '${id(2)}', false)`);

  const resetShop = async (cash, ledgerProjection, forecast = 0, allowNegative = false) => {
    await db.exec(`delete from team_finance_transactions; delete from private.test_director_projection;
      delete from fan_club_shop_inventory; delete from fan_club_shop_restock_settings;`);
    await db.query('update team_seasons set cash_balance=$1, opening_cash_balance=$2', [cash, ledgerProjection]);
    await db.query(`insert into private.test_director_projection values('${id(6)}', $1)`, [forecast]);
    await db.query(`insert into fan_club_shop_restock_settings values('${id(3)}', true, $1, '{"team-jersey":20}', null)`, [allowNegative]);
  };
  const restock = () => number(`select private.restock_fan_club_shop('${id(6)}', 13)`);
  await resetShop(1000, -50, 250);
  check(await restock(), 20);
  check(await number('select cash_balance from team_seasons'), 800);
  check(await number('select sum(amount) from team_finance_transactions'), -200);
  check(await restock(), 0); // One refill per day remains unchanged.
  await resetShop(35, -50, 1000);
  check(await restock(), 3); // Forecast is never available cash.
  check(await number('select cash_balance from team_seasons'), 5);
  await resetShop(0, -50, 1000);
  check(await restock(), 0);
  await resetShop(-1, -50, 1000, true);
  check(await restock(), 0);
  await resetShop(1000, -50, 0);
  check(await restock(), 0);
  await resetShop(1000, -50, 0, true);
  check(await restock(), 20); // Explicit negative-projection override is unchanged.
  await resetShop(1000, 1000, 1000);
  await db.exec(`insert into team_finance_transactions(team_season_id, day_number, amount, status) values('${id(6)}', 13, -990, 'pending')`);
  check(await restock(), 1); // Due charges still cap today's available cash.
  check(await number('select cash_balance from team_seasons'), 990);
  await resetShop(1000, 1000, 1000000);
  await db.exec(`insert into team_finance_transactions(team_season_id, day_number, amount, status) values('${id(6)}', 13, -1001, 'pending')`);
  check(await restock(), 0);
  check(await scalar(`select has_function_privilege('authenticated', '${purchaseSignature}', 'execute')`), true);
  check(await scalar(`select has_function_privilege('anon', '${purchaseSignature}', 'execute')`), false);
  check(await scalar(`select has_function_privilege('authenticated', '${restockSignature}', 'execute')`), false);
  check(await scalar(`select has_function_privilege('service_role', '${restockSignature}', 'execute')`), true);

  // An unexpected caller body aborts the whole migration, not just one patch.
  await db.exec(beforePurchase);
  await db.exec(beforeRestock.replace('if v_cash<=0 or', '-- deliberate isolated drift\n  if v_cash<=0 or'));
  await assert.rejects(db.exec(migration), /Unexpected financial projection body/u); checks++;
  await db.exec('rollback');
  check(await definition(purchaseSignature), beforePurchase);
  console.log(JSON.stringify({ isolatedPostgres: true, checks, productionFixtures: false, cashRulesUnchanged: true }));
} finally {
  await db.close();
}
