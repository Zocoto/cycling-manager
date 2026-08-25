import { describe, expect, it } from "vitest";

import {
  extractGlobalChatPreviewReference,
  getGlobalChatMentionQuery,
  getGlobalChatHistoryStart,
  globalChatMessageMentionsUsername,
  hasForbiddenGlobalChatLink,
  isGlobalChatCursor,
  normalizeGlobalChatMessage,
  stripGlobalChatCyclingReactionTokens,
} from "@/lib/game/global-chat";

const TEAM_ID = "f2e292c0-0c9e-41a2-8cd8-ed2a6bf83b57";
const RIDER_ID = "6b01ad75-9cdb-4f4a-9b24-143fe9e6f4e2";
const DIRECTOR_USERNAME = "Fra Troisset";

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

  it("extracts a public sporting director profile", () => {
    expect(
      extractGlobalChatPreviewReference(
        "À suivre : https://cyclostratege.fr/jeu/directeurs-sportifs/Fra%20Troisset",
      ),
    ).toEqual({
      type: "director",
      entityId: DIRECTOR_USERNAME,
      href: "/jeu/directeurs-sportifs/Fra%20Troisset",
    });
  });

  it("allows only Cyclo Stratège rider, team and director profile links", () => {
    expect(
      hasForbiddenGlobalChatLink(`/jeu/equipes/${TEAM_ID}`),
    ).toBe(false);
    expect(
      hasForbiddenGlobalChatLink(
        `https://cyclostratege.fr/jeu/coureurs/${RIDER_ID}?onglet=palmares`,
      ),
    ).toBe(false);
    expect(
      hasForbiddenGlobalChatLink(
        `cyclostratege.fr/jeu/equipes/${TEAM_ID}`,
      ),
    ).toBe(false);
    expect(
      hasForbiddenGlobalChatLink(
        "https://cyclostratege.fr/jeu/directeurs-sportifs/Fra%20Troisset",
      ),
    ).toBe(false);
    expect(hasForbiddenGlobalChatLink("https://example.com/video")).toBe(true);
    expect(hasForbiddenGlobalChatLink("regardez example.fr/video")).toBe(true);
    expect(hasForbiddenGlobalChatLink("https://cyclostratege.fr/jeu/chat")).toBe(
      true,
    );
    expect(hasForbiddenGlobalChatLink("Contact : ds@example.fr")).toBe(false);
  });
});

describe("global chat mentions", () => {
  it("finds the active @ query, including usernames with spaces", () => {
    expect(getGlobalChatMentionQuery("Bravo @Fra Trois", 16)).toEqual({
      query: "Fra Trois",
      start: 6,
      end: 16,
    });
    expect(getGlobalChatMentionQuery("@Ali\nSuite", 10)).toBeNull();
  });

  it("recognizes a selected username case-insensitively", () => {
    expect(
      globalChatMessageMentionsUsername("Bravo @Fra Trois !", "fra trois"),
    ).toBe(true);
    expect(globalChatMessageMentionsUsername("Bravo Fra Trois", "Fra Trois"))
      .toBe(false);
  });
});

describe("global chat messages", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeGlobalChatMessage("  Bonjour \n à   tous  ")).toBe(
      "Bonjour à tous",
    );
  });

  it("hides legacy cycling GIF tokens while keeping their text", () => {
    expect(
      stripGlobalChatCyclingReactionTokens(
        "[cycling-reaction:attack] Quelle attaque !",
      ),
    ).toBe("Quelle attaque !");
    expect(
      stripGlobalChatCyclingReactionTokens("[cycling-reaction:too_early]"),
    ).toBe("");
  });

  it("preserves supported cycling GIF tokens in new messages", () => {
    expect(
      normalizeGlobalChatMessage(
        "[cycling-reaction:snack_attack] Bonjour à tous",
      ),
    ).toBe("[cycling-reaction:snack_attack] Bonjour à tous");
  });
  it("limits visible history to the latest thirty days", () => {
    expect(
      getGlobalChatHistoryStart(new Date("2026-07-29T12:00:00.000Z")),
    ).toBe("2026-06-29T12:00:00.000Z");
  });

  it("accepts only a complete timestamp and UUID pagination cursor", () => {
    expect(
      isGlobalChatCursor({
        createdAt: "2026-07-29T12:00:00.000Z",
        id: TEAM_ID,
      }),
    ).toBe(true);
    expect(
      isGlobalChatCursor({
        createdAt: "not-a-date",
        id: TEAM_ID,
      }),
    ).toBe(false);
    expect(
      isGlobalChatCursor({
        createdAt: "2026-07-29 12:00:00Z",
        id: TEAM_ID,
      }),
    ).toBe(false);
    expect(
      isGlobalChatCursor({
        createdAt: "2026-07-29T12:00:00.000Z",
        id: "not-an-id",
      }),
    ).toBe(false);
  });
});
