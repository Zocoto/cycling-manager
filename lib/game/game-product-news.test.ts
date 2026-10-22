import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_GAME_NEWS_DOCUMENT,
  GAME_NEWS_EMOJIS,
  GAME_NEWS_IMAGES,
  gameNewsDocumentSchema,
  gameNewsDraftDocumentSchema,
  isSafeNewsLink,
  localizeGameNews,
  replaceNewsEmojiShortcodes,
} from "./game-product-news";

const document = {
  ...EMPTY_GAME_NEWS_DOCUMENT,
  title: "Le peloton évolue",
  category: "Nouveauté",
  summary: "Une actualité à découvrir dans le jeu.",
  body: "Voici une nouvelle annonce complète pour la communauté.",
};

describe("game news publication and draft validation", () => {
  it("accepts an incomplete or entirely empty private draft but never publishes it", () => {
    expect(gameNewsDraftDocumentSchema.safeParse(EMPTY_GAME_NEWS_DOCUMENT).success).toBe(true);
    expect(gameNewsDocumentSchema.safeParse(EMPTY_GAME_NEWS_DOCUMENT).success).toBe(false);
    const incomplete = { ...document, title: "A", category: "", summary: "", body: "", title_en: "B" };
    expect(gameNewsDraftDocumentSchema.safeParse(incomplete).success).toBe(true);
    expect(gameNewsDocumentSchema.safeParse(incomplete).success).toBe(false);
  });
  it("publishes valid French content without requiring an English translation", () => {
    expect(gameNewsDocumentSchema.safeParse(document).success).toBe(true);
    expect(gameNewsDocumentSchema.parse({ ...document, title: "  Le peloton évolue  " }).title).toBe("Le peloton évolue");
  });
  it.each([
    ["title", "1234"], ["category", "A"], ["summary", "123456789"], ["body", "123456789"],
    ["title_en", "1234"], ["category_en", "A"], ["summary_en", "123456789"], ["body_en", "123456789"],
  ])("requires a useful nonempty publication field: %s", (field, value) => {
    expect(gameNewsDocumentSchema.safeParse({ ...document, [field]: value }).success).toBe(false);
    expect(gameNewsDraftDocumentSchema.safeParse({ ...document, [field]: value }).success).toBe(true);
  });
  it.each([
    ["title", 161], ["category", 61], ["summary", 501], ["body", 30001],
    ["title_en", 161], ["category_en", 61], ["summary_en", 501], ["body_en", 30001],
    ["image_alt", 181], ["link_label", 81], ["link_url", 501],
  ])("bounds draft and publication input lengths: %s", (field, length) => {
    const oversized = { ...document, [field]: "x".repeat(length) };
    expect(gameNewsDocumentSchema.safeParse(oversized).success).toBe(false);
    expect(gameNewsDraftDocumentSchema.safeParse(oversized).success).toBe(false);
  });
  it("rejects unexpected author/role/publication metadata in documents", () => {
    for (const field of ["owner", "role", "publishedAt", "created_by", "status", "id"]) {
      expect(gameNewsDocumentSchema.safeParse({ ...document, [field]: "injected" }).success).toBe(false);
      expect(gameNewsDraftDocumentSchema.safeParse({ ...document, [field]: "injected" }).success).toBe(false);
    }
  });
  it.each([
    "https://example.org/image.png", "//evil.example.org/image.png", "/images/../secret", "/images/%2e%2e/secret", "/images//secret", "/images/x.png?query=x", "/images/x.png#frag", "/images/evil\\x.png", "/other/images/x.png",
  ])("rejects unsafe/nonlocal image paths: %s", (image_path) => {
    expect(gameNewsDocumentSchema.safeParse({ ...document, image_path }).success).toBe(false);
    expect(gameNewsDraftDocumentSchema.safeParse({ ...document, image_path }).success).toBe(false);
  });
  it("only suggests existing local images and accepts those selected paths", () => {
    for (const image of GAME_NEWS_IMAGES) {
      expect(gameNewsDocumentSchema.safeParse({ ...document, image_path: image.path }).success, image.path).toBe(true);
      if (image.path) expect(existsSync(path.join(process.cwd(), "public", image.path)), image.path).toBe(true);
    }
  });
});

describe("isSafeNewsLink", () => {
  it.each(["/", "/jeu/calendrier", "/guide#staff", "/nouveautes/news-1?origine=fil", "https://example.org/actualites"])("accepts a local route or HTTPS destination: %s", (url) => {
    expect(isSafeNewsLink(url)).toBe(true);
  });
  it.each([
    "", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,script", "vbscript:alert", "file:///C:/secret", "http://example.org", "HTTPS://example.org/actualites", "//example.org", "/%2Fexample.org", "/%5Cexample.org", "/\\example.org", "https://example.org/a b", "https://example.org/\npath", "https://example.org/\tpath", "https://example.org/\u0000path", "https://example.org/\u007fpath", " https://example.org", "example.org", "#staff",
  ])("does not activate dangerous, ambiguous or unsupported URLs: %s", (url) => {
    expect(isSafeNewsLink(url)).toBe(false);
    if (url === url.trim()) expect(gameNewsDocumentSchema.safeParse({ ...document, link_url: url || "javascript:bad" }).success).toBe(false);
  });
  it("normalizes harmless surrounding whitespace before validating a destination", () => {
    expect(gameNewsDocumentSchema.parse({ ...document, link_url: "  https://example.org  " }).link_url).toBe("https://example.org");
  });
});

describe("news emojis and localization", () => {
  it("supports all advertised Discord-like emoji codes, case insensitively", () => {
    for (const item of GAME_NEWS_EMOJIS) {
      expect(replaceNewsEmojiShortcodes(`Avant :${item.code}: après`)).toBe(`Avant ${item.emoji} après`);
      expect(replaceNewsEmojiShortcodes(`:${item.code.toUpperCase()}:`)).toBe(item.emoji);
    }
    expect(replaceNewsEmojiShortcodes(":inconnu: :tada: :warning:")).toBe(":inconnu: 🎉 ⚠️");
  });
  it("selects English field by field and leaves the original French content untouched", () => {
    const bilingual = { ...document, title_en: "The peloton evolves", body_en: "A complete English announcement." };
    expect(localizeGameNews(bilingual, "en")).toEqual({ title: bilingual.title_en, category: document.category, summary: document.summary, body: bilingual.body_en });
    expect(localizeGameNews(bilingual, "fr")).toEqual({ title: document.title, category: document.category, summary: document.summary, body: document.body });
    expect(bilingual.title).toBe(document.title);
  });
});
