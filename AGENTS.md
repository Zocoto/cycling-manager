<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Owner delivery preference

- For work the owner requests, proceed through implementation, verification and production deployment without asking for repeated step-by-step validation. This standing authorization covers normal delivery steps within the requested scope, not unrelated or broader mutations.
- Ask only for indispensable missing information or a genuine product arbitration. Platform permission requirements and production safety rules remain in force.

## Production database availability

- Never run integration fixtures, temporary gameplay mutations, or migration rehearsals against the live Supabase project (`ikagfuchasnsakpouosg`), even inside a transaction ending in `ROLLBACK`. Rollback does not prevent locks, memory pressure, or downtime. Use an isolated test database.
- Production diagnostics must be read-only, bounded, and run one at a time. Avoid whole-table JSON aggregations and broad repeated scans. Stop expensive work immediately if SQL connectivity or service health deteriorates.
- Apply only the reviewed migrations required for the task. Do not combine a production migration with integration fixtures or benchmarks in the same transaction. Bound lock waits and query execution, inspect the outcome, and verify database health before promoting an application deployment.
- Following a SQL timeout or client disconnect, verify that the diagnostic transaction has ended. Cancel only an exactly identified task-owned diagnostic; never terminate player sessions or scheduled gameplay jobs indiscriminately.
- Do not report recovery or deployment as successful until database connectivity and the live application have both been verified. Check missed scheduled work and use the existing idempotent settlement paths for any confirmed catch-up.
