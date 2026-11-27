import "server-only";
import { z } from "zod";
import { ALBUM_PROFILES, type CollectorAlbumSnapshot } from "./collector-album";
import { assertCycloStickersFinalSnapshot } from "./cyclo-stickers-release";
import { jerseySchema, ratingsSchema } from "./cyclo-stickers-final-snapshot";

const text = z.string().trim().min(1).max(200);
const positive = z.number().int().positive();
const nonnegative = z.number().finite().nonnegative();
const profileKeys = ALBUM_PROFILES.map(profile => profile.id);
const card = z.strictObject({
  id: text, number: positive, rank: z.number().int().nonnegative(), name: text,
  kind: z.enum(["team", "continental", "world", "games", "legend"]).optional(),
  rarityOverride: z.enum(["silver", "gold", "holographic"]).optional(),
  stickerTitle: text.optional(), specimen: z.literal(false).optional(),
  country: z.string().max(200), countryCode: z.string().regex(/^(?:[A-Z]{2})?$/),
  age: z.number().int().min(0).max(120), avatarProfileKey: text.nullable(),
  avatarSeed: z.union([text, z.number().finite()]).nullable(), teamName: text,
  jersey: jerseySchema, profile: text,
  profileKey: z.enum(profileKeys as [typeof profileKeys[number], ...typeof profileKeys[number][]]),
  ratings: ratingsSchema, points: nonnegative, victories: z.number().int().nonnegative(),
  honours: z.array(z.strictObject({
    raceEditionId: z.uuid(), raceName: text, categoryCode: text,
    kind: z.enum(["race", "stages", "mountain", "sprint", "youth"]),
    count: positive, rank: positive.optional(),
  })).max(500),
  worldTitles: z.array(z.enum(["road", "time_trial"])).max(2),
});
const snapshotSchema = z.strictObject({
  edition: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,100}$/),
  collectionSeason: positive, sourceSeason: z.number().int().min(4),
  sourceSeasonId: z.uuid(), ratingsFrozenFromSeason: positive,
  capturedAt: z.iso.datetime({ offset: true }), sourceSeasonStatus: z.literal("completed"),
  presentationSeason: positive.optional(), launchSeason: positive.optional(), gamesEdition: z.boolean().optional(),
  cards: z.array(card).min(1).max(500),
  provenance: z.object({ schemaVersion: z.literal(1), source: z.object({
    season: z.object({ id: z.uuid(), gameYear: positive, status: z.literal("completed") }),
  }) }),
});

/** Read-side validation only. The selected catalogue still has to come from a
 * published, completed-season DB edition and match its immutable SHA-256 seal.
 * This function neither prepares nor authorizes a new edition for publication. */
export function assertPublishedCycloStickersSnapshot(input: unknown): asserts input is CollectorAlbumSnapshot {
  const snapshot = snapshotSchema.parse(input);
  const source = snapshot.provenance.source.season;
  if (snapshot.collectionSeason !== snapshot.sourceSeason + 1 || snapshot.ratingsFrozenFromSeason !== snapshot.sourceSeason
    || source.id !== snapshot.sourceSeasonId || source.gameYear !== snapshot.sourceSeason
    || (snapshot.presentationSeason !== undefined && snapshot.presentationSeason !== snapshot.sourceSeason)
    || (snapshot.launchSeason !== undefined && snapshot.launchSeason !== snapshot.collectionSeason)
    || new Set(snapshot.cards.map(item => item.id)).size !== snapshot.cards.length
    || snapshot.cards.some((item, index) => item.number !== index + 1)) {
    throw new Error("Le catalogue contient des identités ou des saisons incohérentes.");
  }
  // Retain the stronger, existing S4 reconstruction guard byte for byte.
  if (snapshot.sourceSeason === 4) assertCycloStickersFinalSnapshot(input, "completed");
}
