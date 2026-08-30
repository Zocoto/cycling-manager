import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260830130000_align_dashboard_recruitment_and_form_alerts.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const service = readFileSync(
  join(process.cwd(), "services/dashboard-assistant.ts"),
  "utf8",
);

describe("dashboard recruitment and form alerts migration", () => {
  it("uses the latest known condition on or before the current game day", () => {
    expect(migration).toContain("join lateral (");
    expect(migration).toContain(
      "condition_day.day_number <= context.current_day_number",
    );
    expect(migration).toContain(
      "order by condition_day.day_number desc, condition.updated_at desc",
    );
    expect(migration).toContain(
      "as latest_condition on true\n    where latest_condition.form < setting.minimum_form",
    );
  });

  it("counts only recruitment matches that are still actionable", () => {
    expect(migration).toContain("listing.status = 'open'");
    expect(migration).toContain("listing.closes_at > now()");
    expect(migration).toContain("listing.status = 'available'");
    expect(migration).toContain(
      "'recruitment-alert:rider:' || listing.id::text",
    );
    expect(migration).toContain(
      "'recruitment-alert:staff:' || listing.id::text",
    );
  });

  it("keeps recruitment counters in the existing assistant RPC payload", () => {
    expect(migration).toContain("'riderRecruitmentMatchCount'");
    expect(migration).toContain("'staffRecruitmentMatchCount'");
    expect(service).toContain(
      '.rpc("get_current_dashboard_assistant_summary")',
    );
    expect(service.match(/\.rpc\(/g)).toHaveLength(1);
  });
});
