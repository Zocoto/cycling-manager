// Runs only against an isolated in-memory PGlite database, never production.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const migration = readFileSync("supabase/migrations/20261016171000_materialize_team_roster_projection.sql", "utf8");
const baseline = readFileSync("supabase/migrations/20260921130000_create_team_roster_management_center.sql", "utf8");
const source = baseline.match(/create or replace function private\.get_team_roster_projection\([\s\S]*?\$\$;/i)?.[0];
assert.ok(source, "Committed roster projection baseline is required.");
const capturePath = ".tmp-query-workload-20261016/schema.json";
if (existsSync(capturePath)) {
  const captured = JSON.parse(readFileSync(capturePath, "utf8")).find((row) => row.name === "private.get_team_roster_projection(uuid,integer)")?.definition;
  const body = (definition) => definition.replaceAll("\r", "").match(/as\s+(\$[^$]*\$)([\s\S]*?)\1\s*;?/i)?.[2].trim();
  if (captured) assert.equal(body(captured), body(source), "Production capture must match the committed baseline.");
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let checks = 0;
const check = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const scalar = async (sql, parameters = []) => Object.values((await db.query(sql, parameters)).rows[0])[0];
const invocationCount = async () => {
  const row = (await db.query("select last_value, is_called from private.commitment_calls")).rows[0];
  return row.is_called ? Number(row.last_value) : 0;
};
const readProjection = async (team = 1, year = 2027) => {
  await db.exec("alter sequence private.commitment_calls restart with 1");
  const row = (await db.query("select * from private.get_team_roster_projection($1::uuid, $2::integer)", [id(team), year])).rows[0];
  return { row, calls: await invocationCount() };
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create sequence private.commitment_calls;
    create table public.youth_academy_riders(team_id uuid, status text, promotion_game_year integer);
    create table private.commitment_fixture(team_id uuid primary key, firm_count integer, roster_limit integer);
    -- STABLE and SECURITY DEFINER are essential: a VOLATILE test double would
    -- itself stop CTE folding and conceal the original repeated computation.
    create function public.get_team_roster_commitment_count(p_team_id uuid, p_game_year integer)
      returns integer language sql stable security definer set search_path = '' as $$
      select (select firm_count from private.commitment_fixture where team_id = p_team_id)
        + 0 * nextval('private.commitment_calls')::integer
    $$;
    create function public.get_team_roster_limit(p_team_id uuid)
      returns integer language sql stable security definer set search_path = '' as $$
      select roster_limit from private.commitment_fixture where team_id = p_team_id
    $$;
    insert into private.commitment_fixture values ('${id(1)}',34,35), ('${id(2)}',35,40), ('${id(3)}',null,null);
    insert into youth_academy_riders values
      ('${id(1)}','recruited',2027), ('${id(1)}','recruited',2027),
      ('${id(1)}','recruited',2028), ('${id(1)}','active',2027),
      ('${id(1)}','recruited',null), ('${id(2)}','recruited',2026);
  `);
  await db.exec(source);
  await db.exec("revoke all on function private.get_team_roster_projection(uuid,integer) from public, anon, authenticated; grant execute on function private.get_team_roster_projection(uuid,integer) to service_role");
  const metadataBefore = (await db.query("select proowner, proacl, provolatile, prosecdef, proconfig, prorettype from pg_proc where oid='private.get_team_roster_projection(uuid,integer)'::regprocedure")).rows[0];
  const before = [];
  for (const parameters of [[1, 2027], [1, 2026], [1, 2028], [2, 2027], [3, 2027], [4, 2027], [1, null]]) {
    const outcome = await readProjection(...parameters);
    check(outcome.calls, 3, `Original commitment helper is evaluated three times (${parameters}).`);
    before.push({ parameters, row: outcome.row });
  }
  check(before[0].row, { firm_commitment_count: 34, scheduled_youth_count: 2, projected_count: 36, overflow_count: 1 }, "Original overflow fixture.");
  check(before[1].row.scheduled_youth_count, 0, "Future, active and undated juniors excluded.");
  check(before[2].row.scheduled_youth_count, 3, "Promotion year is inclusive.");
  check(before[3].row.overflow_count, 0, "Dynamic roster limit retained.");
  check(before[4].row, { firm_commitment_count: null, scheduled_youth_count: 0, projected_count: null, overflow_count: 0 }, "Existing NULL behavior retained.");
  check(before[6].row.scheduled_youth_count, 0, "NULL requested year behavior retained.");

  await db.exec(migration);
  const metadataAfter = (await db.query("select proowner, proacl, provolatile, prosecdef, proconfig, prorettype from pg_proc where oid='private.get_team_roster_projection(uuid,integer)'::regprocedure")).rows[0];
  check(metadataAfter, metadataBefore, "Ownership, privileges, security, stability, return type and settings unchanged.");
  for (const { parameters, row } of before) {
    const outcome = await readProjection(...parameters);
    check(outcome.row, row, `Identical projection result (${parameters}).`);
    check(outcome.calls, 1, `Only one commitment calculation (${parameters}).`);
  }
  await assert.rejects(db.exec(migration), /Unexpected roster projection source/);
  checks++;
  await db.exec("rollback");
  check(await scalar("select count(*)::integer from youth_academy_riders"), 6, "Migration changes no gameplay rows.");
  await db.exec(source.replace("academy.status = 'recruited'", "academy.status = 'active'"));
  await assert.rejects(db.exec(migration), /Unexpected roster projection source/);
  checks++;
  await db.exec("rollback");
  console.log(`${checks} isolated roster projection checks passed (3 helper calls reduced to 1).`);
} finally {
  await db.close();
}
