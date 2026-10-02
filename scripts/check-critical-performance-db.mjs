import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

// Deliberately always ROLLBACK. The test cannot deploy or sign up any rider.
const root = process.cwd();
// ROLLBACK protects data, not availability: DDL and fixture writes can still
// hold production locks until the transaction ends. Never run this integration
// fixture against the live project; use a separately linked disposable project.
const linkedProject = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
if (linkedProject === "ikagfuchasnsakpouosg") {
  console.error("Refusing transactional integration fixtures on production. Use an isolated test project; the calendar HTTP check remains read-only.");
  process.exit(1);
}
const migrations = ["20261002180000_isolate_critical_dashboard_and_cn_work.sql", "20261002181000_persist_bounded_performance_samples.sql"];
const bodies = migrations.map((name) => readFileSync(path.join(root, "supabase/migrations", name), "utf8").replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, ""));
const rollback = readFileSync(path.join(root, "supabase/rollbacks/20261002180000_critical_performance.sql"), "utf8").replace(/\bbegin;\s*/i, "").replace(/commit;\s*$/i, "");
const sql = `begin; set local statement_timeout = '120s';\n${bodies.join("\n")}\n${readFileSync(path.join(root, "supabase/tests/critical-performance.sql"), "utf8")}\n${rollback}\nrollback;`;
const require = createRequire(import.meta.url);
const packagePath = require.resolve("@supabase/cli-windows-x64/package.json");
const binary = path.join(path.dirname(packagePath), "bin/supabase.exe");
try {
  const output = execFileSync(binary, ["db", "query", "--linked", sql, "--output", "json"], { encoding: "utf8", maxBuffer: 2_000_000, timeout: 180_000 });
  console.log(output);
} catch (error) {
  const stderr = String(error.stderr ?? "");
  console.error(stderr.match(/unexpected status \d+|ERROR:[^\n]+/)?.[0] ?? `Database check failed (${error.code ?? error.status ?? "unknown"})`);
  process.exitCode = 1;
}
