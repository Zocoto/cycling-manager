import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GET } from "./route";

vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const stageId = "00000000-0000-4000-8000-000000000001";
const finished = {
  status: "completed",
  departure_at: null,
  distance_km: 150,
  results: [{ id: "result-id" }],
  simulation: { stage_id: stageId },
};

function query(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function mockReads(stage = query(finished), director = query({ id: "director-id" })) {
  const from = vi.fn((table: string) => table === "stages" ? stage : director);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
  return { from, stage };
}

function read(id = stageId) {
  return GET(new Request(`https://game.test/api/races/stages/${id}/availability`), {
    params: Promise.resolve({ stageId: id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthenticatedUser).mockResolvedValue({ data: { user: { id: "user-id", email: undefined } }, error: null });
});

describe("race stage availability route", () => {
  it("returns a bounded availability projection for a non-national stage of the active season", async () => {
    const { from, stage } = mockReads();
    const result = await read();

    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(result.json()).resolves.toEqual({ cancelled: false, resultsAvailable: true, simulationAvailable: true });
    expect(from.mock.calls).toEqual([["sporting_directors"], ["stages"]]);
    expect(stage.eq).toHaveBeenCalledWith("id", stageId);
    expect(stage.eq).toHaveBeenCalledWith("edition.season.status", "active");
    expect(stage.neq).toHaveBeenCalledWith("edition.status", "cancelled");
    expect(stage.not).toHaveBeenCalledWith("edition.race.competition_type", "in", "(national_road,national_time_trial)");
    expect(stage.limit).toHaveBeenCalledExactlyOnceWith(1, { referencedTable: "results" });
    expect(stage.select.mock.calls[0][0]).not.toMatch(/input_data|simulation_data/);
  });

  it("requires authentication before querying the stage", async () => {
    const { from } = mockReads();
    vi.mocked(getAuthenticatedUser).mockResolvedValueOnce({ data: { user: null }, error: null });

    expect((await read()).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps scheduled simulations and results hidden before the start", async () => {
    mockReads(query({ ...finished, status: "planned", departure_at: "2100-01-01T14:00:00.000Z" }));
    const result = await read();
    await expect(result.json()).resolves.toEqual({ cancelled: false, resultsAvailable: false, simulationAvailable: false });
  });

  it("returns no readiness when there is no director or matching stage", async () => {
    mockReads(query(finished), query(null));
    expect((await read()).status).toBe(403);
    mockReads(query(null));
    expect((await read()).status).toBe(404);
  });

  it("rejects malformed stage IDs before reading authentication or data", async () => {
    expect((await read("unknown")).status).toBe(404);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
