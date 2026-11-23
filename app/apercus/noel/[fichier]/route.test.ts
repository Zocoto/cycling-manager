import { beforeEach, describe, expect, it, vi } from "vitest";

import { showChristmasPreviewInMenu } from "@/lib/game/christmas-preview";
import config from "@/next.config";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));

const request = (fichier: string) => GET(
  new Request("https://cyclostratege.fr/apercus/noel/" + fichier),
  { params: Promise.resolve({ fichier }) },
);

describe("private Christmas preview", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
  });

  it.each([
    ["Zocoto", "58140add-54c6-40af-9528-f823d0051d0f", "3161715a-ad6a-4335-b820-45fc1969a849"],
    ["Ujik", "c95a8ad8-3771-4c23-9141-5d1b9d749a00", "d7ec0ccf-bcb4-4802-8a14-b458eccf41d7"],
    ["Fra Troisset", "0c5bb531-5fc4-4bfa-85c9-02ece5487b44", "2ac12cfa-b9a5-43ea-bf34-3685e07e0d89"],
  ])("serves the playable draft and menu for %s", async (_name, accountId, directorId) => {
    mocks.auth.mockResolvedValue({ data: { user: { id: accountId } }, error: null });
    expect(showChristmasPreviewInMenu(directorId)).toBe(true);

    const home = await request("index.html");
    expect(home.status).toBe(200);
    expect(home.headers.get("cache-control")).toBe("private, no-store");
    expect(home.headers.get("x-robots-tag")).toContain("noindex");
    expect(await home.text()).toContain('data-src="tournee.html"');

    expect(await (await request("tournee.html")).text()).toContain('src="tournee.js"');
    for (const file of ["tournee.js", "flight-physics.js", "avent.js", "rules.js", "sapin.js", "album-s4.js"])
      expect((await request(file)).headers.get("content-type")).toContain("text/javascript");
    expect((await request("sapin.css")).headers.get("content-type")).toContain("text/css");
    expect((await request("village-hiver.jpg")).headers.get("content-type")).toBe("image/jpeg");
    expect((await request("rudolphe-lanterne-rouge.webp")).headers.get("content-type")).toBe("image/webp");
  });

  it.each([null, "another-authenticated-account"])("explains HTML access and protects assets for %s", async (userId) => {
    mocks.auth.mockResolvedValue({ data: { user: userId ? { id: userId, email: "other@example.test" } : null }, error: null });
    expect(showChristmasPreviewInMenu(userId)).toBe(false);
    for (const file of ["index.html", "tournee.html", "tournee.js", "flight-physics.js", "avent.js", "rules.js", "sapin.js", "album-s4.js", "sapin.css", "noel.js", "catalogue.js", "noel.css", "village-hiver.jpg", "rudolphe-lanterne-rouge.webp"]) {
      const response = await request(file);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      if (file.endsWith(".html")) {
        expect(response.status).toBe(userId ? 403 : 401);
        expect(response.headers.get("content-type")).toContain("text/html");
        const body = await response.text();
        expect(body).toContain(userId ? "Cet aperçu est privé" : "Connecte-toi pour ouvrir l’aperçu");
        expect(body).toContain('target="_top"');
        expect(body).not.toContain("tournee.js");
        if (!userId) expect(body).toContain("/connexion?returnTo=%2Fapercus%2Fnoel%2Findex.html%23tournee");
      } else {
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("");
      }
    }
  });

  it("provides a readable reconnect screen when the session has expired", async () => {
    mocks.auth.mockResolvedValue({ data: { user: null }, error: new Error("Session expirée") });
    const response = await request("tournee.html");
    expect(response.status).toBe(401);
    expect(await response.text()).toContain("Se connecter et ouvrir le mini-jeu");
  });

  it("rejects unlisted files before any read or authentication", async () => {
    expect((await request("server.cjs")).status).toBe(404);
    expect((await request("../package.json")).status).toBe(404);
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("opens same-origin framing only for the flight document", async () => {
    const headers = await config.headers?.();
    const page = headers?.find(entry => entry.source === "/apercus/noel/:fichier");
    const flight = headers?.find(entry => entry.source === "/apercus/noel/tournee.html");
    expect(page?.headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(flight?.headers).toContainEqual({ key: "X-Frame-Options", value: "SAMEORIGIN" });
    expect(flight?.headers.find(header => header.key === "Content-Security-Policy")?.value)
      .toContain("frame-ancestors 'self'");
  });
});
