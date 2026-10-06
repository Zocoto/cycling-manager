import { describe, expect, it } from "vitest";
import { CHAT_IMAGE_SOURCE_MAX_BYTES, getPastedChatImages, isChatImageOnlyMessage, readChatImageAttachment, validateChatImage } from "./chat-images";

const id = "12345678-1234-4234-8234-123456789abc";
describe("chat image clipboard and limits", () => {
  it("does not send generated image-only labels to the translation provider", () => {
    const image = { href: "/api/game/chat/images/id", width: 10, height: 10 };
    expect(isChatImageOnlyMessage({ image, message: "Image jointe" })).toBe(true);
    expect(isChatImageOnlyMessage({ image, message: "Regardez ce résultat" })).toBe(false);
    expect(isChatImageOnlyMessage({ message: "Image jointe" })).toBe(false);
  });
  it("leaves ordinary text and HTML pastes alone (no remote image fetching)", () => {
    const clipboard = { items: [{ kind: "string", type: "text/html" }], files: [] } as unknown as DataTransfer;
    expect(getPastedChatImages(clipboard)).toEqual([]);
  });
  it("uses the file from the paste event, not navigator.clipboard", () => {
    const file = new File(["pixels"], "capture.png", { type: "image/png" });
    const clipboard = { items: [{ kind: "file", type: file.type, getAsFile: () => file }], files: [file] } as unknown as DataTransfer;
    expect(getPastedChatImages(clipboard)).toEqual([file]); // no items/files duplication
  });
  it("falls back to files and excludes unrelated files", () => {
    const file = new File(["pixels"], "capture.webp", { type: "image/webp" });
    const text = new File(["text"], "note.txt", { type: "text/plain" });
    expect(getPastedChatImages({ items: [], files: [text, file] } as unknown as DataTransfer)).toEqual([file]);
  });
  it("keeps multiple pasted images detectable so the composer rejects them", () => {
    const file = new File(["a"], "a.png", { type: "image/png" });
    expect(getPastedChatImages({ items: [], files: [file, file] } as unknown as DataTransfer)).toHaveLength(2);
  });
  it("rejects empty, huge, SVG and GIF files", () => {
    for (const file of [{ type: "image/svg+xml", size: 100 }, { type: "image/gif", size: 100 }, { type: "image/png", size: 0 }, { type: "image/jpeg", size: CHAT_IMAGE_SOURCE_MAX_BYTES + 1 }]) expect(validateChatImage(file)).not.toBeNull();
    expect(validateChatImage({ type: "image/png", size: 100 })).toBeNull();
  });
  it("maps only validated attachments to an internal authenticated route", () => {
    const row = { id, image_path: `${id}/${id}.webp`, image_width: 1200, image_height: 800 };
    expect(readChatImageAttachment(row)).toEqual({ href: `/api/game/chat/images/${id}`, width: 1200, height: 800 });
    expect(readChatImageAttachment({ ...row, image_path: "https://tracker.example/image" })).toBeNull();
    expect(readChatImageAttachment({ ...row, image_width: 1601 })).toBeNull();
    expect(readChatImageAttachment({ ...row, image_height: 2.5 })).toBeNull();
    expect(readChatImageAttachment({ id })).toBeNull();
  });
});
