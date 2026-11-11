import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildDashboardAssistantLines } from "@/lib/game/dashboard-assistant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentDashboardAssistantSummary, getCurrentDashboardAssistantSummaries } from "./dashboard-assistant";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDashboardHalloweenEdition } from "./dashboard-halloween";

vi.mock("./dashboard-halloween", () => ({ getDashboardHalloweenEdition: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const authUserId = "00000000-0000-4000-8000-000000000001";

function client(payload: unknown, federationEquipment = false) {
  const result = { data: null, error: null };
  const rpc = vi.fn((name: string) => {
    const response = name === "get_current_dashboard_assistant_summary"
      ? { data: { game_date: "2026-10-11", journal_items: payload }, error: null }
      : name === "get_current_federation_equipment_alert" && federationEquipment
        ? { data: { selection_required: true, country_code: "BE" }, error: null }
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

describe("first-season dashboard alerts", () => {
  it.each([false, true])("shows advanced alerts only with a completed season of experience (%s)", async (experienced) => {
    const mock = client({
      developmentTeamSetup: { required: true, currentDayNumber: 3 },
      developmentRaceRegistrationReminder: {
        count: 1,
        nextName: "Course junior",
        nextEditionId: "00000000-0000-4000-8000-000000000002",
      },
      equipmentPartnerSignatureAvailable: true,
    }, true);
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: experienced ? { id: "past-assignment" } : null, error: null }),
    };
    const from = vi.fn().mockReturnValue(query);
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({ from } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const { initial, complete } = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
    for (const [snapshot, enriched] of [[await initial, false], [await complete, true]] as const) {
      const { alerts } = buildDashboardAssistantLines({ snapshot: snapshot!, rewardCount: 0, cashBalance: null });
      const ids = alerts.map(({ id }) => id);
      expect(ids.includes("development-team-setup")).toBe(experienced);
      expect(ids.includes("development-race-registration-reminder")).toBe(experienced);
      expect(ids.includes("federation-equipment-selection")).toBe(experienced && enriched);
      expect(ids).toContain("equipment-partner-signature");
    }
    expect(from).toHaveBeenCalledExactlyOnceWith("team_manager_assignments");
    expect(query.eq.mock.calls).toEqual([
      ["director.auth_user_id", authUserId],
      ["start_season.status", "completed"],
      ["role", "general_manager"],
    ]);
    expect(query.in).toHaveBeenCalledExactlyOnceWith("status", ["active", "completed", "terminated"]);
    expect(query.limit).toHaveBeenCalledExactlyOnceWith(1);
  });
});

describe("dashboard physiotherapist payload", () => {
  it("includes actual camp gains in both summaries without adding any request", async () => {
    const formCampReport = { dayNumber: 25, riderCount: 2, totalFormGain: 15 };
    const mock = client({ formCampReport, items: [] });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
    expect(await summaries.initial).toMatchObject({ formCampReport });
    expect(await summaries.complete).toMatchObject({ formCampReport });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.rpc.mock.calls.filter(call => call[0] === "get_current_dashboard_assistant_summary")).toHaveLength(1);
    expect(mock.from).toHaveBeenCalledTimes(2);
  });

  it("loads an eligible federation vote from the existing first dashboard response", async () => {
    const closesAt = "2026-11-10T18:00:00+00:00";
    const mock = client({ federationVoteReminder: { countryCode: "be", closesAt }, items: [] });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
    const federationVoteReminder = { countryCode: "BE", closesAt };
    expect(await summaries.initial).toMatchObject({ federationVoteReminder });
    expect(await summaries.complete).toMatchObject({ federationVoteReminder });
    expect(mock.rpc).toHaveBeenCalledTimes(7);
    expect(mock.rpc.mock.calls.filter(call => call[0] === "get_current_dashboard_assistant_summary")).toHaveLength(1);
  });

  it("reads the CN reminder with the existing dashboard summary", async () => {
    const closesAt = "2026-12-04T00:00:00+01:00";
    const mock = client({ nationalChampionshipRouteReminder: { countryCode: "fr", closesAt, targetGameYear: 6 } });
    const summary = await getCurrentDashboardAssistantSummary(mock.supabase, { enrich: false });
    expect(summary?.nationalChampionshipRouteReminder).toEqual({ countryCode: "FR", closesAt, targetGameYear: 6 });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([null, [], {}, { federationVoteReminder: null },
    { federationVoteReminder: { countryCode: "../be", closesAt: "2026-11-10T18:00:00Z" } },
    { federationVoteReminder: { countryCode: "BE", closesAt: "invalid" } },
  ])("does not show an election from absent, legacy or malformed payloads (%j)", async payload => {
    const mock = client(payload);
    const summary = await getCurrentDashboardAssistantSummary(mock.supabase, { enrich: false });
    expect(summary).toMatchObject({ federationVoteReminder: null });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([null, [], {}, { formCampReport: "invalid" },
    { formCampReport: { dayNumber: 0, riderCount: 1, totalFormGain: 5 } },
    { formCampReport: { dayNumber: 29, riderCount: 1, totalFormGain: 5 } },
    { formCampReport: { dayNumber: 2, riderCount: 0, totalFormGain: 0 } },
    { formCampReport: { dayNumber: 2, riderCount: 1, totalFormGain: -1 } },
    { formCampReport: { dayNumber: 2, riderCount: 1, totalFormGain: Infinity } },
    { formCampReport: { dayNumber: 2, riderCount: 1, totalFormGain: 101 } },
  ])("omits missing, legacy or invalid camp report summaries (%j)", async payload => {
    expect(await getCurrentDashboardAssistantSummary(client(payload).supabase)).toMatchObject({ formCampReport: null });
  });

  it("keeps a real camp report when the rider was already at maximum form", async () => {
    const formCampReport = { dayNumber: 2, riderCount: 1, totalFormGain: 0 };
    expect(await getCurrentDashboardAssistantSummary(client({ formCampReport }).supabase)).toMatchObject({ formCampReport });
  });

  it("preserves fractional actual gains from the numeric condition ledger", async () => {
    const formCampReport = { dayNumber: 25, riderCount: 2, totalFormGain: 11.1 };
    expect(await getCurrentDashboardAssistantSummary(client({ formCampReport }).supabase)).toMatchObject({ formCampReport });
  });

  it("exposes empty-roster recovery in the first summary without another request", async () => {
    const mock = client({ emptyRosterRecoveryAvailable: true, items: [] });
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
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
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
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
    const summaries = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
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

  it("loads actionable staff courses in both assistant summaries from the shared core request", async () => {
    const staffAcademyOpportunity = { freeSlotCount: 2, eligibleMemberCount: 3 };
    const mock = client({ staffAcademyOpportunity });
    const { initial, complete } = getCurrentDashboardAssistantSummaries(mock.supabase, authUserId);
    expect(await initial).toMatchObject({ staffAcademyOpportunity });
    expect(await complete).toMatchObject({ staffAcademyOpportunity });
    expect(mock.rpc.mock.calls.filter(([name]) => name === "get_current_dashboard_assistant_summary")).toHaveLength(1);
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
