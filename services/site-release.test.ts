import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), abort: vi.fn(), cache: vi.fn((fn: unknown) => fn) }));
vi.mock("next/cache", () => ({ unstable_cache: mocks.cache }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { getActiveSiteVersion, getSiteReleaseManagement } from "./site-release";
const snapshot = { version: "1.2.3", revision: 2, updated_at: "2026-10-22T12:00:00+00:00" };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockReturnValue({ abortSignal: mocks.abort }); mocks.admin.mockReturnValue({ rpc: mocks.rpc }); });

describe("cached public version", () => {
  it("reads only the public projection with a short timeout", async () => {
    mocks.abort.mockResolvedValue({ data: [snapshot], error: null });
    expect(await getActiveSiteVersion()).toBe("1.2.3");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_active_site_release");
    expect(mocks.abort).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
  it.each(["denied", "malformed", "missing", "network"])("keeps public pages usable when %s", async kind => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    if (kind === "network") mocks.abort.mockRejectedValue(new Error("network"));
    else mocks.abort.mockResolvedValue({ data: kind === "missing" ? [] : [{ ...snapshot, version: kind === "malformed" ? "bad" : snapshot.version }], error: kind === "denied" ? {} : null });
    expect(await getActiveSiteVersion()).toBe("0.9.1");
    log.mockRestore();
  });
});
describe("owner version management", () => {
  it("uses the authenticated caller and bounded management RPC", async () => {
    mocks.abort.mockResolvedValue({ data: [{ ...snapshot, history: [] }], error: null });
    expect(await getSiteReleaseManagement({ rpc: mocks.rpc } as never)).toEqual({ ...snapshot, history: [] });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_site_release_management");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not turn a refused private read into editable fallback state", async () => {
    mocks.abort.mockResolvedValue({ data: [], error: { code: "42501" } });
    await expect(getSiteReleaseManagement({ rpc: mocks.rpc } as never)).rejects.toThrow("chargée");
  });
});
