import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatGifAttachment } from "@/lib/game/chat-gifs";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }) }));
import { postGlobalChatGifMessageAction } from "./actions";
const requestId = "11111111-1111-4111-8111-111111111111";
const gif: ChatGifAttachment = { provider: "klipy", kind: "gif", id: "123", slug: "victory", title: "Victoire",
  url: "https://static.klipy.com/a.gif", previewUrl: "https://static.klipy.com/a.jpg", width: 320, height: 240 };

describe("chat GIF send action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mock.rpc.mockResolvedValue({ data: { id: requestId, message: "Bravo", gif_attachment: gif }, error: null });
  });
  it("delegates the attachment, reply, mentions and stable retry ID to one atomic RPC", async () => {
    const result = await postGlobalChatGifMessageAction("Bravo", gif, requestId, requestId, [requestId, requestId]);
    expect(mock.rpc).toHaveBeenCalledWith("post_global_chat_gif_message", {
      p_message: "Bravo", p_gif: gif, p_request_id: requestId, p_reply_to_message_id: requestId, p_mentioned_sporting_director_ids: [requestId],
    });
    expect(result.gif).toEqual(gif);
  });
  it("supports an attachment without text", async () => {
    await postGlobalChatGifMessageAction("", gif, requestId);
    expect(mock.rpc.mock.calls[0][1].p_message).toBe("");
  });
  it.each(["https://evil.test/a.gif", "data:image/gif;base64,abc"])("rejects an untrusted URL before any database call", async url => {
    await expect(postGlobalChatGifMessageAction("", { ...gif, url }, requestId)).rejects.toThrow("invalide");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("retains existing text and link restrictions", async () => {
    await expect(postGlobalChatGifMessageAction("https://evil.test", gif, requestId)).rejects.toThrow("invalide");
    await expect(postGlobalChatGifMessageAction("x".repeat(501), gif, requestId)).rejects.toThrow("invalide");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(postGlobalChatGifMessageAction("", gif, requestId)).rejects.toThrow("connecté");
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("reports a failed send without a success result", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: "Service indisponible" } });
    await expect(postGlobalChatGifMessageAction("Bravo", gif, requestId)).rejects.toThrow("Service indisponible");
  });
});
