import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FederationSelectionWorkbench, getFederationSelectionSlots } from "./federation-selection-workbench";
import type { FederationSelectionSchedule } from "@/lib/game/federation-callups";

const schedule: FederationSelectionSchedule = {
  slot_key: "cc-pro-road", label: "CC Pros · Route", rider_category: "professional",
  race_edition_id: "cc-edition", race_href: "/jeu/courses/cc", departure_at: "2026-11-20T17:00:00Z",
  closes_at: "2026-11-19T17:00:00Z", is_open: true, can_prepare: true,
  qualification_status: "qualified", qualification_day_number: 8, qualification_rank: 36, rider_limit: 3,
};

function render(gameYear: number, overrides: Partial<FederationSelectionSchedule> = {}, riderIds: string[] = []) {
  return renderToStaticMarkup(<FederationSelectionWorkbench countryCode="RW" countryName="Rwanda" riders={[]} gameYear={gameYear}
    selectionState={{ canManage: true, automaticSelection: false, competitionHosts: {}, forecasts: {},
      schedules: { "cc-pro-road": { ...schedule, ...overrides } },
      selections: { "cc-pro-road": { status: "draft", revision: 1, riderIds } }, pendingConfirmations: [],
    }} />);
}

describe("federation championship quotas from S5", () => {
  it("does not change S4 despite future quota metadata", () => {
    const slots = getFederationSelectionSlots(4, 4, 1, { "cc-pro-road": schedule });
    expect(slots.find(s => s.id === "cc-pro-road")?.limit).toBe(8);
    expect(slots.find(s => s.id === "nc-hills")?.limit).toBe(4);
    expect(slots.find(s => s.id === "nc-time-trial")?.limit).toBe(1);
    expect(render(4)).not.toContain("Quota national");
  });

  it.each([5, 6, 8, 9])("uses authoritative championship quotas in S%s without altering other competitions", (year) => {
    const slots = getFederationSelectionSlots(year, 4, 1, {
      "cc-pro-road": schedule,
      "cc-pro-itt": { ...schedule, rider_limit: 1 },
      "world-pro-road": { ...schedule, rider_limit: 2 },
      "world-pro-itt": { ...schedule, rider_limit: 1 },
      "cc-junior-road": { ...schedule, rider_limit: 0 },
    });
    expect(slots.find(s => s.id === "cc-pro-road")?.limit).toBe(3);
    expect(slots.find(s => s.id === "cc-pro-itt")?.limit).toBe(1);
    expect(slots.find(s => s.id === "world-pro-road")?.limit).toBe(2);
    expect(slots.find(s => s.id === "world-pro-itt")?.limit).toBe(1);
    expect(slots.find(s => s.id === "cc-junior-road")?.limit).toBe(6);
    expect(slots.find(s => s.id === "nc-hills")?.limit).toBe(year === 8 ? 4 : 1);
  });

  it("distinguishes zero places from missing or invalid metadata", () => {
    for (const [input,expected] of [[0,0], [undefined,8], [-1,8], [9,8], [1.5,8], [NaN,8]] as const) {
      expect(getFederationSelectionSlots(5, 0, 0, { "cc-pro-road": { ...schedule, rider_limit: input } }).find(s=>s.id === "cc-pro-road")?.limit).toBe(expected);
    }
  });

  it("explains the frozen national quota and its rank", () => {
    const markup = render(5);
    expect(markup).toContain("0/3");
    expect(markup).toContain("Quota national : 3 places");
    expect(markup).toContain("Rang de qualification : 36");
    expect(markup).toContain("Toutes les nations éligibles du continent sont admises");
  });

  it("keeps J1 drafting available while waiting for J8", () => {
    const markup = render(5, { rider_limit: 8, qualification_rank: null, qualification_status: "pending", is_open: false });
    expect(markup).toContain("Quota provisoire");
    expect(markup).toContain("sera fixé à J8");
    expect(markup.match(/<button\b[^>]*>Enregistrer le brouillon<\/button>/)?.[0]).not.toContain('disabled=""');
    expect(markup.match(/<button\b[^>]*>Qualifications à J8 · brouillon conservé<\/button>/)?.[0]).toContain('disabled=""');
  });

  it("requires trimming an oversized draft before save or publication", () => {
    const markup = render(5, {}, ["rider-1", "rider-2", "rider-3", "rider-4"]);
    expect(markup).toContain("Votre brouillon dépasse le quota national");
    expect(markup.match(/<button\b[^>]*>Enregistrer le brouillon<\/button>/)?.[0]).toContain('disabled=""');
    expect(markup.match(/<button\b[^>]*>Soumettre aux DS<\/button>/)?.[0]).toContain('disabled=""');
  });
});
