import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardAssistant = readFileSync(
  "lib/game/dashboard-assistant.ts",
  "utf8",
);
const selectionPage = readFileSync(
  "app/jeu/selections-internationales/page.tsx",
  "utf8",
);
const selectionActions = readFileSync(
  "app/jeu/selections-internationales/actions.ts",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260912200000_preserve_and_expose_federation_callups.sql",
  "utf8",
);

describe("federation call-up assistant integration", () => {
  it("loads on the page targeted by the sporting director assistant", () => {
    expect(dashboardAssistant).toContain(
      'href: "/jeu/selections-internationales"',
    );
    expect(selectionPage).toContain(
      'supabase.rpc("get_current_director_federation_callups")',
    );
    expect(selectionPage).toContain("<FederationCallupCard");
  });

  it("lets the authenticated owner answer a published federation call-up", () => {
    expect(selectionActions).toContain(
      'supabase.rpc("respond_to_national_federation_preselection"',
    );
    expect(migration).toContain(
      "create or replace function public.get_current_director_federation_callups()",
    );
    expect(migration).toContain("director.auth_user_id = (select auth.uid())");
    expect(migration).toContain("selection_list.published_at is not null");
  });
});
