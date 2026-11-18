import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calendar: vi.fn(),
  due: vi.fn(),
  fill: vi.fn(),
  simulate: vi.fn(),
  synchronize: vi.fn(),
  existing: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ in: () => ({ returns: mocks.existing }) }) }),
  }),
}));
vi.mock("./race-calendar", () => ({
  getActiveSeasonRaceCalendar: mocks.calendar,
  getDueRaceJobEditionIds: mocks.due,
}));
vi.mock("./free-agent-detection", () => ({ settleFreeAgentDetectionForEditions: mocks.fill }));
vi.mock("./official-race-simulations", () => ({ ensureLockedOfficialRaceSimulations: mocks.simulate }));
vi.mock("./international-championship-selections", () => ({ syncDueNationalFederationChampionshipLineups: mocks.synchronize }));

import { selectRaceJobPack } from "@/lib/game/race-job-packs";
import { precomputeDueOfficialRaceSimulations } from "./race-simulation-runner";

const now = new Date("2026-11-18T12:55:00Z");
const departure = "2026-11-18T13:00:00Z";
const finalizedAt = "2026-11-18T07:00:00Z";

function createEdition(id: string, categoryCode: "local" | "regional" | "national" = "local") {
  return {
    id,
    slug: id,
    competitionType: "standard",
    categoryCode,
    registrationClosesAt: "2026-11-18T07:00:00Z",
    withdrawalClosesAt: "2026-11-18T07:00:00Z",
    detectionTeamsFinalizedAt: null as string | null,
    engagedRiderCount: 4,
    engagedRiders: [],
    stages: [{ id: `${id}-1`, stageNumber: 1, departureAt: departure, distanceKm: 120, status: "planned" }],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.existing.mockResolvedValue({ data: [], error: null });
  mocks.simulate.mockResolvedValue({});
});

describe("filling the startlist before its first official snapshot", () => {
  it("reloads fresh registrations, skips isolated pending/failed editions and allows a genuine shortage", async () => {
    const fresh = { ...createEdition("fresh"), engagedRiderCount: 1 };
    const regional = createEdition("regional", "regional");
    const failed = createEdition("failed");
    const pending = createEdition("pending");
    const shortage = createEdition("shortage");
    const finalized = { ...createEdition("finalized"), detectionTeamsFinalizedAt: finalizedAt };
    const national = createEdition("national", "national");
    const underway = {
      ...createEdition("underway"),
      stages: [
        { id: "underway-1", stageNumber: 1, departureAt: "2026-11-17T13:00:00Z", distanceKm: 115, status: "completed" },
        { id: "underway-2", stageNumber: 2, departureAt: departure, distanceKm: 115, status: "planned" },
      ],
    };
    const editions = [fresh, regional, failed, pending, shortage, finalized, national, underway];
    const ids = editions.map((edition) => edition.id);
    const refreshed = { ...fresh, detectionTeamsFinalizedAt: finalizedAt, engagedRiderCount: 25 };
    const refreshedRegional = { ...regional, detectionTeamsFinalizedAt: finalizedAt };
    mocks.due.mockResolvedValue(ids);
    mocks.calendar
      .mockResolvedValueOnce({ editions })
      .mockResolvedValueOnce({ editions: [refreshed, refreshedRegional, pending, shortage, finalized, national, underway] });
    mocks.fill.mockResolvedValue({ failedEditionIds: ["failed"], insufficientPoolEditionIds: ["shortage"] });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const result = await precomputeDueOfficialRaceSimulations(now, { maxEditions: ids.length });

      expect(mocks.fill).toHaveBeenCalledExactlyOnceWith(
        expect.anything(), ["failed", "fresh", "pending", "regional", "shortage"], now,
      );
      expect(mocks.fill.mock.invocationCallOrder[0]).toBeLessThan(mocks.calendar.mock.invocationCallOrder[1]);
      expect(mocks.calendar).toHaveBeenNthCalledWith(2, expect.anything(), new Date("2026-11-18T13:01:00Z"), expect.objectContaining({
        includeDetectionFinalization: true,
        raceEditionIds: ["underway", "finalized", "fresh", "national", "pending", "regional", "shortage"],
      }));
      expect(mocks.simulate).toHaveBeenCalledWith(expect.objectContaining({
        editions: [refreshed, refreshedRegional, shortage, finalized, national, underway],
      }), new Date("2026-11-18T13:01:00Z"));
      expect(warning).toHaveBeenCalledWith("free_agent_detection_pending_precompute", { editionIds: ["pending"] });
      expect(result).toMatchObject({ targetedEditions: 6, deferredEditions: 2 });
    } finally {
      warning.mockRestore();
    }
  });

  it("runs in its assigned precompute pack and leaves zero-participant editions untouched", async () => {
    const editions = Array.from({ length: 6 }, (_, index) => createEdition(`race-${index}`));
    const packItems = selectRaceJobPack({ items: editions, getId: (edition) => edition.id, packIndex: 1, packCount: 3, limit: 3 }).items;
    const [candidate, empty] = packItems;
    expect(candidate).toBeDefined();
    expect(empty).toBeDefined();
    const noParticipants = { ...empty, engagedRiderCount: 0 };
    mocks.due.mockResolvedValue([candidate!.id, noParticipants.id]);
    mocks.calendar.mockResolvedValueOnce({ editions: [candidate, noParticipants] }).mockResolvedValueOnce({ editions: [{ ...candidate, detectionTeamsFinalizedAt: finalizedAt }] });
    mocks.fill.mockResolvedValue({ failedEditionIds: [], insufficientPoolEditionIds: [] });

    await precomputeDueOfficialRaceSimulations(now, { packIndex: 1, packCount: 3 });

    expect(mocks.synchronize).not.toHaveBeenCalled();
    expect(mocks.fill).toHaveBeenCalledExactlyOnceWith(expect.anything(), [candidate!.id], now);
  });
});
