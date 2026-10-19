import { beforeEach, describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
import * as proposals from "@/services/sponsor-proposals";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), affinity: vi.fn(), objectives: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/services/sponsor-team-affinity", () => ({ loadTeamSponsorCountryAffinity: mocks.affinity }));
vi.mock("@/services/persisted-sponsor-objectives", () => ({
  RIDER_RECRUITMENT_OBJECTIVE_OFFER_GENERATION_VERSION: 12,
  ensureAndLoadSponsorObjectives: mocks.objectives,
}));
import { getOrCreateFutureSponsorOffersForAuthUser, type FutureSponsorOfferRequest } from "./future-sponsor-offers";

const sponsors = SPONSORS.filter((sponsor) => sponsor.prestige === 1).slice(0, 4);
const registry = (key: string) => `registry-${key}`;
function offer(index: number) {
  return { id: `offer-${index}`, sponsor_id: registry(sponsors[index].id),
    budget_per_season: 123456 + index, base_budget_per_season: 100000 + index,
    negotiation_budget_ceiling: 200000, objective_difficulty: "ambitious",
    contract_duration_seasons: 2, status: "open", generation_version: 99 };
}
const request: FutureSponsorOfferRequest = {
  authUserId: "player", teamId: "team", currentContractId: "contract", mode: "renewal",
  activeSeason: { id: "s4", name: "S4", gameYear: 4, currentDayNumber: 25, startsOn: "2026-10-09", endsOn: "2026-11-05" },
  currentSponsorCatalogKey: sponsors[0].id, currentSponsorBudget: 100000,
  currentSponsorSatisfactionScore: 25, excludedSponsorCatalogKey: null,
};
function client(initial = [offer(0), offer(1), offer(2)]) {
  let offers = initial.map((row) => ({ ...row }));
  let refused = false, conflict = false;
  const inserts: Record<string, unknown>[][] = [], withdrawals: string[][] = [];
  const rpc = vi.fn(async () => ({ data: {
    contractId: "contract", sponsorId: registry(sponsors[0].id), averageSatisfaction: refused ? 25 : 60,
    minimumSatisfaction: 35, seasonsEvaluated: 2, reputationDiscount: 10, refused,
  }, error: null }));
  const from = vi.fn((table: string) => {
    const filters = new Map<string, unknown>();
    let mutation: "insert" | "update" | null = null, values: unknown;
    const response = () => {
      if (table === "sporting_directors") return { data: { id: "director", reputation_points: 1000, country_id: "country" }, error: null };
      if (table === "seasons") return { data: { id: "s5", name: "S5", game_year: 5, status: "planned", starts_on: "2026-11-06" }, error: null };
      if (table === "season_days") return { data: null, error: null };
      if (table === "team_seasons") return { data: { id: "team-season" }, error: null };
      if (table === "team_sponsor_contracts") return { data: [], error: null };
      if (table === "sponsors") {
        const all = SPONSORS.map((sponsor) => ({ id: registry(sponsor.id), catalog_key: sponsor.id }));
        return { data: all.filter((row) => filters.has("id") ? (filters.get("id") as string[]).includes(row.id) : (filters.get("catalog_key") as string[]).includes(row.catalog_key)), error: null };
      }
      if (table !== "sponsor_offers") throw Error(`Unexpected table ${table}`);
      if (mutation === "update") {
        const ids = filters.get("id") as string[];
        withdrawals.push(ids);
        offers = offers.map((row) => ids.includes(row.id) ? { ...row, status: "withdrawn" } : row);
        return { data: null, error: null };
      }
      if (mutation === "insert") {
        const incoming = values as Record<string, unknown>[];
        inserts.push(incoming);
        const created = incoming.map((row, index) => ({ ...row, id: `created-${inserts.length}-${index}` }));
        offers.push(...created as ReturnType<typeof offer>[]);
        if (conflict) { conflict = false; return { data: null, error: { code: "23505", message: "Other request inserted the same slots" } }; }
        return { data: created, error: null };
      }
      if (filters.has("neq-director")) return { data: [], error: null };
      return { data: offers.filter((row) => row.status === "open").map((row) => ({ ...row })), error: null };
    };
    const query = {
      select: vi.fn(), order: vi.fn(),
      upsert: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { filters.set(key, value); return query; }),
      neq: vi.fn(() => { filters.set("neq-director", true); return query; }),
      in: vi.fn((key: string, value: unknown) => { filters.set(key, value); return query; }),
      insert: vi.fn((value: unknown) => { mutation = "insert"; values = value; return query; }),
      update: vi.fn((value: unknown) => { mutation = "update"; values = value; return query; }),
      maybeSingle: vi.fn(async () => response()), returns: vi.fn(async () => response()),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response()).then(resolve),
    };
    query.select.mockReturnValue(query); query.order.mockReturnValue(query);
    return query;
  });
  mocks.admin.mockReturnValue({ from, rpc });
  return { rpc, from, inserts, withdrawals, rows: () => offers,
    refuse: (value: boolean) => { refused = value; }, conflict: () => { conflict = true; } };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  mocks.affinity.mockResolvedValue({ directorCountryCode: "FR", teamCountryCode: "FR", leaderCountryCodes: [], rosterMajorityCountryCode: null, preferredSponsorIds: [], internationalSchoolAffinities: [] });
  mocks.objectives.mockImplementation(async ({ offers }: { offers: { offerId: string }[] }) => new Map(offers.map((offer) => [offer.offerId, [{ id: `objective-${offer.offerId}`, targetDetails: {} }]])));
});
describe("future sponsor renewal and preserved alternatives", () => {
  it("stable visits add exactly one read RPC, no offer writes and no extra registry hydration", async () => {
    const db = client();
    const result = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(result.offers.map((row) => row.id)).toEqual(["offer-0", "offer-1", "offer-2"]);
    expect(result.renewalAssessment?.refused).toBe(false);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("get_sponsor_renewal_assessment", {
      p_contract_id: "contract", p_sporting_director_id: "director", p_target_season_id: "s5",
    });
    expect(db.from.mock.calls.filter(([table]) => table === "sponsors")).toHaveLength(1);
    expect(db.inserts).toEqual([]); expect(db.withdrawals).toEqual([]);
  });
  it("refusal withdraws only the unsigned renewal and fills one alternative; repeat visits are stable", async () => {
    const db = client(); db.refuse(true);
    const before = db.rows().slice(1).map((row) => ({ ...row }));
    const result = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(result.offers).toHaveLength(3); expect(result.offers.some((row) => row.isRenewal)).toBe(false);
    expect(db.withdrawals).toEqual([["offer-0"]]); expect(db.inserts[0]).toHaveLength(1);
    expect(db.rows().filter((row) => ["offer-1", "offer-2"].includes(row.id))).toEqual(before);
    expect(result.offers[0]).toMatchObject({ id: "offer-1", proposedBudget: 123457, objectiveDifficulty: "ambitious", objectives: [{ id: "objective-offer-1" }] });
    const again = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(again.offers.map((row) => row.id)).toEqual(result.offers.map((row) => row.id));
    expect(db.inserts).toHaveLength(1); expect(db.withdrawals).toHaveLength(1);
  });
  it("improving satisfaction reopens renewal as a fourth choice, without destroying negotiated alternatives", async () => {
    const db = client(); db.refuse(true);
    const refused = await getOrCreateFutureSponsorOffersForAuthUser(request);
    db.refuse(false);
    const reopened = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(reopened.offers).toHaveLength(4);
    expect(reopened.offers.filter((row) => !row.isRenewal)).toEqual(refused.offers);
    const again = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(again.offers).toEqual(reopened.offers); expect(db.inserts).toHaveLength(2);
    db.refuse(true);
    expect((await getOrCreateFutureSponsorOffersForAuthUser(request)).offers).toEqual(refused.offers);
    expect(db.inserts).toHaveLength(2);
  });
  it("first and replacement contracts do not request a renewal assessment", async () => {
    for (const mode of ["first-contract", "replacement"] as const) {
      const db = client([]);
      const result = await getOrCreateFutureSponsorOffersForAuthUser({ ...request, mode, currentContractId: null, currentSponsorCatalogKey: null });
      expect(result.offers).toHaveLength(3); expect(db.rpc).not.toHaveBeenCalled();
    }
  });
  it("does no database work before the J21 window", async () => {
    const db = client();
    await expect(getOrCreateFutureSponsorOffersForAuthUser({ ...request, activeSeason: { ...request.activeSeason, currentDayNumber: 20 } })).rejects.toThrow("jour 21");
    expect(db.from).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
  });
  it("reconciles a concurrent unique-slot insertion once without withdrawing alternatives", async () => {
    const db = client(); db.refuse(true); db.conflict();
    const result = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(result.offers).toHaveLength(3); expect(db.inserts).toHaveLength(1);
    expect(db.withdrawals).toEqual([["offer-0"]]); expect(db.rpc).toHaveBeenCalledTimes(2);
  });
  it("assessment failure never guesses refusal or withdraws an offer", async () => {
    const db = client(); db.rpc.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } } as never);
    await expect(getOrCreateFutureSponsorOffersForAuthUser(request)).rejects.toThrow("unavailable");
    expect(db.withdrawals).toEqual([]); expect(db.inserts).toEqual([]);
  });
  it("keeps two negotiated alternatives visible if no third sponsor is available", async () => {
    const db = client(); db.refuse(true);
    vi.spyOn(proposals, "generateSponsorProposals").mockReturnValueOnce([]);
    const result = await getOrCreateFutureSponsorOffersForAuthUser(request);
    expect(result.offers.map((offer) => offer.id)).toEqual(["offer-1", "offer-2"]);
    expect(db.inserts).toEqual([]); expect(db.withdrawals).toEqual([["offer-0"]]);
  });
});
