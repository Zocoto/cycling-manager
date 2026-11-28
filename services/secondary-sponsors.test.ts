import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ createAdmin: vi.fn(), affinity: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mock.createAdmin }));

vi.mock("@/services/sponsor-team-affinity", () => ({ loadTeamSponsorCountryAffinity: mock.affinity }));
vi.mock("@/services/sponsor-objective-sporting-context", () => ({ loadSponsorObjectiveSportingContext: mock.snapshot }));

import { getSecondarySponsoringStateForAuthUser } from "./secondary-sponsors";
import { SPONSORS } from "@/data/sponsors";
import { getSecondarySponsorFailurePenalty } from "@/lib/game/secondary-sponsor";

function libraryRow(key: string, id: string, countryId: string, prestige = 1): Row {
  const brand = SPONSORS.find(sponsor => sponsor.id === key);
  if (!brand) throw Error("Missing library test brand: " + key);
  return { id, catalog_key: "library-" + key, source_sponsor_id: "source-" + key, available_for_offers: true,
    country_id: countryId, name: brand.name, prestige, primary_color: brand.colors.primary, accent_color: brand.colors.accent, logo_variant: "wordmark" };
}

type Row = Record<string, unknown>;
type Filter = { kind: string; column: string; value: unknown };
type QueryRecord = {
  table: string;
  filters: Filter[];
  orderBy?: { column: string; ascending: boolean };
  range?: [number, number];
  limit?: number;
  inserted?: Row[];
};
type Result = { data: Row[] | Row | null; error: { code?: string; message: string } | null };

function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function objective(offerId: string, index: number): Row {
  return {
    id: `${offerId}-objective-${index}`, offer_id: offerId, display_order: index + 1,
    race_edition_id: uuid(5_000 + index),
    race_slug: `existing-${offerId}-${index}`, race_label: `Existing race ${index}`,
    race_category_code: "national", target_rank: 8, cash_reward: 12_345 + index,
    status: "draft", best_rank: null,
  };
}

function fixture(raceCount = 6) {
  const queries: QueryRecord[] = [];
  const inserts: Array<{ table: string; rows: Row[] }> = [];
  const tables: Record<string, Row[]> = {
    sporting_directors: [{ id: "director", auth_user_id: "user", status: "active", reputation_points: 2_500, country_id: "be" }],
    team_manager_assignments: [{ sporting_director_id: "director", team_id: "team", role: "general_manager", status: "active", created_at: "2026-10-01" }],
    teams: [{ id: "team", home_country_id: "be" }],
    seasons: [
      { id: "s4", game_year: 4, name: "Saison 4", status: "active", current_day_number: 21 },
      { id: "s5", game_year: 5, name: "Saison 5", status: "planned", current_day_number: 1 },
    ],
    countries: [{ id: "be", name: "Belgique", iso_alpha2: "BE" }],
    secondary_sponsor_contracts: [],
    secondary_sponsor_offers: ["a", "b", "c"].map((key) => ({
      id: `offer-${key}`, secondary_sponsor_id: `sponsor-${key}`, sporting_director_id: "director",
      team_id: "team", target_season_id: "s5", status: "open", generation_version: 1, principal_country_id: "be",
      principal_budget_per_season: 2_000_000, maximum_reward_budget: 600_000,
    })),
    secondary_sponsor_catalog: ["ardennes-outillage", "brassel-foods", "nordika-glass"].map((key, index) => libraryRow(key, `sponsor-${["a", "b", "c"][index]}`, "be")),
    secondary_sponsor_objectives: [],
    race_categories: ["national", "continental", "world", "elite"].map(code => ({id: code, code})),
    race_editions: Array.from({ length: raceCount }, (_, index) => ({
      id: uuid(10_000 + index), race_id: uuid(index),
      race_category_id: "continental", season_id: "s5", display_name: `Race ${index}`,
      registration_policy: "open", minimum_reputation: 0, status: "planned",
    })),
    races: Array.from({ length: raceCount }, (_, index) => ({
      id: uuid(index), country_id: index >= raceCount - 3 ? "be" : "fr",
      slug: `race-${index}`, status: "active",
    })),
  };
  const state = {
    failCalendar: false,
    failRaceId: "",
    activeRaceRequests: 0,
    maxActiveRaceRequests: 0,
    rosterSize: 30, principalSponsorId: "another-principal" as string | null, principalCountryId: "be" as string | null, principalBudgetPerSeason: 2_000_000 as number | null,
    beforeReplace: null as (() => void) | null,
  };

  const from = vi.fn((table: string) => {
    const record: QueryRecord = { table, filters: [] };
    queries.push(record);
    const filter = (kind: string, column: string, value: unknown) => {
      record.filters.push({ kind, column, value });
      return query;
    };
    const execute = async (single = false): Promise<Result> => {
      if (record.inserted) {
        inserts.push({ table, rows: structuredClone(record.inserted) });
        tables[table] ??= [];
        tables[table].push(...record.inserted.map((row, index) => ({
          id: `inserted-${inserts.length}-${index}`, status: "draft", best_rank: null, ...row,
        })));
        return { data: null, error: null };
      }
      if (state.failCalendar && ["race_editions", "races", "race_categories"].includes(table)) {
        return { data: null, error: { message: "Calendar unavailable" } };
      }
      const reputationFilter = record.filters.find((entry) => entry.kind === "lte" && entry.column === "minimum_reputation");
      if (table === "race_editions" && reputationFilter && !Number.isInteger(reputationFilter.value)) {
        return { data: null, error: { code: "22P02", message: `invalid input syntax for type integer: "${reputationFilter.value}"` } };
      }
      const idFilter = record.filters.find((entry) => entry.kind === "in" && entry.column === "id");
      if (table === "races" && Array.isArray(idFilter?.value) && idFilter.value.length > 75) {
        return { data: null, error: { message: "URI too long: more than 75 UUIDs" } };
      }
      const isRaceRequest = table === "races";
      if (isRaceRequest) {
        state.activeRaceRequests++;
        state.maxActiveRaceRequests = Math.max(state.maxActiveRaceRequests, state.activeRaceRequests);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      try {
        if (table === "races" && state.failRaceId && Array.isArray(idFilter?.value) && idFilter.value.includes(state.failRaceId)) {
          return { data: null, error: { message: "One relation batch failed" } };
        }
        let rows = [...(tables[table] ?? [])].filter((row) => record.filters.every(({ kind, column, value }) => {
          if (kind === "eq") return row[column] === value;
          if (kind === "neq") return row[column] !== value;
          if (kind === "in") return (value as unknown[]).includes(row[column]);
          if (kind === "lte") return row[column] !== null && row[column] !== undefined && Number(row[column]) <= Number(value);
          if (kind === "not-null") return row[column] !== null && row[column] !== undefined;
          return true;
        }));
        const orderBy = record.orderBy;
        if (orderBy) rows.sort((a, b) => String(a[orderBy.column]).localeCompare(String(b[orderBy.column])) * (orderBy.ascending ? 1 : -1));
        const [start, end] = record.range ?? [0, 999];
        rows = rows.slice(start, Math.min(end + 1, start + 1_000));
        if (record.limit !== undefined) rows = rows.slice(0, record.limit);
        return { data: single ? rows[0] ?? null : rows, error: null };
      } finally {
        if (isRaceRequest) state.activeRaceRequests--;
      }
    };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => filter("eq", column, value),
      neq: (column: string, value: unknown) => filter("neq", column, value),
      in: (column: string, value: unknown[]) => filter("in", column, value),
      lte: (column: string, value: unknown) => filter("lte", column, value),
      not: (column: string, operator: string, value: unknown) => filter(operator === "is" && value === null ? "not-null" : "not", column, value),
      order: (column: string, options?: { ascending?: boolean }) => {
        record.orderBy = { column, ascending: options?.ascending !== false };
        return query;
      },
      range: (start: number, end: number) => { record.range = [start, end]; return query; },
      limit: (value: number) => { record.limit = value; return query; },
      insert: (values: Row | Row[]) => { record.inserted = Array.isArray(values) ? values : [values]; return query; },
      maybeSingle: () => execute(true),
      returns: () => execute(),
      then: (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => execute().then(resolve, reject),
    };
    return query;
  });
  const rpcCalls: Array<{ name: string; args: Row }> = [];
  const rpc = vi.fn(async (name: string, args: Row) => {
    rpcCalls.push({name,args});
    if (name === "get_secondary_sponsor_offer_context") return { data: {roster_size:state.rosterSize,roster_country_counts:{be:state.rosterSize},principal_country_id:state.principalCountryId,principal_budget_per_season:state.principalBudgetPerSeason,principal_sponsor_id:state.principalSponsorId},error:null };
    if (name !== "replace_secondary_sponsor_offers") throw Error("Unexpected RPC: " + name);
    state.beforeReplace?.();
    const belongsToTeam = (offer: Row) => offer.team_id === args.p_team_id && offer.sporting_director_id === args.p_director_id && offer.target_season_id === args.p_target_season_id;
    if (tables.secondary_sponsor_offers.some(offer => belongsToTeam(offer) && offer.status === "accepted")) return {data:false,error:null};
    if (tables.secondary_sponsor_offers.filter(offer => belongsToTeam(offer) && offer.status === "open" && Number(offer.generation_version)>=4).length===3) return {data:false,error:null};
    const proposals = args.p_offers as Array<{ secondary_sponsor_id:string;objectives:Row[] }>;
    tables.secondary_sponsor_offers = proposals.map((offer,index)=>({id:"generated-"+index,secondary_sponsor_id:offer.secondary_sponsor_id,
      sporting_director_id:args.p_director_id,team_id:args.p_team_id,target_season_id:args.p_target_season_id,status:"open",generation_version:4,principal_country_id:state.principalCountryId,
      principal_budget_per_season:state.principalBudgetPerSeason,maximum_reward_budget:offer.objectives.reduce((sum,goal)=>sum+Math.round(Number(goal.cash_reward)*100),0)/100}));
    tables.secondary_sponsor_objectives = proposals.flatMap((offer,index)=>offer.objectives.map((goal,order)=>({
      id:"generated-"+index+"-"+order,offer_id:"generated-"+index,display_order:order+1,status:"draft",best_rank:null,
      current_rider_count:0,reputation_penalty:0,...goal,
    })));
    return {data:true,error:null};
  });
  mock.affinity.mockResolvedValue({teamCountryCode:"BE",directorCountryCode:"BE",leaderCountryCodes:["BE"],rosterMajorityCountryCode:"BE",internationalSchoolAffinities:[],preferredSponsorIds:[]});
  mock.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"continental",projectedDivision:"continental",projectedRank:80},teamRiderCandidates:[]});
  mock.createAdmin.mockReturnValue({ from,rpc });
  return { tables, queries, inserts, state, from,rpcCalls };
}

beforeEach(() => vi.clearAllMocks());

describe("secondary sponsor calendar resilience", () => {
  it("does not offer the same brand as the principal sponsor", async () => {
    const f=fixture(9);
    f.state.principalSponsorId="source-ardennes-outillage";
    f.tables.secondary_sponsor_catalog.push(libraryRow("veloria-bank","canonical-extra","be"));
    const result=await getSecondarySponsoringStateForAuthUser("user");
    if(result?.kind!=="offers") throw Error("Expected offers");
    expect(result.offers).toHaveLength(3);
    expect(result.offers.some(offer=>offer.sponsor.name==="Ardennes Outillage")).toBe(false);
  });
  it("replaces the three country clones with three real brands and their existing logos", async () => {
    const f = fixture(9);
    f.tables.countries.push({id:"tz",name:"Tanzanie",iso_alpha2:"TZ"},{id:"mz",name:"Mozambique",iso_alpha2:"MZ"});
    f.tables.secondary_sponsor_catalog.forEach((row,index) => {
      row.name="TerraNova"; row.country_id=["be","tz","mz"][index];
      row.catalog_key="secondary-"+["be","tz","mz"][index]+"-9";
      row.source_sponsor_id=null; row.available_for_offers=false;
    });
    f.tables.secondary_sponsor_offers.forEach(row => { row.generation_version=2; });
    f.tables.secondary_sponsor_catalog.push(libraryRow("lumen-energy","canonical-be","be",5),
      libraryRow("uhuru-baobab-charge","canonical-tz","tz",3),libraryRow("cabo-graphite","canonical-mz","mz",4));
    mock.affinity.mockResolvedValue({teamCountryCode:"BE",directorCountryCode:"BE",leaderCountryCodes:["TZ","MZ"],rosterMajorityCountryCode:"BE",internationalSchoolAffinities:[],preferredSponsorIds:[]});
    mock.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"elite",projectedDivision:"elite",projectedRank:4},teamRiderCandidates:[]});
    f.tables.race_editions.forEach(row => { row.race_category_id="world"; });
    const result=await getSecondarySponsoringStateForAuthUser("user");
    if(result?.kind!=="offers") throw Error("Expected real secondary offers");
    expect(result.offers.map(offer=>offer.sponsor.countryCode)).toEqual(["BE","TZ","MZ"]);
    expect(new Set(result.offers.map(offer=>offer.sponsor.name)).size).toBe(3);
    for(const offer of result.offers) {
      expect(offer.sponsor.name).not.toBe("TerraNova");
      expect(SPONSORS.some(brand=>brand.name===offer.sponsor.name && brand.countryCode===offer.sponsor.countryCode && brand.logoPath===offer.sponsor.logoPath)).toBe(true);
      expect(offer.totalMaximumReward).toBeGreaterThan(0);
      expect(offer.maximumRewardBudget).toBe(offer.totalMaximumReward);
    }
    expect(new Set(result.offers.map(offer => offer.totalMaximumReward)).size).toBe(3);
    expect(f.queries.some(query=>query.table==="secondary_sponsor_catalog" && query.filters.some(filter=>filter.column==="available_for_offers" && filter.value===true))).toBe(true);
    expect(f.rpcCalls.filter(call=>call.name==="replace_secondary_sponsor_offers")).toHaveLength(1);
  });

  it.each(["1569.26", 1569.26, 1569.99, 1500.01, 1570])("accepts reputation %s without rounding up an integer race threshold", async (reputation) => {
    const f = fixture(8);
    f.tables.sporting_directors[0].reputation_points = reputation;
    for (let index = 0; index < 3; index++) f.tables.race_editions[index].minimum_reputation = 1500;
    f.tables.race_editions[3].minimum_reputation = 1570;
    f.tables.race_editions[4].minimum_reputation = 1569;
    f.tables.race_editions[5].minimum_reputation = 1569;
    f.tables.race_editions[6].minimum_reputation = 1569;
    f.tables.race_editions[7].minimum_reputation = 1570;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    const bound = f.queries.find((query) => query.table === "race_editions")?.filters.find((entry) => entry.kind === "lte" && entry.column === "minimum_reputation")?.value;
    expect(bound).toBe(Math.floor(Number(reputation)));
    const requestedRaceIds = f.queries.filter((query) => query.table === "races").flatMap((query) => query.filters.filter((entry) => entry.kind === "in" && entry.column === "id").flatMap((entry) => entry.value as string[]));
    const expected = f.tables.race_editions.filter((edition) => Number(edition.minimum_reputation) <= Number(reputation)).map((edition) => edition.race_id);
    expect([...new Set(requestedRaceIds)].sort()).toEqual(expected.sort());
    expect(f.tables.sporting_directors[0].reputation_points).toBe(reputation);
  });

  it("keeps a reputation below 1500 locked without querying the calendar", async () => {
    const f = fixture();
    f.tables.sporting_directors[0].reputation_points = "1499.99";
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state).toMatchObject({ kind: "reputation-locked", currentReputation: 1499.99 });
    expect(f.queries.some((query) => query.table === "race_editions")).toBe(false);
    expect(f.inserts).toEqual([]);
  });

  it("pages a growing calendar and bounds UUID relation batches and concurrency", async () => {
    const f = fixture(1_203);
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    if (state?.kind !== "offers") throw Error("Expected secondary offers");
    expect(state.offers).toHaveLength(3);
    // Same-category domestic races beyond row 1,000 remain visible after pagination.
    for (const offer of state.offers) {
      expect(offer.objectives.map((entry) => entry.raceSlug).sort()).toEqual(["race-1200", "race-1201", "race-1202"]);
      for (const entry of offer.objectives) {
        const edition = f.tables.race_editions.find((candidate) => candidate.display_name === entry.raceLabel);
        expect(edition?.season_id).toBe("s5");
        expect(entry.raceEditionId).toBe(edition?.id);
      }
    }
    const editionReads = f.queries.filter((query) => query.table === "race_editions");
    expect(editionReads.length).toBeGreaterThan(1);
    expect(editionReads.every((query) => query.orderBy?.column === "id" && query.range !== undefined)).toBe(true);
    const raceReads = f.queries.filter((query) => query.table === "races");
    expect(raceReads.length).toBeGreaterThan(1);
    expect(raceReads.every((query) => query.filters.some((entry) => entry.kind === "in" && Array.isArray(entry.value) && entry.value.length <= 75))).toBe(true);
    expect(f.state.maxActiveRaceRequests).toBe(1);
    expect(f.inserts).toEqual([]);
    expect(f.rpcCalls.filter(call => call.name === "replace_secondary_sponsor_offers")).toHaveLength(1);
    expect(f.queries.some((query) => query.table === "team_sponsor_contracts")).toBe(false);
  });

  it("loads existing proposals without a calendar or a signed primary sponsor", async () => {
    const f = fixture();
    const existing = ["offer-a", "offer-b", "offer-c"].flatMap((id) => Array.from({ length: 3 }, (_, index) => objective(id, index)));
    f.tables.secondary_sponsor_objectives = structuredClone(existing);
    f.tables.secondary_sponsor_offers.forEach(offer => { offer.generation_version=4; });
    f.state.failCalendar = true;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    if (state?.kind !== "offers") throw Error("Expected secondary offers");
    expect(state.offers.flatMap((offer) => offer.objectives.map((entry) => entry.cashReward))).toEqual(existing.map((entry) => entry.cash_reward));
    expect(state.offers.flatMap((offer) => offer.objectives.map((entry) => entry.raceEditionId))).toEqual(existing.map((entry) => entry.race_edition_id));
    expect(f.tables.secondary_sponsor_objectives).toEqual(existing);
    expect(f.queries.some((query) => ["race_editions", "races", "race_categories", "team_sponsor_contracts"].includes(query.table))).toBe(false);
    expect(f.inserts).toEqual([]);
    expect(f.rpcCalls).toEqual([]);
    expect(mock.affinity).not.toHaveBeenCalled();
    expect(mock.snapshot).not.toHaveBeenCalled();
  });

  it("refreshes obsolete offers atomically without leaving a partially regenerated set", async () => {
    const f=fixture();
    f.tables.secondary_sponsor_objectives=["offer-a","offer-b"].flatMap(id=>Array.from({length:3},(_,index)=>objective(id,index)));
    const result=await getSecondarySponsoringStateForAuthUser("user");
    expect(result?.kind).toBe("offers");
    expect(f.rpcCalls.filter(call=>call.name==="replace_secondary_sponsor_offers")).toHaveLength(1);
    expect(f.tables.secondary_sponsor_offers).toHaveLength(3);
    expect(f.tables.secondary_sponsor_offers.every(offer=>offer.generation_version===4)).toBe(true);
    expect(f.tables.secondary_sponsor_objectives).toHaveLength(9);
    expect(f.inserts).toEqual([]);
  });

  it("does not generate partial objectives when a later relation batch fails", async () => {
    const f = fixture(160);
    f.state.failRaceId = uuid(80);
    await expect(getSecondarySponsoringStateForAuthUser("user")).rejects.toThrow();
    expect(f.inserts).toEqual([]);
    expect(f.tables.secondary_sponsor_objectives).toEqual([]);
  });

  it("does not send empty IN filters when the season has no eligible race", async () => {
    const f = fixture();
    f.tables.race_editions.forEach((row) => { row.registration_policy = "closed"; });
    await expect(getSecondarySponsoringStateForAuthUser("user")).rejects.toThrow();
    expect(f.queries.some((query) => query.table === "races")).toBe(false);
    expect(f.queries.some((query) => query.filters.some((entry) => entry.kind === "in" && Array.isArray(entry.value) && entry.value.length === 0))).toBe(false);
    expect(f.inserts).toEqual([]);
  });

  it("filters inaccessible, closed and cancelled editions before loading their relations", async () => {
    const f = fixture(7);
    f.tables.race_editions[3].registration_policy = "closed";
    f.tables.race_editions[4].status = "cancelled";
    f.tables.race_editions[5].minimum_reputation = 3_000;
    f.tables.race_editions[6].minimum_reputation = null;
    const state = await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("offers");
    const requestedRaceIds = f.queries.filter((query) => query.table === "races").flatMap((query) => query.filters.filter((entry) => entry.kind === "in" && entry.column === "id").flatMap((entry) => entry.value as string[]));
    expect([...new Set(requestedRaceIds)].sort()).toEqual([uuid(0), uuid(1), uuid(2)]);
    expect(f.tables.secondary_sponsor_objectives.every(row => ["race-0", "race-1", "race-2"].includes(String(row.race_slug)))).toBe(true);
  });
  it("proposes La Cumbre Colombian, French and Armenian partners with meaningful Elite rewards", async () => {
    const f=fixture(9);
    f.tables.sporting_directors[0].reputation_points=2253;
    f.tables.sporting_directors[0].country_id="fr";
    f.tables.countries.push({id:"co",name:"Colombie",iso_alpha2:"CO"},{id:"fr",name:"France",iso_alpha2:"FR"},{id:"am",name:"Arménie",iso_alpha2:"AM"});
    f.tables.secondary_sponsor_catalog=["cumbre-coca-rush", "terroirs-unis", "apricot-crown"].map((key,index)=>libraryRow(key,"partner-"+["co","fr","am"][index],["co","fr","am"][index],5));
    f.state.principalCountryId="co";
    mock.affinity.mockResolvedValue({teamCountryCode:"CO",directorCountryCode:"FR",leaderCountryCodes:["CO","AM"],rosterMajorityCountryCode:"CO",internationalSchoolAffinities:[],preferredSponsorIds:[]});
    mock.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"elite",projectedDivision:"elite",projectedRank:4},teamRiderCandidates:[]});
    f.tables.race_editions.forEach((edition,index)=>{edition.race_category_id=index<5?"elite":"world";});
    const state=await getSecondarySponsoringStateForAuthUser("user");
    if(state?.kind!=="offers") throw Error("Expected offers");
    expect(state.offers.map(offer=>offer.sponsor.countryCode)).toEqual(["CO","FR","AM"]);
    for(const offer of state.offers) {
      expect(offer.principalCountryCode).toBe("CO");
      expect(offer.principalBudgetPerSeason).toBe(2_000_000);
      expect(offer.maximumRewardBudget).toBe(offer.totalMaximumReward);
      expect(offer.totalMaximumReward).toBeGreaterThan(0);
      expect(offer.objectives.filter(goal=>goal.kind!=="roster_nationality").every(goal=>goal.categoryCode==="elite" || goal.categoryCode==="world")).toBe(true);
      for (const goal of offer.objectives) expect(goal.reputationPenalty).toBe(getSecondarySponsorFailurePenalty(goal.cashReward));
      const roster=offer.objectives.filter(goal=>goal.kind==="roster_nationality");
      expect(roster).toHaveLength(offer.sponsor.countryCode==="CO"?0:1);
      if(roster[0]?.kind==="roster_nationality") {
        expect(roster[0].requiredRiderCount).toBe(3);
        expect(roster[0].nationalityCountryCode).toBe(offer.sponsor.countryCode);
      }
    }
    expect(mock.affinity).toHaveBeenCalledWith(expect.objectContaining({seasonId:"s4",directorCountryId:"fr"}));
  });

  it("keeps Elite races out of objectives after a projected relegation despite high reputation", async () => {
    const f=fixture(9);
    f.tables.sporting_directors[0].reputation_points=12_000;
    mock.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"elite",projectedDivision:"world",projectedRank:35},teamRiderCandidates:[]});
    f.tables.race_editions.forEach((edition,index)=>{edition.race_category_id=index<3?"elite":"world";});
    const state=await getSecondarySponsoringStateForAuthUser("user");
    if(state?.kind!=="offers") throw Error("Expected offers");
    expect(state.offers.flatMap(offer=>offer.objectives).every(goal=>goal.categoryCode==="world")).toBe(true);
  });

  it("uses a domestic national fallback at most once and only when core races are insufficient", async () => {
    const f=fixture(6);
    f.tables.race_editions.forEach((edition,index)=>{edition.race_category_id=index<2?"world":"national";});
    const state=await getSecondarySponsoringStateForAuthUser("user");
    if(state?.kind!=="offers") throw Error("Expected offers");
    for(const offer of state.offers) {
      const national=offer.objectives.filter(goal=>goal.categoryCode==="national");
      expect(national).toHaveLength(1);
      const chosen=f.tables.race_editions.find(edition=>edition.id===national[0].raceEditionId);
      expect(f.tables.races.find(race=>race.id===chosen?.race_id)?.country_id).toBe("be");
    }
  });

  it("does not replace offers when a calendar would require multiple national fallbacks", async () => {
    const f=fixture(6);
    f.tables.race_editions.forEach((edition,index)=>{edition.race_category_id=index===0?"world":"national";});
    const before=structuredClone(f.tables.secondary_sponsor_offers);
    await expect(getSecondarySponsoringStateForAuthUser("user")).rejects.toThrow("adaptés");
    expect(f.tables.secondary_sponsor_offers).toEqual(before);
    expect(f.rpcCalls.filter(call=>call.name==="replace_secondary_sponsor_offers")).toHaveLength(0);
  });

  it("does not replace or reprice an offer accepted during generation", async () => {
    const f=fixture();
    const original=["offer-a","offer-b","offer-c"].flatMap(id=>Array.from({length:3},(_,index)=>objective(id,index)));
    f.tables.secondary_sponsor_objectives=structuredClone(original);
    f.state.beforeReplace=()=>{
      f.tables.secondary_sponsor_offers.forEach(offer=>{offer.status=offer.id==="offer-a"?"accepted":"withdrawn";});
      f.tables.secondary_sponsor_contracts.push({id:"signed-concurrently",offer_id:"offer-a",season_id:"s5",team_id:"team",secondary_sponsor_id:"sponsor-a",status:"planned",logo_x_percent:50,logo_y_percent:48,logo_scale:1,logo_rotation_degrees:0,logo_color_mode:"white"});
    };
    const state=await getSecondarySponsoringStateForAuthUser("user");
    expect(state?.kind).toBe("signed");
    if(state?.kind!=="signed") throw Error("Expected signed contract");
    expect(state.contract.id).toBe("signed-concurrently");
    expect(state.contract.logoPlacement.colorMode).toBe("white");
    expect(state.contract.objectives.map(goal=>goal.cashReward)).toEqual(original.slice(0,3).map(goal=>goal.cash_reward));
    expect(f.tables.secondary_sponsor_objectives).toEqual(original);
  });

  it("never loads offers belonging to the director's former team", async () => {
    const f=fixture();
    f.tables.secondary_sponsor_offers.forEach(offer=>{offer.generation_version=4;});
    const existing=["offer-a","offer-b","offer-c"].flatMap(id=>Array.from({length:3},(_,index)=>objective(id,index)));
    f.tables.secondary_sponsor_objectives=structuredClone(existing);
    f.tables.secondary_sponsor_offers.push({id:"former-accepted",secondary_sponsor_id:"unknown-old-brand",sporting_director_id:"director",team_id:"former-team",target_season_id:"s5",status:"accepted",generation_version:3});
    f.state.failCalendar=true;
    const state=await getSecondarySponsoringStateForAuthUser("user");
    if(state?.kind!=="offers") throw Error("Expected offers");
    expect(state.offers.map(offer=>offer.id)).toEqual(["offer-a","offer-b","offer-c"]);
    expect(f.queries.filter(query=>query.table==="secondary_sponsor_offers").every(query=>query.filters.some(filter=>filter.kind==="eq" && filter.column==="team_id" && filter.value==="team"))).toBe(true);
    expect(f.rpcCalls).toEqual([]);
    expect(f.tables.secondary_sponsor_objectives).toEqual(existing);
  });

  it.each([
    {end:null,duration:1,covered:false},
    {end:null,duration:2,covered:true},
    {end:"s4",duration:5,covered:false},
    {end:"s5",duration:1,covered:true},
  ])("uses the principal contract's actual season coverage: %o", async ({end,duration,covered}) => {
    const f=fixture();
    f.tables.secondary_sponsor_contracts.push({id:"signed-contract",offer_id:"offer-a",season_id:"s5",team_id:"team",secondary_sponsor_id:"sponsor-a",status:"planned",logo_x_percent:50,logo_y_percent:48,logo_scale:1,logo_rotation_degrees:0});
    f.tables.secondary_sponsor_objectives=Array.from({length:3},(_,index)=>objective("offer-a",index));
    f.tables.team_sponsor_contracts=[{id:"primary-contract",team_id:"team",role:"principal",sponsor_id:"primary-brand",selected_jersey_id:"ardennes-outillage-classic",pending_jersey_id:"ardennes-outillage-modern",pending_jersey_season_id:"s5",start_season_id:"s4",end_season_id:end,contract_duration_seasons:duration,status:"active"}];
    f.tables.sponsors=[{id:"primary-brand",catalog_key:"ardennes-outillage"}];
    const state=await getSecondarySponsoringStateForAuthUser("user");
    if(state?.kind!=="signed") throw Error("Expected signed contract");
    expect(Boolean(state.contract.baseJersey)).toBe(covered);
    expect(state.contract.principalCountryCode).toBe(covered?"BE":null);
    expect(f.queries.some(query=>query.table==="sponsors")).toBe(covered);
    expect(f.rpcCalls).toEqual([]);
    expect(f.queries.some(query=>query.table==="race_editions")).toBe(false);
  });

  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("requires a valid target-season principal budget before generating offers (%s)", async budget => {
    const f=fixture();
    f.state.principalBudgetPerSeason=budget;
    const before=structuredClone(f.tables.secondary_sponsor_offers);
    const result=await getSecondarySponsoringStateForAuthUser("user");
    expect(result).toMatchObject({kind:"principal-required",targetGameYear:5,targetSeasonName:"Saison 5"});
    expect(f.rpcCalls.map(call=>call.name)).toEqual(["get_secondary_sponsor_offer_context"]);
    expect(mock.affinity).not.toHaveBeenCalled();
    expect(mock.snapshot).not.toHaveBeenCalled();
    expect(f.queries.some(query=>query.table==="race_editions")).toBe(false);
    expect(f.tables.secondary_sponsor_offers).toEqual(before);
  });

  it("does not reroll or read the context of saved V4 offers without a covered principal budget", async () => {
    const f=fixture();
    f.tables.secondary_sponsor_offers.forEach(offer=>{
      offer.generation_version=4;offer.principal_budget_per_season=null;offer.maximum_reward_budget=null;
    });
    const existing=["offer-a","offer-b","offer-c"].flatMap(id=>Array.from({length:3},(_,index)=>objective(id,index)));
    f.tables.secondary_sponsor_objectives=structuredClone(existing);
    f.state.failCalendar=true;
    const result=await getSecondarySponsoringStateForAuthUser("user");
    expect(result?.kind).toBe("principal-required");
    expect(f.rpcCalls).toEqual([]);
    expect(mock.affinity).not.toHaveBeenCalled();
    expect(mock.snapshot).not.toHaveBeenCalled();
    expect(f.tables.secondary_sponsor_objectives).toEqual(existing);
  });

  it("uses the primary budget as a reference while preserving brands, countries, targets and reward proportions", async () => {
    const prepare=(budget:number)=>{
      const f=fixture(6);
      f.state.principalBudgetPerSeason=budget;
      f.tables.race_editions.forEach((edition,index)=>{edition.race_category_id=index<2?"elite":"world";});
      mock.snapshot.mockResolvedValue({teamSportingContext:{currentDivision:"elite",projectedDivision:"elite",projectedRank:4},teamRiderCandidates:[]});
      return f;
    };
    prepare(10_000_000);
    const original=await getSecondarySponsoringStateForAuthUser("user");
    if(original?.kind!=="offers") throw Error("Expected original offers");
    prepare(100_000);
    const smaller=await getSecondarySponsoringStateForAuthUser("user");
    if(smaller?.kind!=="offers") throw Error("Expected smaller offers");
    expect(smaller.offers.map(offer=>offer.sponsor.id)).toEqual(original.offers.map(offer=>offer.sponsor.id));
    expect(new Set(smaller.offers.map(offer=>offer.totalMaximumReward)).size).toBe(3);
    expect(Math.min(...smaller.offers.map(offer=>offer.totalMaximumReward))).toBeLessThan(30_000);
    expect(Math.max(...smaller.offers.map(offer=>offer.totalMaximumReward))).toBeGreaterThan(30_000);
    smaller.offers.forEach((offer,index)=>{
      const reference=original.offers[index];
      expect(offer.maximumRewardBudget).toBe(offer.totalMaximumReward);
      expect(Math.abs(offer.totalMaximumReward/100_000-reference.totalMaximumReward/10_000_000)).toBeLessThanOrEqual(0.0051);
      expect(offer.objectives.map(goal=>goal.raceEditionId)).toEqual(reference.objectives.map(goal=>goal.raceEditionId));
      expect(offer.objectives.map(goal=>goal.targetRank)).toEqual(reference.objectives.map(goal=>goal.targetRank));
      offer.objectives.forEach((goal,goalIndex)=>{
        expect(goal.cashReward/offer.totalMaximumReward).toBeCloseTo(reference.objectives[goalIndex].cashReward/reference.totalMaximumReward,4);
        expect(goal.reputationPenalty).toBe(0);
        expect(goal.reputationPenalty).toBeLessThanOrEqual(reference.objectives[goalIndex].reputationPenalty??0);
      });
    });
  });

  it("refreshes unsigned V3 prices once and then preserves the saved V4 negotiation", async () => {
    const f=fixture();
    f.tables.secondary_sponsor_offers.forEach(offer=>{offer.generation_version=3;});
    f.tables.secondary_sponsor_objectives=["offer-a","offer-b","offer-c"].flatMap(id=>Array.from({length:3},(_,index)=>objective(id,index)));
    const first=await getSecondarySponsoringStateForAuthUser("user");
    expect(first?.kind).toBe("offers");
    if(first?.kind!=="offers") throw Error("Expected renewed offers");
    expect(new Set(first.offers.map(offer=>offer.totalMaximumReward)).size).toBe(3);
    expect(f.tables.secondary_sponsor_offers.every(offer=>offer.generation_version===4)).toBe(true);
    const calls=f.rpcCalls.length;
    const second=await getSecondarySponsoringStateForAuthUser("user");
    expect(second).toEqual(first);
    expect(f.rpcCalls).toHaveLength(calls);
  });

  it("prices the actual race format rather than guessing from its name", async () => {
    const prepare=(grandTour:boolean)=>{
      const f=fixture();
      f.tables.races.forEach(race=>{race.race_format=grandTour?"stage_race":"one_day";race.is_grand_tour=grandTour;});
      return f;
    };
    prepare(false);
    const classics=await getSecondarySponsoringStateForAuthUser("user");
    prepare(true);
    const tours=await getSecondarySponsoringStateForAuthUser("user");
    if(classics?.kind!=="offers"||tours?.kind!=="offers") throw Error("Expected format-based quotes");
    expect(tours.offers.map(offer=>offer.sponsor.id)).toEqual(classics.offers.map(offer=>offer.sponsor.id));
    tours.offers.forEach((offer,index)=>{
      expect(offer.totalMaximumReward).toBeGreaterThan(classics.offers[index].totalMaximumReward);
      expect(offer.objectives.map(goal=>goal.targetRank)).toEqual(classics.offers[index].objectives.map(goal=>goal.targetRank));
    });
  });

});
