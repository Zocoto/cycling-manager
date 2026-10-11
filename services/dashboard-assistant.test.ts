import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getCurrentDashboardAssistantSummary } from "./dashboard-assistant";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

function client(payload: unknown) {
  const result = { data: null, error: null };
  const rpc = vi.fn((name: string) => {
    const response = name === "get_current_dashboard_assistant_summary"
      ? { data: { game_date: "2026-10-11", journal_items: payload }, error: null }
      : result;
    return Object.assign(Promise.resolve(response), { maybeSingle: vi.fn().mockResolvedValue(response) });
  });
  const from = vi.fn((table: string) => {
    if (!["team_infrastructures", "team_infrastructure_specializations"].includes(table)) {
      throw new Error(`Unexpected dashboard query: ${table}`);
    }
    return {
      select: () => ({
        gte: () => ({ returns: () => Promise.resolve({ data: [], error: null }) }),
        returns: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  });
  return { rpc, from, supabase: { rpc, from } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>> };
}

describe("dashboard physiotherapist payload", () => {
  it("reads the opportunity from the existing summary without an extra staff query", async () => {
    const mock = client({ physiotherapistOpportunity: { freeSlotCount: 4, unassignedRiderCount: 7 }, availableScoutCount: 2, items: [] });
    expect(await getCurrentDashboardAssistantSummary(mock.supabase)).toMatchObject({
      availablePhysiotherapistSlotCount: 4, ridersWithoutPhysiotherapistCount: 7, availableScoutCount: 2, journalItems: [],
    });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.from.mock.calls.map(call => call[0])).toEqual(["team_infrastructures", "team_infrastructure_specializations"]);
  });

  it.each([null, [], {}, { physiotherapistOpportunity: null }, { physiotherapistOpportunity: "invalid" }])("defaults absent/legacy opportunity to zero (%j)", async payload => {
    expect(await getCurrentDashboardAssistantSummary(client(payload).supabase)).toMatchObject({
      availablePhysiotherapistSlotCount: 0, ridersWithoutPhysiotherapistCount: 0,
    });
  });

  it("sanitizes counts rather than displaying an invalid alert", async () => {
    expect(await getCurrentDashboardAssistantSummary(client({ physiotherapistOpportunity: { freeSlotCount: -3, unassignedRiderCount: Infinity } }).supabase)).toMatchObject({
      availablePhysiotherapistSlotCount: 0, ridersWithoutPhysiotherapistCount: 0,
    });
  });

  it("targets the existing Kinés tab and its assignment matrix", () => {
    const page = readFileSync(new URL("../app/jeu/centre-de-soin/page.tsx", import.meta.url), "utf8");
    expect(page).toContain('code: "kines"');
    expect(page).toContain('activeTab === "kines"');
    expect(page).toContain("<PhysiotherapistAssignmentMatrix");
  });
});
