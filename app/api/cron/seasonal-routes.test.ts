import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  simulate: vi.fn(),
  settle: vi.fn(),
  selections: vi.fn(),
  admin: vi.fn(),
  from: vi.fn(),
  synchronize: vi.fn(),
  settleNational: vi.fn(),
}));

vi.mock("@/lib/security/cron-authorization", () => ({ isAuthorizedCronRequest: mocks.authorized }));
vi.mock("@/services/race-simulation-runner", () => ({ precomputeDueOfficialRaceSimulations: mocks.simulate }));
vi.mock("@/services/race-settlement-runner", () => ({ settleDueStandardRaceResults: mocks.settle }));
vi.mock("@/services/international-championship-selections", () => ({ processDueInternationalChampionshipSelections: mocks.selections }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/national-championships", () => ({ syncNationalChampionshipRegistrations: mocks.synchronize }));
vi.mock("@/services/national-championship-settlement-runner", () => ({ settleDueNationalChampionshipResults: mocks.settleNational }));

import { GET as simulate } from "./race-simulations/[slot]/route";
import { GET as settle } from "./race-settlements/[slot]/route";
import { GET as settleNational } from "./national-championship-settlements/[discipline]/route";

const request = (query = "") => new Request(`https://example.test/api/cron/job${query}`);
const slotParams = (slot: string) => ({ params: Promise.resolve({ slot }) });
const disciplineParams = (discipline: string) => ({ params: Promise.resolve({ discipline }) });
const routes = [
  { name: "simulations", run: (variant: string) => simulate(request(), slotParams(`early-${variant}-pre-p1`)) },
  { name: "settlements", run: (variant: string) => settle(request(), slotParams(`early-${variant}-10-p1`)) },
  { name: "national championships", run: (variant: string) => settleNational(request(), disciplineParams(`road-${variant}`)) },
];

function expectNoWork() {
  for (const mock of [mocks.simulate, mocks.settle, mocks.selections, mocks.admin, mocks.from, mocks.synchronize, mocks.settleNational]) {
    expect(mock).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T13:10:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.authorized.mockReturnValue(true);
  mocks.simulate.mockResolvedValue({ processedEditions: 0 });
  mocks.settle.mockResolvedValue({ processedStages: 0, completedEditions: 0, failedEditions: 0, targetedEditions: 0, deferredEditions: 0 });
  mocks.selections.mockResolvedValue({ processed: 0 });
  mocks.synchronize.mockResolvedValue(0);
  mocks.settleNational.mockResolvedValue({ failedEditions: 0 });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "season", current_day_number: 8 }, error: null }),
  };
  mocks.from.mockReturnValue(query);
  mocks.admin.mockReturnValue({ from: mocks.from });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(routes)("$name seasonal dispatch", ({ run }) => {
  it.each([
    ["2026-01-15T13:10:00Z", "summer"],
    ["2026-07-15T12:10:00Z", "winter"],
  ])("skips the inactive variant before database or gameplay work (%s)", async (timestamp, variant) => {
    vi.setSystemTime(new Date(timestamp));
    const response = await run(variant);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skipped: true, reason: "inactive-paris-time-variant" });
    expectNoWork();
  });

  it.each([
    ["2026-01-15T13:10:00Z", "winter"],
    ["2026-07-15T12:10:00Z", "summer"],
  ])("runs the active variant (%s)", async (timestamp, variant) => {
    vi.setSystemTime(new Date(timestamp));
    const response = await run(variant);
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("skipped");
    expect(mocks.simulate.mock.calls.length + mocks.settle.mock.calls.length + mocks.settleNational.mock.calls.length).toBe(1);
  });

  it("authenticates before deciding to skip an inactive job", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await run("summer")).status).toBe(401);
    expectNoWork();
  });
});

describe("cron validation and manual recovery", () => {
  it("validates pack and discipline parameters before seasonal skipping", async () => {
    expect((await simulate(request(), slotParams("early-summer-pre-p4"))).status).toBe(400);
    expect((await settle(request(), slotParams("early-summer-10-p4"))).status).toBe(400);
    expect((await settleNational(request(), disciplineParams("invalid-summer"))).status).toBe(400);
    expectNoWork();
  });

  it("authenticates before invalid parameter checks", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await simulate(request(), slotParams("early-summer-pre-p4"))).status).toBe(401);
    expect((await settle(request(), slotParams("early-summer-10-p4"))).status).toBe(401);
    expect((await settleNational(request(), disciplineParams("invalid-summer"))).status).toBe(401);
    expectNoWork();
  });

  it("rejects malformed manual race targets before skipping", async () => {
    expect((await settle(request("?race=invalid_slug"), slotParams("early-summer-10-p1"))).status).toBe(400);
    expectNoWork();
  });

  it("runs a valid targeted settlement across seasonal variants without global selections", async () => {
    const response = await settle(request("?race=tour-de-france"), slotParams("early-summer-10-p1"));
    expect(response.status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ raceSlug: "tour-de-france" }));
    expect(mocks.selections).not.toHaveBeenCalled();
  });

  it("keeps generic, legacy and unconditional recovery jobs active", async () => {
    await simulate(request(), slotParams("early-pre-p1"));
    await settle(request(), slotParams("early-recovery"));
    await settleNational(request(), disciplineParams("road-recovery"));
    expect(mocks.simulate).toHaveBeenCalledOnce();
    expect(mocks.settle).toHaveBeenCalledOnce();
    expect(mocks.settleNational).toHaveBeenCalledOnce();
    expect(mocks.synchronize).not.toHaveBeenCalled();
  });
});
