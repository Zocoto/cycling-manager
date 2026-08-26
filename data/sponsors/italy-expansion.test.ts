import { stat } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ITALIAN_SPONSORS } from "./italy";

const newSponsorIds = [
  "seta-lario",
  "cantieri-tirreno",
  "emilia-automazione",
  "vetro-laguna",
  "pelletteria-arno",
  "riso-del-po",
  "pomodoro-vesuvio",
  "caseificio-delle-murge",
  "dolomiti-arredo",
  "ottica-bellagio",
] as const;
const newSponsors = newSponsorIds.map((id) => {
  const sponsor = ITALIAN_SPONSORS.find((candidate) => candidate.id === id);
  if (!sponsor) throw new Error(`Sponsor italien absent du catalogue : ${id}`);
  return sponsor;
});

describe("extension des sponsors italiens", () => {
  it("ajoute dix marques sans remplacer les dix marques existantes", () => {
    expect(ITALIAN_SPONSORS).toHaveLength(20);
    expect(newSponsors.map((sponsor) => sponsor.id)).toEqual(newSponsorIds);
  });

  it("couvre les cinq niveaux de prestige et une large gamme de budgets", () => {
    expect(new Set(newSponsors.map((sponsor) => sponsor.prestige))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    );
    expect(Math.min(...newSponsors.map((sponsor) => sponsor.budgetRange.min))).toBe(
      90_000,
    );
    expect(Math.max(...newSponsors.map((sponsor) => sponsor.budgetRange.max))).toBe(
      2_000_000,
    );
  });

  it("propose trois maillots nommés et distincts par marque", () => {
    for (const sponsor of newSponsors) {
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual([
        "classic",
        "modern",
        "bold",
      ]);
      expect(new Set(sponsor.jerseys.map((jersey) => jersey.name)).size).toBe(3);
    }
  });

  it("respecte un budget d’assets très léger", async () => {
    const assetPaths = newSponsors.flatMap((sponsor) => [
      sponsor.logoPath,
      ...sponsor.jerseys.map((jersey) => jersey.imagePath),
    ]);
    const sizes = await Promise.all(
      assetPaths.map(async (publicPath) => {
        const absolutePath = path.join(
          process.cwd(),
          "public",
          publicPath.replace(/^\/+/, ""),
        );
        return (await stat(absolutePath)).size;
      }),
    );

    expect(Math.max(...sizes)).toBeLessThanOrEqual(100_000);
    expect(sizes.reduce((total, size) => total + size, 0)).toBeLessThanOrEqual(
      2_000_000,
    );
  });
});
