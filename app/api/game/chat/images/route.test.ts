import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), reserve: vi.fn(), from: vi.fn(), process: vi.fn(), upload: vi.fn(), update: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc, from: mock.from, storage: { from: () => ({ createSignedUrl: mock.signed }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mock.reserve, storage: { from: () => ({ upload: mock.upload }) }, from: () => ({ update: mock.update }) }) }));
vi.mock("@/services/chat-image-processing", () => ({ processChatImage: mock.process }));
vi.mock("@/services/global-chat-preview", () => ({ resolveGlobalChatPreviewPalette: vi.fn() }));
import { POST } from "./route";
import { GET } from "./[messageId]/route";

const userId = "12345678-1234-4234-8234-123456789abc";
const requestId = "22345678-1234-4234-8234-123456789abc";
const messageId = "32345678-1234-4234-8234-123456789abc";
const row = { id: messageId, message: "Image jointe", sporting_director_id: userId, team_id: userId, image_path: `${userId}/${requestId}.webp`, image_width: 600, image_height: 300, created_at: new Date().toISOString() };
function request(message = "", origin = "https://cyclostratege.fr") {
  const form = new FormData(); form.set("image", new File(["webp"], "capture.webp", { type: "image/webp" }));
  form.set("requestId", requestId); form.set("message", message); form.set("mentionedDirectorIds", "[]");
  return new Request("https://cyclostratege.fr/api/game/chat/images", { method: "POST", body: form, headers: { origin } });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  mock.reserve.mockResolvedValue({ data: { message_id: null, width: null, height: null }, error: null });
  mock.process.mockResolvedValue({ data: Buffer.from("webp"), width: 600, height: 300 });
  mock.upload.mockResolvedValue({ error: null });
  mock.update.mockReturnValue({ eq: () => ({ eq: async () => ({ error: null }) }) });
  mock.rpc.mockResolvedValue({ data: row, error: null });
  mock.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) });
  mock.signed.mockResolvedValue({ data: { signedUrl: "https://storage.example/signed/image" }, error: null });
});
describe("authenticated chat image send", () => {
  it("rejects cross-site requests before reading or authenticating", async () => {
    expect((await POST(request("", "https://evil.example"))).status).toBe(403);
    expect(mock.getUser).not.toHaveBeenCalled(); expect(mock.reserve).not.toHaveBeenCalled();
  });
  it("rejects anonymous sends before any privileged upload", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401); expect(mock.reserve).not.toHaveBeenCalled();
  });
  it("preserves caption link restrictions", async () => {
    expect((await POST(request("https://external.example"))).status).toBe(400);
    expect(mock.reserve).not.toHaveBeenCalled();
  });
  it("checks quotas before decoding and uploads only server-processed bytes", async () => {
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(mock.reserve).toHaveBeenCalledWith("reserve_global_chat_image_upload", { p_user_id: userId, p_request_id: requestId });
    expect(mock.upload).toHaveBeenCalledWith(`${userId}/${requestId}.webp`, Buffer.from("webp"), expect.objectContaining({ contentType: "image/webp", upsert: false }));
    expect(mock.rpc).toHaveBeenCalledWith("post_global_chat_image_message", expect.objectContaining({ p_request_id: requestId, p_message: "" }));
    expect((await response.json()).message.image.href).toBe(`/api/game/chat/images/${messageId}`);
  });
  it("denied quotas do not consume processing or storage", async () => {
    mock.reserve.mockResolvedValue({ error: { message: "Limite atteinte" }, data: null });
    expect((await POST(request())).status).toBe(429);
    expect(mock.process).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it("a retry of an already sent image neither uploads nor posts twice", async () => {
    mock.reserve.mockResolvedValue({ data: { message_id: messageId }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(mock.process).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.upload).not.toHaveBeenCalled();
  });
  it("reuses a prepared upload after the message transaction fails", async () => {
    mock.reserve.mockResolvedValue({ data: { message_id: null, width: 600, height: 300 }, error: null });
    expect((await POST(request())).status).toBe(200); expect(mock.process).not.toHaveBeenCalled(); expect(mock.rpc).toHaveBeenCalledOnce();
  });
});
describe("private chat image read", () => {
  it("requires authentication and never accepts arbitrary storage paths", async () => {
    const invalid = await GET(new Request("https://cyclostratege.fr"), { params: Promise.resolve({ messageId: "../../secret" }) });
    expect(invalid.status).toBe(404); expect(mock.getUser).not.toHaveBeenCalled();
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(new Request("https://cyclostratege.fr"), { params: Promise.resolve({ messageId }) })).status).toBe(401);
    expect(mock.signed).not.toHaveBeenCalled();
  });
  it("redirects to Storage with private, short-lived browser caching", async () => {
    const response = await GET(new Request("https://cyclostratege.fr"), { params: Promise.resolve({ messageId }) });
    expect(response.status).toBe(302); expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(response.headers.get("Vary")).toBe("Cookie"); expect(mock.signed).toHaveBeenCalledWith(row.image_path, 3600);
  });
});
