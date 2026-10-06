import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processChatImage } from "./chat-image-processing";
import { CHAT_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/game/chat-images";

describe("server chat image processing (real decoder)", () => {
  it("resizes and strips EXIF/GPS without distorting the image", async () => {
    const source = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#176951" } }).withMetadata().png().toBuffer();
    const result = await processChatImage(new File([new Uint8Array(source)], "capture.png", { type: "image/png" }));
    const metadata = await sharp(result.data).metadata();
    expect(result.width).toBe(1600); expect(result.height).toBe(800);
    expect(metadata.format).toBe("webp"); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
    expect(result.data.length).toBeLessThan(768 * 1024);
  });
  it("does not upscale small screenshots", async () => {
    const source = await sharp({ create: { width: 80, height: 40, channels: 4, background: "transparent" } }).webp().toBuffer();
    const result = await processChatImage(new File([new Uint8Array(source)], "small.webp", { type: "image/webp" }));
    expect([result.width, result.height]).toEqual([80, 40]);
  });
  it("rejects spoofed MIME/SVG before invoking the decoder", async () => {
    await expect(processChatImage(new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "fake.png", { type: "image/png" }))).rejects.toThrow("contenu");
    await expect(processChatImage(new File(["not an image"], "fake.webp", { type: "image/webp" }))).rejects.toThrow("contenu");
  });
  it("rejects oversized uploads and decompression bombs", async () => {
    await expect(processChatImage(new File([new Uint8Array(CHAT_IMAGE_UPLOAD_MAX_BYTES + 1)], "huge.png", { type: "image/png" }))).rejects.toThrow("volumineuse");
    const source = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "black" } }).png().toBuffer();
    await expect(processChatImage(new File([new Uint8Array(source)], "pixels.png", { type: "image/png" }))).rejects.toThrow();
  });
});
