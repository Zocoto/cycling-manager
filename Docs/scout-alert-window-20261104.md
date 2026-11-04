# Available-scout alert and end-of-season closure

The dashboard offered a new scouting mission whenever a scout had no active
mission, even after no valid mission duration remained. Missions take at
least three complete days and must finish by day 28. The available-scout
prompt now requires `current_day_number + 3 <= 28` inside its existing SQL
count, using the dashboard's already loaded current context.

The alert remains available on J25 (three-day mission ending on J28),
disappears on J26/J27/J28, and returns at next-season J1. Ready scouting
reports, existing missions, staff data and other alerts are preserved.
No new request, calendar fetch, client code or UI layout change is added.

The migration performs one guarded replacement in the current read-only
dashboard function, preserving its other content, permissions and timeout.
Unexpected shapes abort and a marker makes retries idempotent. It is
installed alone and recorded atomically; no gameplay rows are mutated.

The isolated PostgreSQL test runs the patched count against active, busy,
inactive, non-scout and other-team staff, checks all 28 days against the
existing TypeScript mission-duration helper, verifies ready reports and
next-season reopening, and checks privileges and retry safety. No fixture
or migration rehearsal runs on production. The existing application reads
the corrected count without requiring an application deployment.
