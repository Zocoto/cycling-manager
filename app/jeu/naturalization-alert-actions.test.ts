import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
import { ignoreNaturalizationAlertAction } from "./naturalization-alert-actions";
const target = { subjectType: "professional" as const, subjectId: "00000000-0000-4000-8000-000000000001", targetCountryId: "00000000-0000-4000-8000-000000000002" };
const previous = { error: null };
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ data: { user: { id: "viewer" } }, error: null }); mocks.rpc.mockResolvedValue({ error: null }); });
describe("ignore naturalization alert action", () => {
  it("rejects invalid references before contacting the database", async () => {
    expect((await ignoreNaturalizationAlertAction({ ...target, subjectId: "invalid" }, previous, new FormData())).error).toBeTruthy();
    expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects expired sessions without writing", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await ignoreNaturalizationAlertAction(target, previous, new FormData())).error).toContain("session");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("makes exactly one authenticated preference write and refreshes the assistant", async () => {
    expect(await ignoreNaturalizationAlertAction(target, previous, new FormData())).toEqual({ error: null });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ignore_current_naturalization_alert", {
      p_subject_type: "professional", p_subject_id: target.subjectId, p_target_country_id: target.targetCountryId });
    expect(mocks.revalidate).toHaveBeenCalledExactlyOnceWith("/jeu");
  });
  it("does not pretend to hide an alert if ownership validation fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Ce coureur ne fait plus partie de votre équipe." } });
    expect((await ignoreNaturalizationAlertAction(target, previous, new FormData())).error).toContain("équipe");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
