import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const migration = read(
  "supabase/migrations/20260921113000_add_projected_deficit_purchase_warning.sql",
);
const route = read("app/api/finance/purchase-risk/route.ts");
const provider = read("components/game/financial-risk-warning-provider.tsx");
const layout = read("app/jeu/layout.tsx");

describe("projected deficit purchase warning integration", () => {
  it("computes the same end-of-season projection as the finance overview", () => {
    expect(migration).toContain("v_team_season.opening_cash_balance");
    expect(migration).toMatch(
      /sum\(transaction\.amount\) filter \(\s*where transaction\.status <> 'cancelled'/u,
    );
    expect(migration).toContain(
      "round(v_projected_balance - v_expense, 2) < 0",
    );
    expect(migration).toContain("v_projected_balance < 0");
  });

  it("keeps the financial lookup authenticated, same-origin and read-only", () => {
    expect(route).toContain("isSameOriginRequest(request)");
    expect(route).toContain("getAuthenticatedUser(supabase)");
    expect(route).toContain(
      'rpc("get_current_team_purchase_financial_risk"',
    );
    expect(migration).toMatch(
      /revoke all on function public\.get_current_team_purchase_financial_risk\(numeric\)\s+from public, anon/u,
    );
    expect(migration).toMatch(
      /grant execute on function public\.get_current_team_purchase_financial_risk\(numeric\)\s+to authenticated, service_role/u,
    );
  });

  it("intercepts both server-action forms and client-side purchase buttons", () => {
    expect(provider).toContain('document.addEventListener("submit", onSubmit, true)');
    expect(provider).toContain('document.addEventListener("click", onClick, true)');
    expect(provider).toContain("form.requestSubmit");
    expect(provider).toContain("continuation.element.click()");
    expect(provider).toContain('role="alertdialog"');
    expect(layout).toContain("<FinancialRiskWarningProvider>");
  });

  it("covers the main team purchase paths", () => {
    const files = [
      "components/game/equipment-commercial-shop.tsx",
      "components/game/infrastructure-building-card.tsx",
      "components/game/data-room-construction-card.tsx",
      "components/game/international-youth-center-map.tsx",
      "components/game/staff-academy-card.tsx",
      "components/game/form-camp-planner.tsx",
      "components/game/nutrition-interventions-editor.tsx",
      "components/game/race-reconnaissance-planner.tsx",
      "components/game/fan-club.tsx",
      "app/jeu/centre-de-soin/page.tsx",
      "app/jeu/centre-de-formation/page.tsx",
      "app/jeu/staff/page.tsx",
      "app/jeu/transferts/page.tsx",
      "app/jeu/coureurs/[identifiant]/page.tsx",
    ];

    for (const file of files) {
      expect(read(file), file).toContain("data-financial-expense");
    }
  });
});
