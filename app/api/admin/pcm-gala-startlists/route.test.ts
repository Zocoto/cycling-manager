import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/game/pcm-export/access", () => ({ canAccessPcmExport: mocks.access }));
vi.mock("@/services/pcm-gala-startlist-export", () => ({ generatePcmGalaStartlistExport: mocks.generate }));
import { POST } from "./route";

function request(query = "?eventKey=gala-des-puncheurs", origin = "https://game.test") {
  return new Request(`https://game.test/api/admin/pcm-gala-startlists${query}`, { method: "POST", headers: { origin, "x-cs-requested-with": "pcm-gala-startlists-admin" } });
}
describe("API administrative de startlist gala", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: { email: "admin@test.invalid" } }, error: null });
    mocks.access.mockReturnValue(true);
    mocks.generate.mockResolvedValue({ archive: new Uint8Array([1, 2, 3]), filename: "gala.zip", season: 3, eventCount: 1, registeredTeamCount: 2, registeredRiderCount: 14, generatedAt: "2026-10-06T12:00:00.000Z" });
  });
  it("refuse les joueurs ordinaires, même avec un en-tête forgé", async () => {
    mocks.access.mockReturnValue(false);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("requiert une session authentifiée", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejette une origine étrangère", async () => {
    expect((await POST(request("?eventKey=gala-des-puncheurs", "https://foreign.test"))).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejette une clé non reconnue sans toucher la base", async () => {
    expect((await POST(request("?eventKey=../gala"))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("transmet uniquement le profil demandé et retourne un ZIP non mis en cache", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith("gala-des-puncheurs");
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-CS-Events")).toBe("1");
    expect(response.headers.get("X-CS-Riders")).toBe("14");
  });
  it("conserve l'export de tous les profils en l'absence de filtre", async () => {
    expect((await POST(request(""))).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(undefined);
  });
});
