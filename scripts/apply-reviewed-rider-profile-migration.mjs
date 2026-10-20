// Install only the reviewed profile predicates; never run gameplay or fixtures.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const version = "20261020110000";
const name = "preserve_dominant_rider_specialties";
const signature = "public.search_transfer_riders(uuid,text,text,integer,integer,integer,text,numeric,text,uuid,integer,integer)";
const mode = process.argv[2];
if (process.argv.length !== 3 || !["--inspect", "--apply-reviewed-fix", "--verify"].includes(mode)) {
  throw new Error("An exact inspect, verify or reviewed-install flag is required.");
}
if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("Unexpected linked project; no changes applied.");
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
function query(sql) {
  let raw;
  try {
    raw = execFileSync(binary, ["db", "query", "--linked", sql, "--output", "json"], {
      encoding: "utf8", timeout: 20000, maxBuffer: 100000,
    });
  } catch (error) {
    throw new Error(String(error.stderr ?? error.code ?? "Database query failed; inspect before retrying.").slice(0, 1500));
  }
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("Missing query receipt; inspect before retrying.");
  return JSON.parse(raw.slice(start));
}
const readOnly = sql => `begin read only;
  set local application_name='cyclostratege_rider_profile_20261020';
  set local statement_timeout='3s'; set local lock_timeout='500ms';
  ${sql} commit;`;
function inspect() {
  return query(readOnly(`
    select exists(select 1 from supabase_migrations.schema_migrations where version='${version}') recorded,
      position('sporting_profile_climber_preserved_v1' in source)>0 climber_installed,
      position('sporting_profile_rouleur_preserved_v1' in source)>0 rouleur_installed,
      source
    from (select pg_catalog.pg_get_functiondef('${signature}'::regprocedure) source) definition;
  `)).rows[0];
}
function receipt(state) {
  return { migration: version, recorded: state.recorded, climberInstalled: state.climber_installed, rouleurInstalled: state.rouleur_installed };
}
const before = inspect();
console.log(JSON.stringify({ before: receipt(before) }));
if (mode === "--inspect") process.exit(0);

if (mode === "--apply-reviewed-fix") {
  if (before.recorded && (!before.climber_installed || !before.rouleur_installed)) {
    throw new Error("Migration receipt and function disagree; no changes applied.");
  }
  if (!before.recorded) {
    const file = `supabase/migrations/${version}_${name}.sql`;
    const sql = readFileSync(file, "utf8");
    if (!/^begin;/i.test(sql) || !/commit;\s*$/i.test(sql)) {
      throw new Error("Reviewed migration must be a single atomic transaction.");
    }
    const literal = "'" + sql.replaceAll("'", "''") + "'";
    // Record the migration in the same transaction as the exact function patch.
    query(sql.replace(/commit;\s*$/i, `
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array[${literal}]::text[])
      on conflict(version) do nothing;
      commit;
    `));
  }
}

const after = inspect();
if (!after.recorded || !after.climber_installed || !after.rouleur_installed) {
  throw new Error("Installation not confirmed; inspect before retrying.");
}

// Evaluate the installed search's own seven-candidate expression on the one
// affected rider. No search of the complete roster, temporary rows or writes.
const profile = after.source.match(/cross join lateral \(([\s\S]*?)\) as profile/);
if (!profile) throw new Error("Unexpected installed profile expression.");
const rider = query(readOnly(`
  select rider.first_name||' '||rider.last_name rider,
    rating.mountain, rating.hills, rating.time_trial,
    array_to_string(case
      when profile.scores[1]-profile.scores[2]<=4 then profile.labels[1:2]
      else profile.labels[1:1] end, ' / ') sporting_profile
  from public.rider_season_ratings rating
  join public.riders rider on rider.id=rating.rider_id
  join public.seasons season on season.id=rating.season_id
  cross join lateral (${profile[1]}) as profile
  where rating.rider_id='2856644f-3612-4e0a-ac73-44df175d4c11'
    and season.status='active'
  limit 1;
`)).rows[0];
if (!rider || rider.sporting_profile !== "Grimpeur / Puncheur") {
  throw new Error(`Unexpected current rider profile: ${JSON.stringify(rider)}`);
}
console.log(JSON.stringify({ after: receipt(after), rider, gameplayRun: false, health: "read-only query succeeded" }));
