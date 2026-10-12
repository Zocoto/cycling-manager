import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));
import { POST } from "./route";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://cyclostratege.fr/api/site-presence", {
    method: "POST", headers: { origin: "https://cyclostratege.fr", "user-agent": "Mozilla/5.0", ...headers },
  });
}
describe("site presence endpoint", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: { total: 3, visitors: 1, players: [{ id: "a", name: "Paul" }, { id: "b", name: "Romain" }] }, error: null }); });
  it("counts visitors in the total and creates a private same-site browser cookie", async () => {
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ total: 3, visitors: 1 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.cookies.get("cs-online-browser");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(rpc).toHaveBeenCalledWith("record_site_browser_presence", { p_browser_id: cookie?.value });
  });
  it("reuses the browser cookie across pages and tabs", async () => {
    const browser = "12345678-1234-1234-1234-123456789abc";
    const response = await POST(request({ cookie: `cs-online-browser=${browser}` }));
    expect(rpc).toHaveBeenCalledWith("record_site_browser_presence", { p_browser_id: browser });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects cross-site activity and ignores crawlers", async () => {
    expect((await POST(request({ origin: "https://example.com" }))).status).toBe(403);
    expect((await POST(request({ "user-agent": "Googlebot" }))).status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports temporary failure without inventing a zero count", async () => {
    rpc.mockResolvedValue({ error: { message: "unavailable" }, data: null });
    expect((await POST(request())).status).toBe(503);
  });
});
