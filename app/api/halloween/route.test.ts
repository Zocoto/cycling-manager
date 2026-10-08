import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRunnerPreview, stepRunnerPreview, runnerSnapshot } from "@/lib/game/halloween-runner";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mock.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => {
  const query = { select: () => query, eq: (...args: unknown[]) => { mock.eq(...args); return query; }, maybeSingle: mock.maybeSingle };
  return { rpc: mock.rpc, from: () => query };
} }));
import { POST } from "./route";
const userId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const savedEnv = { review: process.env.HALLOWEEN_LOCAL_REVIEW, vercel: process.env.VERCEL_ENV };
const request = (kind = "join", payload: Record<string, unknown> = {}, extraHeaders: Record<string, string> = {}) => new Request("https://cs.example/api/halloween", {
  method: "POST", headers: { origin: "https://cs.example", "content-type": "application/json", ...extraHeaders },
  body: JSON.stringify({ id: userId, kind, payload }),
});
beforeEach(() => {
  vi.clearAllMocks(); delete process.env.HALLOWEEN_LOCAL_REVIEW; process.env.VERCEL_ENV = "production";
  mock.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mock.rpc.mockResolvedValue({ data: { message: "ok" }, error: null });
});
afterEach(() => {
  if (savedEnv.review === undefined) delete process.env.HALLOWEEN_LOCAL_REVIEW; else process.env.HALLOWEEN_LOCAL_REVIEW = savedEnv.review;
  if (savedEnv.vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = savedEnv.vercel;
});
describe("Halloween mutation boundary", () => {
  it("rejects external origins without touching auth or the database", async () => {
    expect((await POST(request("join", {}, { origin: "https://other.example" }))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("blocks real actions in local recipes and preview deployments", async () => {
    process.env.HALLOWEEN_LOCAL_REVIEW = "1"; expect((await POST(request())).status).toBe(403);
    delete process.env.HALLOWEEN_LOCAL_REVIEW; process.env.VERCEL_ENV = "preview"; expect((await POST(request())).status).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401); expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects caller-supplied prices, balances and user ids", async () => {
    for (const payload of [{ price: 0 }, { coins: 999 }, { user: userId }, { target: "invalid" }, { bandage: 5 }]) {
      expect((await POST(request("buy", payload))).status).toBe(400);
    }
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("uses the authenticated identity and carries the idempotency key", async () => {
    expect((await POST(request("buy", { item: "pumpkin-juice" }))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("halloween_action", { p_user: userId, p_id: userId, p_kind: "buy", p_payload: { item: "pumpkin-juice" } });
  });
  it("checks ownership and never credits an unknown run", async () => {
    mock.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(request("finish", { runId }))).status).toBe(400);
    expect(mock.eq).toHaveBeenCalledWith("user_id", userId); expect(mock.eq).toHaveBeenCalledWith("edition_id", "halloween-2026");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("recomputes the complete proof and ignores client rewards", async () => {
    const model = createRunnerPreview(42); while (!model.ended) stepRunnerPreview(model, false, false);
    const expected = runnerSnapshot(model);
    mock.maybeSingle.mockResolvedValue({ data: { id: runId, seed: 42, status: "running", started_at: new Date(Date.now() - 600000).toISOString(), expires_at: new Date(Date.now() + 600000).toISOString() }, error: null });
    const proof = { ticks: model.tick, commands: [] };
    expect((await POST(request("finish", { runId, proof, coins: 99999, score: 99999 }))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("halloween_action", expect.objectContaining({ p_payload: { runId, proof, coins: expected.coins, score: expected.score, distance: expected.distance } }));
  });
  it("does not replay or re-credit an already finished run", async () => {
    mock.maybeSingle.mockResolvedValue({ data: { id: runId, status: "finished", score: 100 }, error: null });
    expect((await POST(request("finish", { runId, proof: null }))).status).toBe(200);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("refuses expired sessions and unfinished proofs", async () => {
    const run = { id: runId, seed: 42, status: "running", started_at: new Date(Date.now() - 10000).toISOString(), expires_at: new Date(Date.now() - 1000).toISOString() };
    mock.maybeSingle.mockResolvedValue({ data: run, error: null });
    expect((await POST(request("finish", { runId, proof: { ticks: 1, commands: [] } }))).status).toBe(400);
    mock.maybeSingle.mockResolvedValue({ data: { ...run, expires_at: new Date(Date.now() + 10000).toISOString() }, error: null });
    expect((await POST(request("finish", { runId, proof: { ticks: 1, commands: [] } }))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
