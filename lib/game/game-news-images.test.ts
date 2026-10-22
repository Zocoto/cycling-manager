import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_NEWS_IMAGE_PREFIX, isGameNewsImageFilename, uploadGameNewsIllustration } from "./game-news-images";
const filename = `${"a".repeat(64)}.webp`;
const path = `${GAME_NEWS_IMAGE_PREFIX}${filename}`;
const file = () => new File(["image"], "news.png", { type: "image/png" });
afterEach(() => vi.unstubAllGlobals());

describe("news illustration uploads", () => {
  it("uploads only on request, with same-origin credentials and no draft text", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ image: { path, width: 1200, height: 600 } }));
    vi.stubGlobal("fetch", fetcher);
    expect(await uploadGameNewsIllustration(file())).toBe(path);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/game/news/images", expect.objectContaining({ method: "POST", credentials: "same-origin" }));
    expect([...fetcher.mock.calls[0][1].body.keys()]).toEqual(["image"]);
  });
  it("rejects unsupported and oversized files without a network call", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(uploadGameNewsIllustration(new File(["svg"], "bad.svg", { type: "image/svg+xml" }))).rejects.toThrow("Formats");
    await expect(uploadGameNewsIllustration(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }))).rejects.toThrow("volumineuse");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not confirm failed, unsafe or incomplete server responses", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    fetcher.mockResolvedValue(Response.json({ error: "Accès refusé" }, { status: 403 }));
    await expect(uploadGameNewsIllustration(file())).rejects.toThrow("Accès refusé");
    for (const image of [{ path: "https://evil.test/x.png", width: 10, height: 10 }, { path }, { path, width: 0, height: 10 }, { path, width: 1601, height: 10 }]) {
      fetcher.mockResolvedValue(Response.json({ image }));
      await expect(uploadGameNewsIllustration(file())).rejects.toThrow("confirmé");
    }
  });
  it.each(["../secret", "/images/x.png", "a.webp", `${"g".repeat(64)}.webp`, `${filename}?x=1`])("refuses arbitrary asset names: %s", name => {
    expect(isGameNewsImageFilename(name)).toBe(false);
  });
});
