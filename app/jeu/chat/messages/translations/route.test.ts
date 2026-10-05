import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), translate: vi.fn() }));
vi.mock("@/lib/supabase/authenticated-user", () => ({ getAuthenticatedUser: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/services/global-chat-translation", () => ({ getOrCreateGlobalChatTranslations: mocks.translate }));
import { POST } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const own = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const query = { select: vi.fn(), in: vi.fn().mockResolvedValue({ data: [{ id, sporting_director_id: "other", message: "Bonjour", edited_at: null }, { id: own, sporting_director_id: "self", message: "Personnel", edited_at: null }], error: null }) };
  query.select.mockReturnValue(query);
  const client = { rpc: vi.fn().mockResolvedValue({ data: [{ sporting_director_id: "self" }], error: null }), from: vi.fn(() => query) };
  mocks.client.mockResolvedValue(client); mocks.auth.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  mocks.translate.mockResolvedValue([{ messageId: id, status: "loaded", translation: { translatedText: "Hello" } }]);
  return { client, query };
}
const request = (body: unknown) => new Request("https://cyclostratege.fr/jeu/chat/messages/translations", { method: "POST", headers: { "x-vercel-oidc-token": "server-token" }, body: JSON.stringify(body) });
beforeEach(() => vi.resetAllMocks());
describe("automatic translation route", () => {
  it.each([null, {}, { messageIds: [id], targetLocale: "unknown" }, { messageIds: Array(6).fill(id), targetLocale: "en" }, { messageIds: ["invalid"], targetLocale: "en" }])("rejects invalid batches before authentication", async (body) => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("requires a session before reading chat data", async () => {
    const f = fixture(); mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request({ messageIds: [id], targetLocale: "en" }))).status).toBe(401); expect(f.client.from).not.toHaveBeenCalled();
  });
  it("uses session RLS and stable v2 identity, excludes own messages and deduplicates IDs", async () => {
    const f = fixture(); const response = await POST(request({ messageIds: [id, id, own], targetLocale: "ES" }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(f.query.in).toHaveBeenCalledWith("id", [id, own]); expect(f.client.rpc).toHaveBeenCalledWith("get_current_global_chat_identity_v2");
    expect(mocks.translate).toHaveBeenCalledWith({ sources: [{ messageId: id, sourceMessage: "Bonjour", sourceEditedAt: null }], targetLocale: "es", requesterDirectorId: "self", vercelOidcToken: "server-token" });
  });
  it("never translates unreadable/deleted messages and reports provider failure independently", async () => {
    const f = fixture(); f.query.in.mockResolvedValueOnce({ data: [], error: null });
    expect((await POST(request({ messageIds: [id], targetLocale: "en" }))).status).toBe(200); expect(mocks.translate).not.toHaveBeenCalled();
    mocks.translate.mockRejectedValueOnce(new Error("provider unavailable"));
    const response = await POST(request({ messageIds: [id], targetLocale: "en" })); expect(response.status).toBe(503); expect(response.headers.get("Retry-After")).toBe("120");
  });
});
