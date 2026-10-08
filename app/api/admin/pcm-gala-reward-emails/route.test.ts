import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/game/private-admin-access", () => ({ canAccessPrivateAdmin: mocks.access }));
vi.mock("@/services/season-finale-gala-email", () => ({ sendSeasonFinaleGalaRewardEmails: mocks.send }));

import { POST } from "./route";

function request(headers: Record<string, string> = { origin: "https://game.test", "x-cs-requested-with": "pcm-gala-reward-emails-admin" }) {
  return new Request("https://game.test/api/admin/pcm-gala-reward-emails", { method: "POST", headers });
}

const invalidHeaders: Record<string, string>[] = [
  { origin: "https://foreign.test", "x-cs-requested-with": "pcm-gala-reward-emails-admin" },
  { "x-cs-requested-with": "pcm-gala-reward-emails-admin" },
  { origin: "https://game.test" },
  { origin: "https://game.test", "x-cs-requested-with": "another-admin-route" },
  { origin: "null", "x-cs-requested-with": "pcm-gala-reward-emails-admin" },
];

describe("API administrative d'envoi des récompenses du gala", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: { id: "admin-user", email: "admin@test.invalid" } }, error: null });
    mocks.access.mockReturnValue(true);
    mocks.send.mockResolvedValue({ claimed: 2, sent: 2, failed: 0, uncertain: 0 });
  });

  it("retourne uniquement les compteurs d'envoi, sans données de destinataires ni cache", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ claimed: 2, sent: 2, failed: 0, uncertain: 0 });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.access).toHaveBeenCalledWith("admin@test.invalid");
  });

  it.each([false, true])("refuse l'absence de session ou une erreur de session avant l'envoi (error=%s)", async (withError) => {
    mocks.auth.mockResolvedValue({ data: { user: withError ? { email: "admin@test.invalid" } : null }, error: withError ? { message: "private auth details" } : null });
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentification requise." });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.access).not.toHaveBeenCalled();
  });

  it("cache la ressource aux joueurs ordinaires même avec des en-têtes administrateur forgés", async () => {
    mocks.access.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Ressource introuvable." });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each(invalidHeaders)("refuse une requête sans preuve d'origine valide : %j", async (headers) => {
    const response = await POST(request(headers));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Requête invalide." });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("ne laisse pas le client choisir un autre gala ou des destinataires", async () => {
    const response = await POST(new Request("https://game.test/api/admin/pcm-gala-reward-emails?eventId=foreign-event", {
      method: "POST", headers: { origin: "https://game.test", "x-cs-requested-with": "pcm-gala-reward-emails-admin", "content-type": "application/json" },
      body: JSON.stringify({ eventId: "foreign-event", recipient: "unrelated@test.invalid" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith();
  });

  it("retourne une erreur générique sans exposer secrets, adresses ou détails du fournisseur", async () => {
    mocks.send.mockRejectedValue(new Error("BREVO_API_KEY=private; recipient=secret@test.invalid; private SQL"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Les mails n’ont pas pu être traités. Les lots déjà attribués restent acquis." });
    expect(JSON.stringify(body)).not.toMatch(/BREVO|private|secret@test/);
  });
});
