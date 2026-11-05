import { z } from "zod";
import {
  createContinentalChampionRiderJersey,
  createQuadrennialChampionRiderJersey,
  createWorldChampionRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";
import { getRiderSportingProfile, RIDER_RATING_AXES, type RiderRatings } from "./rider-profile";
import type { AlbumProfile, CollectorAlbumSnapshot, CollectorCard } from "./collector-album";

const text = z.string().trim().min(1).max(200);
const uuid = z.uuid();
const instant = z.iso.datetime({ offset: true });
const date = z.iso.date();
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const nonnegative = z.number().finite().nonnegative();
const championshipType = z.enum(["road", "time_trial"]);
const continent = z.enum(["africa", "america", "asia", "europe", "oceania"]);
const ratingsSchema = z.strictObject(Object.fromEntries(
  RIDER_RATING_AXES.map(({ key }) => [key, z.number().finite().min(0).max(100)]),
) as Record<keyof RiderRatings, z.ZodNumber>);
const nationalDesignSchema = z.strictObject({
  schemaVersion: z.literal(2), baseColor: color,
  elements: z.array(z.strictObject({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
    kind: z.enum(["flag", "emblem", "band", "shape", "text"]),
    shape: z.enum(["rectangle", "roundel", "shield", "diamond", "hexagon", "triangle", "star", "chevron", "lightning", "line", "wave", "stripes", "dots", "checkerboard"]),
    color, secondaryColor: color, x: z.number().finite(), y: z.number().finite(),
    width: z.number().finite().positive(), height: z.number().finite().positive(),
    rotation: z.number().finite(), opacity: z.number().min(0).max(1),
    border: z.boolean().optional(), text: z.string().max(200).optional(),
  })).max(16),
});
const jerseySchema = z.strictObject({
  primaryColor: color, secondaryColor: color, accentColor: color,
  pattern: z.enum(["center", "diagonal", "hoops", "solid", "split", "vertical", "chevron", "quarters", "cross", "shoulders", "checkerboard", "wave", "pinstripes"]),
  status: z.enum(["amateur", "free-agent", "sponsored", "national-team", "national-champion", "continental-champion", "world-champion", "quadrennial-champion"]),
  imagePath: z.string().regex(/^\/images\/[^?#\\]+$/).refine(path => !path.split("/").includes(".."), "Unsafe jersey asset path").optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(), continentCode: continent.optional(),
  championshipType: championshipType.optional(), nationalDesign: nationalDesignSchema.optional(),
});
const honourSchema = z.strictObject({
  sourceSeasonId: uuid, raceEditionId: uuid, raceName: text, categoryCode: text,
  kind: z.enum(["race", "stages", "mountain", "sprint", "youth"]),
  count: z.number().int().positive(), rank: z.number().int().positive().optional(),
});
const riderSchema = z.strictObject({
  id: uuid, sourceSeasonId: uuid, ratingsSeasonId: uuid, contractSeasonId: uuid, jerseySeasonId: uuid,
  name: text, country: text, countryCode: z.string().regex(/^[A-Z]{2}$/),
  age: z.number().int().min(16).max(100),
  avatarProfileKey: text.nullable(), avatarSeed: z.union([text, z.number().finite()]).nullable(),
  teamId: uuid, teamName: text, jersey: jerseySchema, ratings: ratingsSchema,
  honours: z.array(honourSchema).max(500),
});
export const CYCLO_STICKERS_FINAL_TITLE_SLOTS = [
  "continental_africa_road", "continental_africa_time_trial",
  "continental_america_road", "continental_america_time_trial",
  "continental_asia_road", "continental_asia_time_trial",
  "continental_europe_road", "continental_europe_time_trial",
  "continental_oceania_road", "continental_oceania_time_trial",
  "world_road", "world_time_trial", "quadrennial_road",
] as const;

/** Bounded, reviewed official rows only. No browser state or current-season rider lookup. */
export const cycloStickersFinalSourceSchema = z.strictObject({
  schemaVersion: z.literal(1), capturedAt: instant,
  season: z.strictObject({ id: uuid, gameYear: z.literal(4), status: z.literal("completed"), startsOn: date, endsOn: date }),
  // Optional evidence for identities/jerseys captured before the rollover.
  // Active sporting results are never accepted as the final ranking or titles.
  identityCapture: z.strictObject({
    kind: z.literal("s4-active-identity-evidence"), sourceSeasonId: uuid,
    sourceSeasonStatus: z.literal("active"), capturedAt: instant, capturedUntil: instant,
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }).optional(),
  ranking: z.array(z.strictObject({
    sourceSeasonId: uuid, riderId: uuid, rank: z.number().int().min(1).max(50),
    points: nonnegative, victories: z.number().int().nonnegative(),
  })).length(50),
  teams: z.array(z.strictObject({
    sourceSeasonId: uuid, jerseySeasonId: uuid, teamId: uuid,
    rank: z.number().int().min(1).max(5), name: text, points: nonnegative, jersey: jerseySchema,
  })).length(5),
  riders: z.array(riderSchema).min(50).max(63),
  championships: z.array(z.strictObject({
    sourceSeasonId: uuid, type: z.enum(CYCLO_STICKERS_FINAL_TITLE_SLOTS),
    riderId: uuid, raceEditionId: uuid, raceStatus: z.literal("completed"), category: z.literal("pro"),
  })).length(13),
});

export type CycloStickersFinalSource = z.infer<typeof cycloStickersFinalSourceSchema>;
export type CycloStickersFinalSnapshot = CollectorAlbumSnapshot & {
  provenance: { schemaVersion: 1; source: CycloStickersFinalSource };
};

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Final S4 snapshot: ${message}`);
}
function unique(values: readonly string[], label: string) {
  requireCondition(new Set(values).size === values.length, `duplicate ${label}`);
}
function parisDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function parseSource(input: unknown): CycloStickersFinalSource {
  const source = cycloStickersFinalSourceSchema.parse(input);
  const { season } = source;
  requireCondition(Date.parse(season.endsOn) - Date.parse(season.startsOn) === 27 * 86_400_000, "season must contain 28 calendar days");
  requireCondition(parisDate(source.capturedAt) >= season.endsOn, "capture predates season end");
  const fromS4 = (id: string) => requireCondition(id === season.id, "mixed source seasons");
  if (source.identityCapture) {
    const evidence = source.identityCapture;
    fromS4(evidence.sourceSeasonId);
    requireCondition([evidence.capturedAt, evidence.capturedUntil].every(value => parisDate(value) >= season.startsOn && parisDate(value) <= season.endsOn), "identity evidence was not captured during S4");
    requireCondition(Date.parse(evidence.capturedAt) <= Date.parse(evidence.capturedUntil)
      && Date.parse(evidence.capturedUntil) <= Date.parse(source.capturedAt), "identity evidence capture order is invalid");
  }
  unique(source.riders.map(row => row.id), "rider identity");
  unique(source.ranking.map(row => row.riderId), "ranked rider");
  unique(source.teams.map(row => row.teamId), "team identity");
  unique(source.championships.map(row => row.type), "championship slot");
  unique(source.championships.map(row => row.raceEditionId), "championship race");
  for (const rows of [source.ranking, source.teams]) {
    // Preserve the official rank, including its tie break. Never sort equal points by name/UUID.
    rows.forEach((row, index) => {
      requireCondition(row.rank === index + 1, "official rankings must be provided in final rank order");
      requireCondition(index === 0 || row.points <= rows[index - 1].points, "points contradict official rank");
      fromS4(row.sourceSeasonId);
    });
  }
  source.teams.forEach(row => {
    fromS4(row.jerseySeasonId);
    requireCondition(row.jersey.status === "sponsored" || row.jersey.status === "amateur", "team sticker requires its S4 team jersey");
  });
  const expectedRiders = new Set([...source.ranking.map(row => row.riderId), ...source.championships.map(row => row.riderId)]);
  requireCondition(source.riders.length === expectedRiders.size && source.riders.every(row => expectedRiders.has(row.id)), "missing or unrelated rider profile");
  const knownRiders = new Set(source.riders.map(row => row.id));
  source.championships.forEach(row => { fromS4(row.sourceSeasonId); requireCondition(knownRiders.has(row.riderId), "missing champion profile"); });
  for (const rider of source.riders) {
    [rider.sourceSeasonId, rider.ratingsSeasonId, rider.contractSeasonId, rider.jerseySeasonId].forEach(fromS4);
    requireCondition(!/sp[eé]cimen|\bd[eé]mo\b/i.test(rider.name), "specimen rider identity");
    const team = source.teams.find(row => row.teamId === rider.teamId);
    if (team) {
      requireCondition(team.name === rider.teamName && canonical(team.jersey) === canonical(rider.jersey), "inconsistent frozen team identity/jersey");
    }
    unique(rider.honours.map(row => `${row.raceEditionId}:${row.kind}:${row.rank ?? ""}`), "honour");
    rider.honours.forEach(row => {
      fromS4(row.sourceSeasonId);
      requireCondition(row.kind === "race" ? row.count === 1 && row.rank !== undefined : row.rank === undefined, "invalid grouped honour");
    });
  }
  return source;
}

const profileKeys: Record<string, AlbumProfile> = {
  "Coureur de tour": "tours", Grimpeur: "mountain", Puncheur: "hills", Sprinteur: "sprint",
  "Coureur de pavés": "cobbles", Rouleur: "timeTrial", Baroudeur: "breakaway",
};
function riderFields(rider: CycloStickersFinalSource["riders"][number], source: CycloStickersFinalSource) {
  const profile = getRiderSportingProfile(rider.ratings);
  const profileKey = profileKeys[profile.split(" / ")[0]] ?? "breakaway";
  return {
    name: rider.name, country: rider.country, countryCode: rider.countryCode, age: rider.age,
    avatarProfileKey: rider.avatarProfileKey, avatarSeed: rider.avatarSeed,
    teamName: rider.teamName, jersey: rider.jersey, profile, profileKey, ratings: rider.ratings,
    honours: rider.honours.map(({ raceEditionId, raceName, categoryCode, kind, count, rank }) => ({ raceEditionId, raceName, categoryCode, kind, count, ...(rank === undefined ? {} : { rank }) })),
    worldTitles: source.championships.filter(row => row.riderId === rider.id && row.type.startsWith("world_")).map(row => row.type === "world_road" ? "road" as const : "time_trial" as const),
  };
}
function assemble(source: CycloStickersFinalSource): CycloStickersFinalSnapshot {
  const riders = new Map(source.riders.map(row => [row.id, row]));
  const cards: CollectorCard[] = source.ranking.map(row => ({
    ...riderFields(riders.get(row.riderId)!, source), id: row.riderId, number: row.rank,
    rank: row.rank, points: row.points, victories: row.victories,
  }));
  // Team and souvenir slots have no sporting rider, ratings or honours.
  const empty = {
    rank: 0, points: 0, victories: 0, country: "", countryCode: "", age: 0,
    avatarProfileKey: null, avatarSeed: null, honours: [], worldTitles: [],
    ratings: Object.fromEntries(RIDER_RATING_AXES.map(({ key }) => [key, 0])) as RiderRatings,
    profile: "Vignette d’introduction", profileKey: "breakaway" as const,
  };
  source.teams.forEach(row => cards.push({
    ...empty, id: `intro:team:${row.teamId}`, number: 50 + row.rank, kind: "team", rarityOverride: "silver",
    name: row.name, teamName: row.name, jersey: row.jersey, points: row.points,
    stickerTitle: `Top 5 UCI · ${row.rank}${row.rank === 1 ? "er" : "e"}`,
  }));
  CYCLO_STICKERS_FINAL_TITLE_SLOTS.forEach((slot, index) => {
    const title = source.championships.find(row => row.type === slot)!;
    const rider = riders.get(title.riderId)!;
    const type = slot.endsWith("_time_trial") ? "time_trial" : "road";
    const isContinental = slot.startsWith("continental_");
    const isWorld = slot.startsWith("world_");
    const continentCode = slot.split("_")[1] as ContinentalChampionshipCode;
    const labels = { africa: "Afrique", america: "Amérique", asia: "Asie", europe: "Europe", oceania: "Océanie" };
    const stickerTitle = `${isContinental ? `Champion continental · ${labels[continentCode]}` : isWorld ? "Champion du monde" : "Champion des Jeux"} · ${type === "road" ? "Route" : "CLM"}`;
    cards.push({
      ...riderFields(rider, source), rank: 0, points: 0, victories: 0,
      id: `intro:${slot}`, number: 56 + index,
      kind: isContinental ? "continental" : isWorld ? "world" : "games",
      rarityOverride: isContinental ? "silver" : isWorld ? "gold" : "holographic", stickerTitle,
      jersey: isContinental ? createContinentalChampionRiderJersey({ continentCode, championshipType: type })
        : isWorld ? createWorldChampionRiderJersey({ championshipType: type }) : createQuadrennialChampionRiderJersey({ championshipType: "road" }),
    });
  });
  cards.push({
    ...empty, id: "intro:legend:headless-s4", number: 69, kind: "legend", rarityOverride: "holographic",
    name: "L’Équipier sans tête", stickerTitle: "Les nuits du peloton", teamName: "Halloween · Saison 4", jersey: { ...FREE_AGENT_RIDER_JERSEY },
  });
  return {
    edition: "cyclo-stickers-s5-s4-final-v1", collectionSeason: 5, sourceSeason: 4,
    sourceSeasonId: source.season.id, ratingsFrozenFromSeason: 4, capturedAt: source.capturedAt,
    presentationSeason: 4, launchSeason: 5, gamesEdition: true, cards,
    provenance: { schemaVersion: 1, source: structuredClone(source) },
  };
}

/** Pure offline preparation. An active season is rejected; this never freezes a live ranking. */
export function createCycloStickersFinalSnapshot(input: unknown): CycloStickersFinalSnapshot {
  return assemble(parseSource(input));
}

export function serializeCycloStickersSnapshot(value: unknown): string {
  return canonical(value);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Rebuild every slot from its provenance instead of accepting relabelled pilot cards. */
export function assertReviewedCycloStickersFinalSnapshot(snapshot: unknown, sourceSeasonStatus: unknown): asserts snapshot is CycloStickersFinalSnapshot {
  requireCondition(sourceSeasonStatus === "completed", "source season is not completed");
  requireCondition(snapshot !== null && typeof snapshot === "object", "snapshot is not an object");
  const candidate = snapshot as Partial<CycloStickersFinalSnapshot>;
  requireCondition(candidate.provenance?.schemaVersion === 1, "reviewed official provenance is required");
  const rebuilt = createCycloStickersFinalSnapshot(candidate.provenance.source);
  requireCondition(canonical(snapshot) === canonical(rebuilt), "cards or metadata do not match the reviewed S4 source");
}
