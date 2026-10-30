import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getCurrentDashboardAssistantSummary, getCurrentDashboardAssistantSummaries } from "./dashboard-assistant";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardHalloweenEdition } from "./dashboard-halloween";

vi.mock("./dashboard-halloween", () => ({ getDashboardHalloweenEdition: vi.fn().mockResolvedValue(null) }));

function client(payload: unknown) {
  const result = { data: null, error: null };
  const rpc = vi.fn((name: string) => {
    const response = name === "get_current_dashboard_assistant_summary"
      ? { data: { game_date: "2026-10-11", journal_items: payload }, error: null }
      : result;
    const query = Object.assign(Promise.resolve(response), { maybeSingle: vi.fn().mockResolvedValue(response), abortSignal: vi.fn() });
    query.abortSignal.mockReturnValue(query);
    return query;
  });
  const from = vi.fn((table: string) => {
    if (!["team_infrastructures", "team_infrastructure_specializations"].includes(table)) {
      throw new Error(`Unexpected dashboard query: ${table}`);
    }
    const query = { select: vi.fn(), gte: vi.fn(), abortSignal: vi.fn(), returns: () => Promise.resolve({ data: [], error: null }) };
    query.select.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.abortSignal.mockReturnValue(query);
    return query;
  });
  return { rpc, from, supabase: { rpc, from } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>> };
}

describe("dashboard physiotherapist payload", () => {
  it("exposes empty-roster recovery in the first summary without another request", async () => {
    const mock = client({ emptyRosterRecoveryAvailable: true, items: [] });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase);
    expect(await summaries.initial).toMatchObject({ emptyRosterRecoveryAvailable: true });
    expect(await summaries.complete).toMatchObject({ emptyRosterRecoveryAvailable: true });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.rpc.mock.calls.filter(call => call[0] === "get_current_dashboard_assistant_summary")).toHaveLength(1);
    expect(mock.from.mock.calls.map(call => call[0])).toEqual(["team_infrastructures", "team_infrastructure_specializations"]);
  });

  it.each([null, [], {}, { emptyRosterRecoveryAvailable: null }, { emptyRosterRecoveryAvailable: "true" }, { emptyRosterRecoveryAvailable: 1 }, { emptyRosterRecoveryAvailable: false }])("does not invent a recovery option from absent, legacy, or malformed metadata (%j)", async payload => {
    expect(await getCurrentDashboardAssistantSummary(client(payload).supabase)).toMatchObject({ emptyRosterRecoveryAvailable: false });
  });

  it("includes the shared Halloween deadline only in the enriched assistant", async () => {
    vi.mocked(getDashboardHalloweenEdition).mockResolvedValueOnce({ id: "halloween-2026", shopEndsAt: "2026-11-05T23:00:00Z" });
    const mock = client({ items: [] });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase);
    expect(await summaries.initial).toMatchObject({ halloweenShopEndsAt: null });
    expect(await summaries.complete).toMatchObject({ halloweenShopEndsAt: "2026-11-05T23:00:00Z" });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
  it("reads individual naturalizations in the existing request without extra queries", async () => {
    const target = { subjectType: "youth", subjectId: "00000000-0000-4000-8000-000000000001",
      targetCountryId: "00000000-0000-4000-8000-000000000002", name: "Junior Test", currentCountryName: "France",
      targetCountryName: "Belgique", elapsedDays: 28, requiredDays: 28 };
    const mock = client({ naturalizationAlerts: [target, target, { ...target, elapsedDays: 27 },
      { ...target, subjectId: "invalid" }, { ...target, subjectType: "staff" }, null] });
    expect(await getCurrentDashboardAssistantSummary(mock.supabase)).toMatchObject({ naturalizationAlerts: [target] });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.from).toHaveBeenCalledTimes(2);
  });

  it.each([null, [], {}, { naturalizationAlerts: null }, { naturalizationAlerts: "invalid" }])("defaults legacy naturalization metadata to no alert (%j)", async payload => {
    expect(await getCurrentDashboardAssistantSummary(client(payload).supabase)).toMatchObject({ naturalizationAlerts: [] });
  });

  it("does not wait for slow supplemental RPCs or issue the core request twice", async () => {
    const mock = client({ physiotherapistOpportunity: { freeSlotCount: 4, unassignedRiderCount: 7 } });
    const rpc = mock.rpc.getMockImplementation()!;
    let finish!: (result: { data: null; error: null }) => void;
    const pending = new Promise<{ data: null; error: null }>((resolve) => { finish = resolve; });
    mock.rpc.mockImplementation(name => {
      if (name !== "get_current_sponsoring_alerts") return rpc(name);
      const query = Object.assign(pending, { maybeSingle: vi.fn(() => pending), abortSignal: vi.fn() });
      query.abortSignal.mockReturnValue(query);
      return query;
    });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase);
    try {
      expect(await summaries.initial).toMatchObject({ availablePhysiotherapistSlotCount: 4 });
      expect(mock.rpc.mock.calls.filter(call => call[0] === "get_current_dashboard_assistant_summary")).toHaveLength(1);
    } finally {
      finish({ data: null, error: null });
    }
    expect(await summaries.complete).toMatchObject({ availablePhysiotherapistSlotCount: 4 });
  });
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
