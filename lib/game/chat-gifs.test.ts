import { describe, expect, it } from "vitest";
import { buildKlipySearchUrl, isKlipyMediaUrl, readChatGifAttachment, readKlipyPage } from "./chat-gifs";

const media = { provider: "klipy", kind: "gif", id: "123", slug: "happy-cyclist", title: "Victoire",
  url: "https://static.klipy.com/media/happy.gif?delivery=keep-this", previewUrl: "https://static1.klipy.com/media/happy.jpg", width: 320, height: 240 };
describe("KLIPY chat media", () => {
  it("keeps the exact provider URLs and only known metadata", () => {
    expect(readChatGifAttachment({ ...media, unwanted: "value" })).toEqual(media);
  });
  it.each(["http://static.klipy.com/a.gif", "https://static.klipy.com.evil.test/a.gif", "https://evil.test/a.gif", "data:image/gif;base64,abc", "https://user:password@static.klipy.com/a.gif", "https://static.klipy.com:444/a.gif", "https://static.klipy.com/a.gif#fragment", "https://static.klipy.com/a b.gif"])("rejects unsafe media URL %s", url => {
    expect(isKlipyMediaUrl(url)).toBe(false);
    expect(readChatGifAttachment({ ...media, url })).toBeNull();
  });
  it.each([{ width: 0 }, { height: 9999 }, { width: 1.5 }, { provider: "other" }, { slug: "../../trick" }, { title: "" }])("rejects malformed metadata %j", invalid => {
    expect(readChatGifAttachment({ ...media, ...invalid })).toBeNull();
  });
  it("uses a bounded client-side, filtered French search and preserves the user's query", () => {
    const url = new URL(buildKlipySearchUrl("public-app-key", "bravo !", "gif", 2, "opaque-customer"));
    expect(url.origin).toBe("https://api.klipy.com");
    expect(url.pathname).toBe("/api/v1/public-app-key/gifs/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: "bravo !", locale: "fr", content_filter: "high", per_page: "16", page: "2", customer_id: "opaque-customer" });
    expect(new URL(buildKlipySearchUrl("key", "", "meme", 1, "opaque")).pathname).toBe("/api/v1/key/static-memes/trending");
  });
  it("preserves provider order and does not remove unavailable cells", () => {
    const item = { id: 123, slug: "happy-cyclist", title: "Victoire", file: { md: { gif: { url: media.url, width: 320, height: 240 } }, xs: { jpg: { url: media.previewUrl } } } };
    const page = readKlipyPage({ result: true, data: { data: [item, { id: 456 }, { ...item, id: 789 }], has_next: true } }, "gif");
    expect(page.items.map(row => row.media?.id ?? null)).toEqual(["123", null, "789"]);
    expect(page.items[0].media).toEqual(media);
    expect(page.hasNext).toBe(true);
  });
  it("fails clearly if the provider response is unavailable", () => {
    expect(() => readKlipyPage({ result: false }, "gif")).toThrow("momentanément indisponibles");
  });
});
