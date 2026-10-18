import {
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type NationalJerseyKind,
} from "@/lib/game/national-jersey-preview";
import type { CyclogazetteFeatureStory } from "@/lib/game/cyclogazette";

export type CyclogazetteJerseyReveal = {
  countryCode: string;
  countryName: string;
  kind: NationalJerseyKind;
  design: NationalJerseyDraft;
  version: number;
  publishedAt: string;
  rider: {
    id: string;
    name: string;
    avatarProfileKey: string | null;
    avatarSeed: string | null;
    championshipType: "road" | "time_trial" | null;
  } | null;
};

export type GazetteJerseyChangeRow = {
  country_id: string;
  country_code: string;
  country_name: string;
  jersey_kind: NationalJerseyKind;
  version: number;
  design: NationalJerseyDraft;
  previous_design: NationalJerseyDraft | null;
  published_at: string;
  rider_id: string | null;
  rider_name: string;
  avatar_profile_key: string | null;
  avatar_seed: string | null;
  championship_type: "road" | "time_trial" | null;
};

function visualSignature(design: NationalJerseyDraft) {
  const normalized = normalizeNationalJerseyDraft(design);
  return JSON.stringify({
    baseColor: normalized.baseColor,
    // Layer IDs and legacy omitted borders do not alter the artwork.
    elements: normalized.elements.map(element => ({
      kind: element.kind,
      shape: element.kind === "text" || element.kind === "band" ? undefined : element.shape,
      color: element.kind === "flag" ? undefined : element.color,
      secondaryColor: (element.kind === "flag" || element.kind === "text") && element.border === false ? undefined : element.secondaryColor,
      x: element.x, y: element.y,
      width: element.width, height: element.height, rotation: element.rotation,
      opacity: element.opacity, text: element.text,
      border: element.kind === "band" ? undefined : element.border !== false,
    })),
  });
}

export function buildCyclogazetteJerseyStories(
  rows: readonly GazetteJerseyChangeRow[],
): CyclogazetteFeatureStory[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => b.published_at.localeCompare(a.published_at) || b.version - a.version)
    .flatMap((row): CyclogazetteFeatureStory[] => {
      const key = `${row.country_id}:${row.jersey_kind}`;
      if (seen.has(key)) return [];
      seen.add(key);
      if (row.previous_design && visualSignature(row.design) === visualSignature(row.previous_design)) return [];

      const champion = row.jersey_kind === "national_champion";
      const countryCode = row.country_code.trim().toUpperCase();
      const englishName = new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ?? row.country_name;
      return [{
        id: `jersey:${key}:${row.version}`,
        kind: champion ? "national_champion_jersey" : "national_team_jersey",
        kicker: champion ? "Le vestiaire des champions" : "Les couleurs des nations",
        kickerEn: champion ? "The champions’ wardrobe" : "National colours",
        title: champion
          ? `${row.country_name} : une nouvelle tunique pour les champions nationaux`
          : `${row.country_name} : le nouveau maillot de sélection dévoilé`,
        titleEn: champion
          ? `${englishName}: a new jersey for the national champions`
          : `${englishName}: the new national team jersey revealed`,
        body: champion
          ? "La fédération dévoile la nouvelle tenue de ses champions nationaux, sur route et contre la montre. Une tunique qui les accompagnera dans le peloton jusqu’à la prochaine passation du titre."
          : "La sélection nationale change de couleurs. Voici le nouveau maillot qui représentera la nation lors des compétitions internationales.",
        bodyEn: champion
          ? "The federation unveils a new kit for its national road and time trial champions. They will wear it in the peloton until the title changes hands."
          : "A fresh look for the national team. This is the new jersey that will represent the nation in international competitions.",
        href: `/jeu/federations/${countryCode.toLowerCase()}`,
        jerseyReveal: {
          countryCode,
          countryName: row.country_name,
          kind: row.jersey_kind,
          design: normalizeNationalJerseyDraft(row.design),
          version: row.version,
          publishedAt: row.published_at,
          rider: row.rider_id ? {
            id: row.rider_id, name: row.rider_name,
            avatarProfileKey: row.avatar_profile_key, avatarSeed: row.avatar_seed,
            championshipType: row.championship_type,
          } : null,
        },
      }];
    });
}
