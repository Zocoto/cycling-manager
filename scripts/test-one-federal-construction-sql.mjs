// Credential-free, isolated PostgreSQL/WASM regression.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.argv[2] ?? "";
if (!isAbsolute(modulePath) || !modulePath.replaceAll("\\", "/").endsWith("/@electric-sql/pglite/dist/index.js")) {
  throw new Error("Pass the absolute path to an isolated local PGlite module.");
}
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const belgium = id(1);
const france = id(2);
const belgianPresident = id(3);
const frenchPresident = id(4);
const season = id(5);
const belgianAccount = id(6);
const frenchAccount = id(7);
const belgianUser = id(8);
const frenchUser = id(9);
const ordinaryUser = id(10);
const cancelled = id(11);
const readMigration = filename => readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
const rows = async (sql, values = []) => (await db.query(sql, values)).rows;
const scalar = async (sql, values = []) => Object.values((await rows(sql, values))[0])[0];
const setUser = user => scalar("select set_config('request.jwt.claim.sub', $1, false)", [user]);
const start = (country, code) => scalar(
  "select public.start_national_federation_infrastructure_project($1, $2, 'balanced')", [country, code],
);
const settle = () => scalar("select public.settle_due_national_federation_infrastructure_projects()");
const advance = day => db.query("update public.seasons set current_day_number = $1 where id = $2", [day, season]);
const activeIds = country => rows(
  "select id from public.national_federation_infrastructure_projects where country_id = $1 and status = 'active' order by id",
  [country],
).then(projects => projects.map(project => project.id));
const accounting = async (country, account) => ({
  balance: await scalar("select balance::int from public.national_federation_accounts where id = $1", [account]),
  debits: await scalar("select count(*)::int from public.national_federation_transactions where account_id = $1", [account]),
  launches: await scalar("select count(*)::int from public.national_federation_journal_entries where country_id = $1 and source_reference like '%:journal'", [country]),
});

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.seasons(id uuid primary key, game_year int, current_day_number int, status text);
    create table public.national_federation_terms(
      country_id uuid, start_game_year int, end_game_year int, governance_mode text, president_director_id uuid
    );
    create table public.national_federation_accounts(
      id uuid primary key, country_id uuid, season_id uuid, balance numeric, updated_at timestamptz
    );
    create table public.national_federation_infrastructures(
      country_id uuid, infrastructure_code text, level int, completed_project_id uuid,
      completed_at timestamptz, updated_at timestamptz, primary key (country_id, infrastructure_code)
    );
    create table public.national_federation_infrastructure_projects(
      id uuid primary key default gen_random_uuid(), country_id uuid not null, started_season_id uuid,
      infrastructure_code text, target_level int, priority text, base_cost numeric, final_cost numeric,
      base_duration_days int, final_duration_days int, starts_game_day_index int, completes_game_day_index int,
      started_by_director_id uuid, status text not null default 'active' check (status in ('active','completed','cancelled')),
      completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create unique index national_federation_projects_one_active_code_idx
      on public.national_federation_infrastructure_projects(country_id,infrastructure_code) where status = 'active';
    create table public.national_federation_transactions(
      account_id uuid, day_number int, amount numeric, category text, description text,
      source_reference text unique, metadata jsonb
    );
    create table public.national_federation_journal_entries(
      country_id uuid, season_id uuid, day_number int, category text, title text, detail text, source_reference text unique
    );
    create table public.fixture_federation_identities(user_id uuid, country_code text, country_id uuid, director_id uuid);
    create function public.get_current_federation_identity(p_country_code text)
    returns table(country_id uuid,sporting_director_id uuid)
    language sql stable set search_path = '' as $$
      select fixture.country_id, fixture.director_id from public.fixture_federation_identities as fixture
      where fixture.user_id = auth.uid() and fixture.country_code = upper(btrim(p_country_code))
    $$;
    create function public.initialize_due_national_federation_accounts()
    returns integer language sql as $$ select 0 $$;
    insert into public.seasons values ('${season}',5,5,'active');
    insert into public.national_federation_terms values
      ('${belgium}',5,6,'elected','${belgianPresident}'), ('${france}',5,6,'elected','${frenchPresident}');
    insert into public.national_federation_accounts values
      ('${belgianAccount}','${belgium}','${season}',10000000,now()),
      ('${frenchAccount}','${france}','${season}',10000000,now());
    insert into public.fixture_federation_identities values
      ('${belgianUser}','BE','${belgium}','${belgianPresident}'),
      ('${frenchUser}','FR','${france}','${frenchPresident}'),
      ('${ordinaryUser}','BE','${belgium}','${id(12)}');
  `);

  const original = (await readMigration("20260903235500_create_federation_infrastructure_projects.sql")).replaceAll("\r", "");
  const getDefinition = name => {
    const start = original.indexOf(`create or replace function public.${name}(`);
    const end = original.indexOf("$$;", start);
    assert.ok(start >= 0 && end > start);
    return original.slice(start, end + 3);
  };
  await db.exec(getDefinition("settle_due_national_federation_infrastructure_projects"));
  // The all-federations migration removed the beta country guard. The later
  // cost and duration changes leave these tests independent of pricing.
  await db.exec(getDefinition("start_national_federation_infrastructure_project")
    .replace("upper(btrim(coalesce(p_country_code, ''))) <> 'BE'", "false"));
  const signature = "public.start_national_federation_infrastructure_project(text,text,text)";
  await db.exec(`
    revoke execute on function ${signature} from public, anon;
    grant execute on function ${signature} to authenticated, service_role;
  `);

  await setUser(belgianUser);
  const first = await start("BE", "national_detection_network");
  const second = await start("BE", "federal_staff_institute");
  assert.deepEqual(await activeIds(belgium), [first, second].sort());
  await db.query(`
    update public.national_federation_infrastructure_projects
    set completes_game_day_index = case when id = $1 then 145 else 146 end
    where id in ($1, $2)
  `, [first, second]);
  await db.query(`
    insert into public.national_federation_infrastructure_projects(id,country_id,infrastructure_code,status)
    values ($1,$2,'federal_medical_network','cancelled')
  `, [cancelled, belgium]);
  const beforeMigration = await accounting(belgium, belgianAccount);

  await db.exec((await readMigration("20261112220000_limit_federal_construction_to_one_project.sql")).replaceAll("\r", ""));
  assert.equal(await scalar("select has_function_privilege('anon', $1, 'execute')", [signature]), false);
  assert.equal(await scalar("select has_function_privilege('authenticated', $1, 'execute')", [signature]), true);
  assert.deepEqual(await activeIds(belgium), [first, second].sort());
  assert.deepEqual(await accounting(belgium, belgianAccount), beforeMigration);
  await assert.rejects(start("BE", "federal_medical_network"), /Un chantier est déjà en cours dans cette fédération/);
  assert.deepEqual(await accounting(belgium, belgianAccount), beforeMigration);

  await setUser(frenchUser);
  const frenchProject = await start("FR", "national_detection_network");
  assert.deepEqual(await activeIds(france), [frenchProject]);
  assert.deepEqual(await activeIds(belgium), [first, second].sort());
  assert.equal((await accounting(france, frenchAccount)).debits, 1);

  await setUser(belgianUser);
  await advance(6);
  assert.equal(await settle(), 1);
  assert.deepEqual(await activeIds(belgium), [second]);
  await assert.rejects(start("BE", "federal_medical_network"), /Un chantier est déjà en cours dans cette fédération/);
  assert.deepEqual(await accounting(belgium, belgianAccount), beforeMigration);
  await advance(7);
  assert.equal(await settle(), 1);
  assert.deepEqual(await activeIds(belgium), []);
  assert.equal(await scalar("select count(*)::int from public.national_federation_infrastructures where country_id = $1 and level = 1", [belgium]), 2);

  await setUser(ordinaryUser);
  await assert.rejects(start("BE", "federal_medical_network"), /Seul le président élu/);
  assert.deepEqual(await accounting(belgium, belgianAccount), beforeMigration);
  await setUser(belgianUser);
  await db.exec("begin");
  await db.exec("set role authenticated");
  const next = await start("BE", "federal_medical_network");
  assert.equal(await scalar(
    `select exists (
       select 1 from pg_locks where pid = pg_backend_pid() and locktype = 'advisory'
         and mode = 'ExclusiveLock' and granted and objsubid = 1
         and ((classid::text::bigint << 32) | objid::text::bigint)
           = hashtextextended($1::text || ':federation-infrastructure', 0)
     )`,
    [belgium],
  ), true);
  await db.exec("reset role");
  await db.exec("commit");
  assert.deepEqual(await activeIds(belgium), [next]);
  assert.equal(await scalar("select status from public.national_federation_infrastructure_projects where id = $1", [cancelled]), "cancelled");
  const price = await scalar("select final_cost::int from public.national_federation_infrastructure_projects where id = $1", [next]);
  const afterLaunch = {
    balance: beforeMigration.balance - price,
    debits: beforeMigration.debits + 1,
    launches: beforeMigration.launches + 1,
  };
  assert.deepEqual(await accounting(belgium, belgianAccount), afterLaunch);
  await assert.rejects(start("BE", "race_organization_office"), /Un chantier est déjà en cours dans cette fédération/);
  assert.deepEqual(await accounting(belgium, belgianAccount), afterLaunch);
  assert.deepEqual(await activeIds(france), [frenchProject]);
  console.log("PASS: one construction per federation, preserved legacy projects, independent countries, settlement, lock, accounting and permissions.");
} finally {
  await db.close();
}
