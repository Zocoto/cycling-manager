import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), translate: vi.fn() }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/services/global-chat-translation", () => ({ getOrCreateGazetteCommentTranslations: mocks.translate }));
import { POST } from "./route";
const editionId = "11111111-1111-4111-8111-111111111111";
const key = "pre:press";
const text = "Nous allons attaquer dans la dernière ascension pour aider notre leader.";
const request = (body: unknown) => new Request("https://cyclostratege.fr/jeu/gazette/commentaires/traductions", {
  method: "POST", headers: { "x-vercel-oidc-token": "test-oidc" }, body: JSON.stringify(body),
});
function fixture() {
  const identity = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "director" }, error: null }) };
  identity.select.mockReturnValue(identity); identity.eq.mockReturnValue(identity);
  const edition = { select: vi.fn(), eq: vi.fn(), lte: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: {
    published_at: "2026-01-01T00:00:00Z", content: { reactions: [], preRacePressConferences: [{ conferenceId: "press", publicStatement: text }] },
  }, error: null }) };
  edition.select.mockReturnValue(edition); edition.eq.mockReturnValue(edition); edition.lte.mockReturnValue(edition);
  const client = { from: vi.fn((table: string) => table === "sporting_directors" ? identity : edition) };
  mocks.client.mockResolvedValue(client); mocks.auth.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.translate.mockResolvedValue([{ messageId: key, status: "loaded", translation: { translatedText: "We will attack on the final climb." } }]);
  return { client, identity, edition };
}
beforeEach(() => vi.resetAllMocks());
describe("published Gazette quotation translation", () => {
  it.each([null, {}, { editionId, targetLocale: "de", messageIds: [key] }, { editionId, targetLocale: "en", messageIds: Array(6).fill(key) },
    { editionId: "bad", targetLocale: "en", messageIds: [key] }])("rejects invalid requests before any reads", async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("requires authentication and an active director", async () => {
    const f = fixture(); mocks.auth.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await POST(request({ editionId, targetLocale: "en", messageIds: [key] }))).status).toBe(401);
    expect(f.client.from).not.toHaveBeenCalled();
    f.identity.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(request({ editionId, targetLocale: "en", messageIds: [key] }))).status).toBe(403);
  });
  it("reads only the published snapshot and ignores arbitrary client text and foreign keys", async () => {
    const f = fixture();
    const response = await POST(request({ editionId, targetLocale: "en", messageIds: [key, key, "pre:unpublished"], text: "arbitrary malicious input" }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(f.edition.eq).toHaveBeenCalledWith("id", editionId);
    expect(f.edition.lte).toHaveBeenCalledWith("published_at", expect.any(String));
    expect(mocks.translate).toHaveBeenCalledWith({ sources: [{ messageId: key, sourceMessage: text, sourceEditedAt: null }], targetLocale: "en", requesterDirectorId: "director", vercelOidcToken: "test-oidc" });
  });
  it.each(["fr", "en"])("never calls the translation service when source and game language are %s", async locale => {
    const f = fixture(); const source = locale === "fr" ? text : "We will attack on the final climb to support our leader.";
    f.edition.maybeSingle.mockResolvedValueOnce({ data: { published_at: "2026-01-01T00:00:00Z", content: { reactions: [], preRacePressConferences: [{ conferenceId: "press", publicStatement: source }] } }, error: null });
    const response = await POST(request({ editionId, targetLocale: locale, messageIds: [key] }));
    expect((await response.json()).translations[0].translation.translatedText).toBe(source);
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it("does not expose or translate missing/future editions", async () => {
    const f = fixture(); f.edition.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(request({ editionId, targetLocale: "en", messageIds: [key] }))).status).toBe(404);
    f.edition.maybeSingle.mockResolvedValueOnce({ data: { published_at: "2099-01-01T00:00:00Z" }, error: null });
    expect((await POST(request({ editionId, targetLocale: "en", messageIds: [key] }))).status).toBe(404);
    expect(mocks.translate).not.toHaveBeenCalled();
  });
  it("keeps provider failures isolated from publication and reading", async () => {
    fixture(); mocks.translate.mockRejectedValueOnce(new Error("offline"));
    const response = await POST(request({ editionId, targetLocale: "en", messageIds: [key] }));
    expect(response.status).toBe(503); expect(response.headers.get("Retry-After")).toBe("120");
  });
});
