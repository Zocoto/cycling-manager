// Install only this reviewed migration, without calling gameplay functions.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const version = "20261012120000", name = "repeat_halloween_consumables";
if (process.argv.length !== 3 || process.argv[2] !== "--apply-reviewed-fix" || readFileSync("supabase/.temp/project-ref", "utf8").trim() !== "ikagfuchasnsakpouosg") {
  throw new Error("Exact reviewed-fix flag and expected linked project are required.");
}
const require = createRequire(import.meta.url);
const binary = path.join(path.dirname(require.resolve("@supabase/cli-windows-x64/package.json")), "bin/supabase.exe");
function query(value, file = false) {
  const raw = execFileSync(binary, ["db", "query", "--linked", ...(file ? ["--file", value] : [value]), "--output", "json"], { encoding: "utf8", maxBuffer: 100000, timeout: 30000 });
  return JSON.parse(raw.slice(raw.indexOf("{")));
}
const check = `begin read only; set local statement_timeout='4s';
  select (select name from supabase_migrations.schema_migrations where version='${version}') receipt,
    (select bool_and(position('halloween_repeat_consumables_v1' in pg_get_functiondef(signature::regprocedure))>0)
      from unnest(array['public.halloween_use_item(uuid,text,uuid)','public.halloween_action(uuid,uuid,text,jsonb)']) signature) installed,
    (select bool_and(catalog.price=expected.price and catalog.max_obtained=expected.cap and catalog.effect->>'purchaseLimit'=expected.quota::text) from public.halloween_catalog catalog
      join (values ('pumpkin-juice',12,30,30),('mummy-bandage',16,30,30),('scouts-candy',20,30,30),('gravediggers-hourglass',24,30,30),
      ('midnight-chocolate',16,30,30),('spectres-tea',100,30,30),('giants-syrup',100,30,30),('immortality-pact',1800,6,5),
      ('mummy-resurrection',720,6,5),('full-moon-elixir',560,6,5),('cursed-builders-seal',900,6,5),('witches-star',3600,5,5),('youth-fountain',6000,6,5)) expected(id,price,cap,quota)
      using(id)) catalog_updated,
    (select pg_get_constraintdef(oid)='PRIMARY KEY (id)' from pg_constraint where conrelid='public.halloween_rider_effects'::regclass and contype='p') repeat_key,
    md5(pg_get_functiondef('public.halloween_gift(text,uuid,text,jsonb)'::regprocedure)) gift_hash,
    md5(pg_get_functiondef('public.get_current_halloween_state()'::regprocedure)) state_hash,
    md5(pg_get_functiondef('public.settle_due_training_sessions()'::regprocedure)) training_hash,
    md5(pg_get_functiondef('public.settle_due_free_agent_training(integer)'::regprocedure)) free_agent_hash;
  commit;`;
const before = query(check).rows[0];
if (before.receipt && before.receipt !== name) throw new Error("Migration version collision; stop and choose a fresh version.");
if (before.receipt && (!before.installed || !before.catalog_updated || !before.repeat_key)) throw new Error("Migration receipt and live state disagree; inspect.");
if (!before.receipt && before.installed && (!before.catalog_updated || !before.repeat_key)) throw new Error("Partial live state without receipt; inspect before recording anything.");
if (!before.receipt) {
  const migrationPath = `supabase/migrations/${version}_${name}.sql`;
  const sql = readFileSync(migrationPath, "utf8");
  if (!/commit;\s*$/i.test(sql)) throw new Error("Reviewed migration must commit atomically.");
  if (!before.installed) query(migrationPath, true);
  const literal = "'" + sql.replaceAll("'", "''") + "'";
  query(`begin; set local lock_timeout='5s'; set local statement_timeout='8s';
    insert into supabase_migrations.schema_migrations(version,name,statements)
    values('${version}','${name}',array[${literal}]::text[]) on conflict(version) do nothing; commit;`);
}
const after = query(check).rows[0];
if (after.receipt !== name || !after.installed || !after.catalog_updated || !after.repeat_key
  || ["gift_hash", "state_hash", "training_hash", "free_agent_hash"].some((key) => after[key] !== before[key])) {
  throw new Error("Migration or unchanged draw/training path not confirmed; inspect before retrying.");
}
console.log(JSON.stringify({ version, installed: true, recorded: true, existingInventoryPreserved: true, gameplayFunctionsRun: false, drawAndTrainingPathsUnchanged: true }));
