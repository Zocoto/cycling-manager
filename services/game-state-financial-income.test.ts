import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  rpc: mocks.rpc, from: () => ({ upsert: mocks.upsert, update: mocks.update }),
}) }));
vi.mock("@/services/youth-development", () => ({ settleDueYouthAutomaticTrainingSessions: vi.fn() }));
import { runGameMaintenanceTask } from "./game-state-settlement";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
  mocks.rpc.mockImplementation((name: string) => {
    const promise = Promise.resolve({ data: name === "settle_due_financial_director_income" ? 3 : {}, error: null });
    return Object.assign(promise, { abortSignal: vi.fn(() => promise) });
  });
});

describe("financial income background cadence", () => {
  it("runs with staff maintenance, reports its result and records success", async () => {
    expect(await runGameMaintenanceTask("staff-academy")).toEqual({ financial_director_income: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("settle_due_financial_director_income");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded" }));
  });
  it("does not add finance reads to unrelated maintenance", async () => {
    await runGameMaintenanceTask("equipment");
    expect(mocks.rpc).not.toHaveBeenCalledWith("settle_due_financial_director_income");
  });
  it("records payout failures rather than reporting a successful daily settlement", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const promise = Promise.resolve({ data: {}, error: name === "settle_due_financial_director_income" ? { message: "timeout" } : null });
      return Object.assign(promise, { abortSignal: () => promise });
    });
    await expect(runGameMaintenanceTask("staff-academy")).rejects.toThrow("timeout");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded" }));
  });
});
