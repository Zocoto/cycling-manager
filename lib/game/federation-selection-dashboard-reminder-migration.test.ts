import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260913120000_add_manual_federation_selection_dashboard_reminder.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../../services/dashboard-assistant.ts", import.meta.url),
  "utf8",
);

describe("manual federation selection dashboard reminder", () => {
  it("only targets the elected president when automatic selection is disabled", () => {
    expect(migration).toContain(
      "term.president_director_id = context.sporting_director_id",
    );
    expect(migration).toContain("term.governance_mode = 'elected'");
    expect(migration).toContain("preference.automatic_selection = false");
  });

  it("opens exactly two days before each authoritative deadline", () => {
    expect(migration).toContain(
      "public.get_national_federation_selection_schedule(",
    );
    expect(migration).toContain(
      "now() >= schedule.closes_at - interval '2 days'",
    );
    expect(migration).toContain("schedule.is_open");
  });

  it("stops reminding as soon as every current list has been published", () => {
    expect(migration).toContain("selection_list.published_at is not null");
    expect(migration).toContain("member.response_status = 'draft'");
    expect(migration).toContain("'federationSelectionReminder'");
    expect(service).toContain(
      "assistantPayload.federationSelectionReminderCount",
    );
  });
});
