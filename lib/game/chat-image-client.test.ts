import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareChatImage } from "./chat-image-client";

afterEach(() => vi.unstubAllGlobals());
function browser(width = 2400, height = 1200, canEncode = true) {
  const close = vi.fn(); const drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: (callback: (value: Blob | null) => void) => callback(canEncode ? new Blob(["webp"], { type: "image/webp" }) : null) };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width, height, close }));
  vi.stubGlobal("document", { createElement: () => canvas });
  return { canvas, close, drawImage };
}
describe("client image compression", () => {
  it("compresses before network transfer and keeps the aspect ratio", async () => {
    const fake = browser();
    const result = await prepareChatImage(new File(["source"], "capture.png", { type: "image/png" }));
    expect(result.type).toBe("image/webp"); expect(result.size).toBe(4);
    expect([fake.canvas.width, fake.canvas.height]).toEqual([1600, 800]);
    expect(fake.drawImage).toHaveBeenCalledOnce(); expect(fake.close).toHaveBeenCalledOnce();
  });
  it("releases the bitmap even if encoding or pixel limits fail", async () => {
    const failed = browser(2400, 1200, false);
    await expect(prepareChatImage(new File(["source"], "capture.png", { type: "image/png" }))).rejects.toThrow();
    expect(failed.close).toHaveBeenCalledOnce();
    const huge = browser(6000, 6000);
    await expect(prepareChatImage(new File(["source"], "capture.png", { type: "image/png" }))).rejects.toThrow("pixels");
    expect(huge.close).toHaveBeenCalledOnce(); expect(huge.drawImage).not.toHaveBeenCalled();
  });
  it("rejects unsupported files before decoding", async () => {
    browser();
    await expect(prepareChatImage(new File(["svg"], "bad.svg", { type: "image/svg+xml" }))).rejects.toThrow("Formats");
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});
