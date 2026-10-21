// Disposable PostgreSQL/WASM only. No URL, credentials or production connection.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if (!process.env.FINANCE_SQL_TEST_MODULE) throw Error('An isolated PGlite module is required');
const {PGlite} = await import(pathToFileURL(process.env.FINANCE_SQL_TEST_MODULE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
let checks = 0;
const check = (actual, expected) => {assert.equal(actual, expected); checks++;};
const projection = () => db.query('select * from private.get_team_financial_director_projection($1)', [id(6)]).then(r => r.rows);
const summary = async effect => Number(await scalar(`select coalesce(sum(amount),0) from private.get_team_financial_director_projection($1) where $2::text is null or effect=$2`, [id(6), effect ?? null]));
const salaryRef = (kind, contract, installment = 2, season = 3) => `${kind}:${id(contract)}:${id(season)}:${installment}`;
const post = (n, category, source, amount = 10000, status = 'pending', day = 14, teamSeason = 6) => db.query(`
  insert into team_finance_transactions(id,team_season_id,season_day_id,day_number,amount,category,status,description,source_reference)
  values($1,$2,$3,$4,$5,$6,$7,'Fixture, isolated only',$8)`, [id(n), id(teamSeason), id(100 + day), day, amount, category, status, source]);
const receipt = (n, ref, status) => post(n, 'other', ref, 1, status);
const resetLedger = () => db.exec('delete from team_finance_transactions');
const snapshot = () => scalar(`select jsonb_build_object('ledger',(select coalesce(jsonb_agg(to_jsonb(tx) order by id),'[]') from team_finance_transactions tx),'teams',(select jsonb_agg(to_jsonb(ts) order by id) from team_seasons ts))::text`);
try {
  await db.exec(`
    create schema private; create schema auth;
    create role anon; create role authenticated; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.auth_uid',true),'')::uuid $$;
    create table sporting_directors(id uuid primary key,auth_user_id uuid,status text);
    create table team_manager_assignments(sporting_director_id uuid,team_id uuid,role text,status text);
    create table seasons(id uuid primary key,status text,current_day_number integer);
    create table season_days(id uuid primary key,season_id uuid,day_number integer,calendar_date date);
    create table team_seasons(id uuid primary key,team_id uuid,season_id uuid,status text default 'active',registration_country_id uuid,cash_balance numeric default 1000);
    create table staff_members(id uuid primary key,role text,level integer,country_id uuid);
    create table staff_contracts(id uuid primary key,staff_member_id uuid,team_id uuid,status text default 'active',signed_at timestamptz default now());
    create table rider_contracts(id uuid primary key,team_id uuid);
    create table staff_member_talents(staff_member_id uuid,talent_code text,created_at timestamptz default now(),unique(staff_member_id,talent_code));
    create table team_sponsor_contracts(id uuid primary key,team_id uuid,role text);
    create table team_finance_transactions(id uuid primary key default gen_random_uuid(),team_season_id uuid,season_day_id uuid,day_number integer,amount numeric check(amount<>0),category text,status text,description text,source_reference text,posted_at timestamptz,unique(team_season_id,source_reference));
    create index team_finance_transactions_team_day_idx on team_finance_transactions(team_season_id,day_number,status);
    create index staff_contracts_team_status_idx on staff_contracts(team_id,status,signed_at);
    insert into seasons values('${id(3)}','active',13),('${id(4)}','completed',28);
    insert into season_days select ('00000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'${id(3)}',n,(now() at time zone 'Europe/Paris')::date+n-13 from generate_series(1,28) n;
    insert into season_days values('${id(500)}','${id(4)}',14,current_date);
    insert into team_seasons(id,team_id,season_id,registration_country_id) values
      ('${id(6)}','${id(7)}','${id(3)}','${id(1)}'),('${id(60)}','${id(70)}','${id(3)}','${id(1)}');
    insert into staff_members values('${id(10)}','financial_director',2,'${id(2)}'),('${id(11)}','trainer',5,'${id(1)}'),('${id(61)}','trainer',1,'${id(1)}');
    insert into staff_contracts(id,staff_member_id,team_id,signed_at) values
      ('${id(12)}','${id(10)}','${id(7)}',now()-interval '20 days'),('${id(13)}','${id(11)}','${id(7)}',now()-interval '20 days'),('${id(62)}','${id(61)}','${id(70)}',now()-interval '20 days');
    insert into rider_contracts values('${id(14)}','${id(7)}'),('${id(64)}','${id(70)}');
    insert into staff_member_talents values('${id(10)}','finance_daily_income',now()-interval '20 days');
    insert into team_sponsor_contracts values('${id(8)}','${id(7)}','principal'),('${id(9)}','${id(7)}','secondary'),('${id(65)}','${id(70)}','principal');
    insert into sporting_directors values('${id(20)}','${id(21)}','active'),('${id(22)}','${id(23)}','active');
    insert into team_manager_assignments values('${id(20)}','${id(7)}','general_manager','active'),('${id(22)}','${id(70)}','general_manager','active');
  `);
  const migration = readFileSync('supabase/migrations/20261021120000_project_financial_director_income.sql', 'utf8');
  await db.exec(migration);
  check(await summary('daily_income'), 6750); // Fra: 450 × 15 future days.
  for (const [index, day] of [14, 21, 28].entries()) {
    await post(200 + index, 'staff_salary', salaryRef('staff-contract', 13, index + 2), -322000, 'pending', day);
    await post(210 + index, 'staff_salary', salaryRef('staff-contract', 12, index + 2), -6750, 'pending', day);
  }
  const before = await snapshot();
  check(await summary('staff_salary'), 38640); // 966,000 × 4%, own salary excluded.
  check(await summary(), 45390);
  check((await projection()).length, 18);
  check(await snapshot(), before);
  const rows = await projection();
  check(rows.find(row => row.effect === 'staff_salary').source_reference, `financial-director:salary-savings:${id(200)}`);
  check(Number(rows.find(row => row.effect === 'staff_salary').base_amount), 322000);
  check(Number(rows.find(row => row.effect === 'staff_salary').bonus_percentage), 4);
  check(rows.find(row => row.effect === 'daily_income').base_amount, null);
  check(rows.find(row => row.effect === 'daily_income').bonus_percentage, null);

  // All canonical receipt states suppress the virtual duplicate, including
  // cancellation: forecasts must never resurrect an explicitly cancelled gain.
  for (const [index, status] of ['posted', 'pending', 'cancelled'].entries()) {
    await receipt(230 + index, `financial-director:salary-savings:${id(200 + index)}`, status);
    await receipt(240 + index, `financial-director:daily:${id(114 + index)}`, status);
  }
  check(await summary('staff_salary'), 0);
  check(await summary('daily_income'), 5400);
  await resetLedger();

  // Rates scale by stars and national affinity, independently of talent type.
  for (let level = 1; level <= 5; level++) {
    await db.query('update staff_members set level=$1,country_id=$2 where id=$3', [level, id(1), id(10)]);
    check(await summary('daily_income'), [220, 495, 935, 1760, 3190][level - 1] * 15);
  }
  await db.exec(`update staff_members set level=2,country_id='${id(2)}' where id='${id(10)}';
    insert into staff_member_talents select '${id(10)}',code,now()-interval '20 days' from unnest(array['finance_rider_salary','finance_main_sponsor','finance_secondary_sponsor','finance_race_prizes']) code;`);
  await post(300, 'rider_salary', salaryRef('rider-salary', 14), -10000);
  await post(301, 'sponsor', `sponsor:${id(8)}:${id(3)}:2`);
  await post(302, 'sponsor', 'secondary-sponsor-objective:known-pending');
  await post(303, 'race_prize', 'race:known-pending');
  check(await summary('rider_salary'), 400);
  check(await summary('main_sponsor'), 100);
  check(await summary('secondary_sponsor'), 200);
  check(await summary('race_prize'), 400);
  await db.exec(`update staff_members set country_id='${id(1)}' where id='${id(10)}'`);
  check(await summary('rider_salary'), 440);
  check(await summary('main_sponsor'), 110);
  check(await summary('secondary_sponsor'), 220);
  check(await summary('race_prize'), 440);
  for (const [index, status] of ['posted', 'pending', 'cancelled'].entries()) {
    await receipt(310 + index, `financial-director:bonus:${id(301 + index)}`, status);
  }
  check(await summary('main_sponsor'), 0);
  check(await summary('secondary_sponsor'), 0);
  check(await summary('race_prize'), 0);
  await resetLedger();

  // Wrong domain, team, season, installment, calendar day or status never
  // creates a saving; malformed UUIDs are harmless strings, not casts.
  const exclusions = [
    ['staff_salary', salaryRef('staff-contract', 12), -10000],
    ['staff_salary', salaryRef('staff-contract', 62), -10000],
    ['rider_salary', salaryRef('rider-salary', 64), -10000],
    ['rider_salary', salaryRef('rider-salary', 14, 2, 4), -10000],
    ['staff_salary', salaryRef('staff-contract', 13, 1), -10000],
    ['staff_salary', `staff-contract:------------------------------------:${id(3)}:2`, -10000],
    ['staff_salary', `staff-signing:${id(13)}`, -10000],
    ['staff_salary', `staff-dismissal:${id(13)}`, -10000],
    ['rider_salary', `rider-dismissal:${id(14)}`, -10000],
    ['staff_salary', salaryRef('staff-contract', 13), 10000],
    ['sponsor', `sponsor:${id(9)}:not-principal`, 10000],
    ['sponsor', `sponsor:${id(65)}:another-team`, 10000],
    ['sponsor', 'sponsor:------------------------------------:bad-uuid', 10000],
    ['sponsor', 'sponsor-main-objective:unsupported', 10000],
    ['race_prize', 'race:refund', 10000],
    ['race_prize', 'race:repair', 10000],
    ['race_prize', 'race:CORRECTION', 10000],
    ['race_prize', 'race:replay', 10000],
    ['race_prize', 'race:void', 10000],
    ['race_prize', 'race:negative', -10000],
    ['transfer', 'transfer:no-affix', 10000],
  ];
  for (const [index, [category, source, amount]] of exclusions.entries()) await post(400 + index, category, source, amount);
  await post(440, 'race_prize', 'race:already-posted', 10000, 'posted');
  await post(441, 'race_prize', 'race:cancelled', 10000, 'cancelled');
  await post(442, 'race_prize', 'race:overdue', 10000, 'pending', 12);
  await post(443, 'race_prize', 'race:foreign-team', 10000, 'pending', 14, 60);
  await post(444, 'race_prize', 'race:wrong-season');
  await db.query('update team_finance_transactions set season_day_id=$1 where id=$2', [id(500), id(444)]);
  check((await projection()).filter(row => row.effect !== 'daily_income').length, 0);
  await resetLedger();

  // Known pending receipts due today are included, but today's fixed income
  // is settlement's responsibility, not invented/duplicated by the forecast.
  await db.exec(`update seasons set current_day_number=14 where id='${id(3)}'`);
  await post(450, 'staff_salary', salaryRef('staff-contract', 13), -10000);
  check(await summary('staff_salary'), 440);
  check((await projection()).filter(row => row.effect === 'daily_income').length, 14);
  await db.exec(`update staff_member_talents set created_at=now()+interval '1 day' where talent_code='finance_daily_income'`);
  check(await summary('staff_salary'), 0);
  await db.exec(`update staff_member_talents set created_at=now()-interval '20 days' where talent_code='finance_daily_income'`);
  await db.query('update team_finance_transactions set posted_at=now()-interval \'30 days\' where id=$1', [id(450)]);
  check(await summary('staff_salary'), 0);
  await db.query('update team_finance_transactions set posted_at=null where id=$1', [id(450)]);
  await db.exec(`update staff_contracts set signed_at=now()+interval '1 day' where id='${id(12)}'`);
  check((await projection()).length, 0);
  await db.exec(`update staff_contracts set signed_at=now()-interval '20 days',status='terminated' where id='${id(12)}'`);
  check((await projection()).length, 0);
  await db.exec(`update staff_contracts set status='active' where id='${id(12)}';update team_seasons set status='inactive' where id='${id(6)}'`);
  check((await projection()).length, 0);
  await db.exec(`update team_seasons set status='active' where id='${id(6)}';update seasons set status='completed' where id='${id(3)}'`);
  check((await projection()).length, 0);
  await db.exec(`update seasons set status='active' where id='${id(3)}'`);

  // Public RPC authentication and ownership: no team id supplied by a caller.
  await assert.rejects(db.query('select * from get_current_team_financial_director_projection()'), /Authentification requise/); checks++;
  await db.query(`select set_config('test.auth_uid',$1,false)`, [id(21)]);
  check((await db.query('select * from get_current_team_financial_director_projection()')).rows.length, (await projection()).length);
  await db.query(`select set_config('test.auth_uid',$1,false)`, [id(23)]);
  check((await db.query('select * from get_current_team_financial_director_projection()')).rows.length, 0);
  await db.query(`select set_config('test.auth_uid',$1,false)`, [id(21)]);
  for (const sql of [
    `update sporting_directors set status='inactive' where id='${id(20)}'`,
    `update sporting_directors set status='active' where id='${id(20)}';update team_manager_assignments set role='assistant' where sporting_director_id='${id(20)}'`,
    `update team_manager_assignments set role='general_manager',status='inactive' where sporting_director_id='${id(20)}'`,
  ]) {
    await db.exec(sql);
    await assert.rejects(db.query('select * from get_current_team_financial_director_projection()'), /Aucune équipe active/); checks++;
  }
  check(await scalar(`select has_function_privilege('anon','public.get_current_team_financial_director_projection()','execute')`), false);
  check(await scalar(`select has_function_privilege('authenticated','public.get_current_team_financial_director_projection()','execute')`), true);
  check(await scalar(`select has_function_privilege('authenticated','private.get_team_financial_director_projection(uuid)','execute')`), false);
  check(await scalar(`select has_function_privilege('service_role','private.get_team_financial_director_projection(uuid)','execute')`), false);
  check(await scalar(`select bool_and(provolatile='s' and prosecdef and 'search_path=""'=any(proconfig)) from pg_proc where oid in('private.get_team_financial_director_projection(uuid)'::regprocedure,'public.get_current_team_financial_director_projection()'::regprocedure)`), true);

  // Execute the *actual* production settlement functions/triggers, copied
  // verbatim out of their reviewed migrations, in this disposable database.
  // For all star levels and both affinity cases, projected individual receipts
  // must match what those existing payment paths eventually award.
  const functionFrom = (file, name) => {
    const sql = readFileSync(file, 'utf8');
    const start = sql.search(new RegExp(`create (?:or replace )?function ${name.replaceAll('.', '\\.')}\\(`));
    if (start < 0) throw Error(`Missing settlement function ${name}`);
    return sql.slice(start, sql.indexOf('$$;', start) + 3);
  };
  await db.exec(`create table private.financial_director_salary_savings(
    source_transaction_id uuid primary key references team_finance_transactions(id) on delete cascade,
    discount_percentage numeric, created_at timestamptz default now());`);
  await db.exec(functionFrom('supabase/migrations/20261016120000_add_financial_director.sql', 'private.credit_financial_director_transaction_bonus'));
  await db.exec(functionFrom('supabase/migrations/20261020100000_financial_director_base_income_and_salary_savings.sql', 'private.credit_financial_director_salary_savings'));
  await db.exec(functionFrom('supabase/migrations/20261020100000_financial_director_base_income_and_salary_savings.sql', 'public.settle_due_financial_director_income'));
  await db.exec(`create trigger financial_director_transaction_bonus after insert or update of status,amount
    on team_finance_transactions for each row when(new.category in('race_prize','sponsor'))
    execute function private.credit_financial_director_transaction_bonus();
    create trigger financial_director_salary_savings after insert or update of status,amount
    on team_finance_transactions for each row when(new.category in('staff_salary','rider_salary'))
    execute function private.credit_financial_director_salary_savings();`);
  for (let level = 1; level <= 5; level++) {
    for (const country of [1, 2]) {
      await resetLedger();
      await db.query('update staff_members set level=$1,country_id=$2 where id=$3', [level, id(country), id(10)]);
      await db.exec(`update seasons set current_day_number=14 where id='${id(3)}';
        update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+day_number-14 where season_id='${id(3)}';`);
      await post(800, 'staff_salary', salaryRef('staff-contract', 13, 3), -12345.67, 'pending', 21);
      await post(801, 'rider_salary', salaryRef('rider-salary', 14, 3), -76543.21, 'pending', 21);
      await post(802, 'sponsor', `sponsor:${id(8)}:${id(3)}:3`, 10001.13, 'pending', 21);
      await post(803, 'sponsor', 'secondary-sponsor-objective:future-due', 23456.78, 'pending', 21);
      await post(804, 'race_prize', 'race:already-known-result-pending', 4321.99, 'pending', 21);
      const expected = (await projection()).filter(row => row.day_number === 21);
      check(expected.length, 6);
      const ledgerBeforeRead = await snapshot();
      await projection();
      check(await snapshot(), ledgerBeforeRead);
      await db.exec(`update seasons set current_day_number=21 where id='${id(3)}';
        update season_days set calendar_date=(now() at time zone 'Europe/Paris')::date+day_number-21 where season_id='${id(3)}';
        update team_finance_transactions set status='posted',posted_at=now() where status='pending';`);
      check(await scalar('select settle_due_financial_director_income()'), 1);
      for (const row of expected) {
        check(Number(await scalar('select amount from team_finance_transactions where source_reference=$1', [row.source_reference])), Number(row.amount));
      }
      check((await projection()).filter(row => row.day_number === 21).length, 0);
      check(await scalar('select settle_due_financial_director_income()'), 0);
    }
  }
  console.log(JSON.stringify({isolatedPostgres: true, checks, productionFixtures: false}));
} finally {await db.close();}
