import { describe, expect, it, vi } from "vitest";
import { pruneChatImages } from "./chat-image-maintenance";
describe("bounded chat image cleanup", () => {
  it("uses the Storage API before marking expired attachments as cleaned", async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: [{ id: "id", path: "owner/id.webp" }] }).mockResolvedValueOnce({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    expect(await pruneChatImages({ rpc, storage: { from: () => ({ remove }) } } as never)).toBe(1);
    expect(rpc).toHaveBeenNthCalledWith(1,"get_expired_global_chat_images",{ p_limit: 100 });
    expect(remove).toHaveBeenCalledWith(["owner/id.webp"]);
    expect(rpc).toHaveBeenNthCalledWith(2,"finish_global_chat_image_cleanup",{ p_ids: ["id"] });
  });
  it("does not lose cleanup references when storage deletion fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ id: "id", path: "owner/id.webp" }] });
    const remove = vi.fn().mockResolvedValue({ error: new Error("storage unavailable") });
    await expect(pruneChatImages({ rpc, storage: { from: () => ({ remove }) } } as never)).rejects.toThrow("storage unavailable");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
