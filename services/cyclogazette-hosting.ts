import "server-only";

import type { CyclogazetteFeatureStory } from "@/lib/game/cyclogazette";
import { FEDERATION_HOSTING_DECISION_DAY } from "@/lib/game/federation-hosting";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

const EVENT_LABELS = {
  world_championship_pro: ["Championnats du monde professionnels", "Professional World Championships"],
  continental_championship_pro: ["Championnats continentaux professionnels", "Professional Continental Championships"],
  nations_cup_pro: ["Nations Cup professionnelle", "Professional Nations Cup"],
  quadrennial_games_pro: ["Jeux quadriennaux professionnels", "Professional Quadrennial Games"],
  world_championship_junior: ["Championnats du monde juniors", "Junior World Championships"],
  continental_championship_junior: ["Championnats continentaux juniors", "Junior Continental Championships"],
} as const;

const CONTINENT_LABELS = new Map([
  ["africa", ["Afrique", "Africa"]],
  ["america", ["Amériques", "Americas"]],
  ["asia", ["Asie", "Asia"]],
  ["europe", ["Europe", "Europe"]],
  ["oceania", ["Océanie", "Oceania"]],
]);

const englishCountryNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });

type HostingDecisionRow = {
  target_game_year: number;
  event_key: string;
  event_type: keyof typeof EVENT_LABELS;
  continent_code: string | null;
  decision: "hosted" | "neutral";
  countries: { name: string; iso_alpha2: string } | null;
};

export async function loadCyclogazetteHostingStories(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  { gameYear, dayNumber, calendarDate, now }: {
    gameYear: number;
    dayNumber: number;
    calendarDate: string;
    now: Date;
  },
): Promise<CyclogazetteFeatureStory[]> {
  // A decision after the last closing can appear in J1 of the next season.
  if (gameYear < 5 || (dayNumber < FEDERATION_HOSTING_DECISION_DAY && dayNumber !== 1)) return [];

  const result = await admin
    .from("national_federation_hosting_decisions")
    .select("target_game_year, event_key, event_type, continent_code, decision, countries(name, iso_alpha2)")
    .eq("gazette_date", calendarDate)
    .gte("target_game_year", Math.max(6, gameYear))
    .lte("target_game_year", gameYear + 1)
    .lte("decided_at", now.toISOString())
    .order("target_game_year")
    .order("event_key")
    .limit(26)
    .returns<HostingDecisionRow[]>();

  if (result.error) {
    throw new Error(`Impossible de charger les décisions d’accueil international : ${result.error.message}`);
  }

  const seasons = new Map<number, NonNullable<CyclogazetteFeatureStory["hostingDecisions"]>>();
  for (const row of result.data ?? []) {
    const event = EVENT_LABELS[row.event_type];
    if (!event || (row.decision !== "hosted" && row.decision !== "neutral") || (row.decision === "hosted" && !row.countries)) continue;
    const continent = row.continent_code ? CONTINENT_LABELS.get(row.continent_code) : null;
    const country = row.decision === "hosted" ? row.countries : null;
    const alpha2 = country?.iso_alpha2.toUpperCase();
    const countryCode = alpha2 && /^[A-Z]{2}$/.test(alpha2) ? alpha2 : undefined;
    const decisions = seasons.get(row.target_game_year) ?? [];
    decisions.push({
      eventKey: row.event_key,
      eventName: continent ? `${event[0]} · ${continent[0]}` : event[0],
      eventNameEn: continent ? `${event[1]} · ${continent[1]}` : event[1],
      hostName: country?.name ?? "Terrain neutre",
      hostNameEn: (countryCode ? englishCountryNames.of(countryCode) : undefined) ?? country?.name ?? "Neutral venue",
      countryCode: countryCode?.toLowerCase(),
    });
    seasons.set(row.target_game_year, decisions);
  }

  return Array.from(seasons, ([targetGameYear, hostingDecisions]) => ({
    id: `federation-hosting:${targetGameYear}:${calendarDate}`,
    kind: "federation_hosting",
    kicker: "Calendrier international",
    kickerEn: "International calendar",
    title: `Les hôtes des épreuves internationales de la saison ${targetGameYear}`,
    titleEn: `International event hosts for Season ${targetGameYear}`,
    body: "",
    bodyEn: "",
    hostingDecisions,
  }));
}
