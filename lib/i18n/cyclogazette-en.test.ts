import { describe, expect, it } from "vitest";

import {
  localizeCyclogazetteText,
  localizePublicGameNewsItem,
} from "@/lib/i18n/cyclogazette-en";

describe("English Cyclogazette copy", () => {
  it("translates stored system templates while preserving names", () => {
    expect(localizeCyclogazetteText("Alice Martin s’impose", "en")).toBe(
      "Alice Martin wins",
    );
    expect(
      localizeCyclogazetteText("Vélo Club remporte Tour des Alpes.", "en"),
    ).toBe("Vélo Club wins Tour des Alpes.");
  });

  it("keeps French mode and the news item identity unchanged", () => {
    const item = {
      id: "victory:1",
      kind: "victory" as const,
      title: "Alice Martin s’impose",
      detail: "Vélo Club remporte Tour des Alpes.",
      happenedAt: "2026-08-16T18:00:00Z",
    };

    expect(localizePublicGameNewsItem(item, "fr")).toBe(item);
    expect(localizePublicGameNewsItem(item, "en")).toMatchObject({
      id: item.id,
      title: "Alice Martin wins",
      detail: "Vélo Club wins Tour des Alpes.",
    });
  });
});
