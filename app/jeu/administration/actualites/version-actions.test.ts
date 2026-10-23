import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), auth: vi.fn(), role: vi.fn(), rpc: vi.fn(), abort: vi.fn(), tag: vi.fn(), path: vi.fn() }));
vi.mock("next/cache", () => ({ updateTag: mocks.tag, revalidatePath: mocks.path }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/services/game-staff-access", () => ({ getCurrentGameStaffRole: mocks.role }));
import { saveSiteReleaseAction } from "./version-actions";
const initial = { status: "idle" as const, message: null };
const row = { version: "1.2.3", revision: 2, updated_at: "2026-10-22T12:00:00Z", history: [] };
function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ version: "1.2.3", note: "Un correctif", revision: "1", ...overrides })) result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.auth.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.role.mockResolvedValue("owner"); mocks.rpc.mockReturnValue({ abortSignal: mocks.abort });
  mocks.abort.mockResolvedValue({ data: [row], error: null });
});
describe("owner-only version update", () => {
  it.each([null, "game_staff"])("refuses %s before mutation", async role => {
    mocks.role.mockResolvedValue(role);
    expect((await saveSiteReleaseAction(initial, form())).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.tag).not.toHaveBeenCalled();
  });
  it("rejects an expired session before even checking the role", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect((await saveSiteReleaseAction(initial, form())).status).toBe("error");
    expect(mocks.role).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([{ version: "1.2<script>" }, { revision: "0" }, { revision: "NaN" }, { revision: "1.5" }, { note: "a".repeat(181) }])("validates before SQL: %j", async invalid => {
    expect((await saveSiteReleaseAction(initial, form(invalid))).status).toBe("error"); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("updates only the version and its caches, never a news draft or publication", async () => {
    expect(await saveSiteReleaseAction(initial, form())).toMatchObject({ status: "success", management: row });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_active_site_release", { p_version: "1.2.3", p_note: "Un correctif", p_expected_revision: 1 });
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith("active-site-release");
    expect(mocks.path.mock.calls).toEqual([["/(public)", "layout"], ["/jeu/administration/actualites"]]);
  });
  it("preserves a concurrent edit and does not invalidate caches", async () => {
    mocks.abort.mockResolvedValue({ data: null, error: { code: "40001" } });
    expect((await saveSiteReleaseAction(initial, form())).status).toBe("conflict"); expect(mocks.tag).not.toHaveBeenCalled();
  });
  it.each(["network", "missing", "denied"])("never claims success when %s", async kind => {
    if (kind === "network") mocks.abort.mockRejectedValue(new Error("network"));
    else mocks.abort.mockResolvedValue({ data: [], error: kind === "denied" ? { code: "42501" } : null });
    expect((await saveSiteReleaseAction(initial, form())).status).toBe("error"); expect(mocks.tag).not.toHaveBeenCalled();
  });
  it("retains the confirmed revision if revalidation itself fails", async () => {
    mocks.tag.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    expect(await saveSiteReleaseAction(initial, form())).toMatchObject({ status: "error", management: row });
  });
});
