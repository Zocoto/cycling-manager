import { describe, expect, it } from "vitest";

import {
  extractGlobalChatPreviewReference,
  normalizeGlobalChatMessage,
} from "@/lib/game/global-chat";

const TEAM_ID = "f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57";
const RIDER_ID = "6b01ad75-9cdb-4f4a-9b24-143fe9e6f4e2";

describe("global chat links", () => {
  it("extracts a relative team profile URL", () => {
    expect(
      extractGlobalChatPreviewReference(
        `Regardez cette équipe : /jeu/equipes/${TEAM_ID}.`,
      ),
    ).toEqual({
      type: "team",
      entityId: TEAM_ID,
      href: `/jeu/equipes/${TEAM_ID}`,
    });
  });

  it("extracts a rider profile from an absolute URL", () => {
    expect(
      extractGlobalChatPreviewReference(
        `https://cyclo-stratege.test/jeu/coureurs/${RIDER_ID}?onglet=palmares`,
      ),
    ).toEqual({
      type: "rider",
      entityId: RIDER_ID,
      href: `/jeu/coureurs/${RIDER_ID}`,
    });
  });

  it("ignores unrelated and malformed links", () => {
    expect(
      extractGlobalChatPreviewReference(
        `https://example.com/equipes/${TEAM_ID}`,
      ),
    ).toBeNull();
    expect(
      extractGlobalChatPreviewReference("/jeu/equipes/pas-un-uuid"),
    ).toBeNull();
  });
});

describe("global chat messages", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeGlobalChatMessage("  Bonjour \n à   tous  ")).toBe(
      "Bonjour à tous",
    );
  });
});
