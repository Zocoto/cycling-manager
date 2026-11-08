import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RiderAvatar } from "@/components/game/rider-avatar";
import { SPONSORS } from "@/data/sponsors";
import { getAbsoluteUrl } from "@/lib/app-config";
import { createAmateurRiderJersey, createSponsoredRiderJersey, type RiderJerseyAppearance } from "@/lib/rider-jersey";
import { prepareGlobalChatQuizPortrait } from "./global-chat-quiz-portrait";

const round = {
  id: "20112233-4455-4677-8899-aabbccddeeff",
  riderId: "30112233-4455-4677-8899-aabbccddeeff",
  avatarProfileKey: "europe_west",
  avatarSeed: "4890137762154501831",
  age: 24,
};

const teamId = "40112233-4455-4677-8899-aabbccddeeff";
const amateurJersey = {
  pattern: "diagonal",
  primaryColor: "#163C55",
  secondaryColor: "#E88139",
  accentColor: "#E4D7BB",
} as const;
const selectedJerseyId = "exuma-blue-resorts-modern";

function storage({ uploadError = false, objectExists = false, sponsored = false } = {}) {
  const upload = vi.fn<(path: string, image: Buffer, options: unknown) => Promise<{ error: Error | null }>>()
    .mockResolvedValue({ error: uploadError ? new Error("upload failed") : null });
  const exists = vi.fn().mockResolvedValue({ error: null, data: objectExists });
  const from = vi.fn().mockReturnValue({ upload, exists });
  const databaseFrom = vi.fn((table: string) => {
    let data: unknown;
    if (table === "rider_contracts") {
      data = {
        team_id: teamId,
        team: {
          amateur_jersey_pattern: amateurJersey.pattern,
          amateur_jersey_primary_color: amateurJersey.primaryColor,
          amateur_jersey_secondary_color: amateurJersey.secondaryColor,
          amateur_jersey_accent_color: amateurJersey.accentColor,
        },
      };
    } else if (table === "team_sponsor_contracts") {
      data = sponsored ? {
        selected_jersey_id: selectedJerseyId,
        sponsor: { catalog_key: "exuma-blue-resorts" },
      } : null;
    } else {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ error: null, data }),
    };
  });
  const admin = { storage: { from }, from: databaseFrom } as unknown as Pick<SupabaseClient, "storage" | "from">;
  return { admin, from, upload, exists, databaseFrom };
}

async function referencePixels(input: Omit<typeof round, "avatarSeed"> & { avatarSeed: string | null }, jersey: RiderJerseyAppearance) {
  const markup = renderToStaticMarkup(<RiderAvatar profileKey={input.avatarProfileKey} seed={input.avatarSeed}
    riderId={input.riderId} age={input.age} jersey={jersey} />);
  const svg = markup.match(/<svg[\s\S]*<\/svg>/)?.[0]
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ');
  expect(svg).toBeTruthy();
  return sharp(Buffer.from(svg!)).removeAlpha().raw().toBuffer();
}

function meanColorDifference(rendered: Buffer, reference: Buffer) {
  expect(rendered.length).toBe(reference.length);
  return rendered.reduce((sum, value, index) => sum + Math.abs(value - reference[index]), 0) / rendered.length;
}

async function expectCompactPrivatePortrait(image: Buffer) {
  expect(image.length).toBeLessThanOrEqual(30_000);
  const metadata = await sharp(image).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 256, height: 256, hasAlpha: false });
  expect(metadata.exif).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
  expect(image.includes(round.riderId)).toBe(false);
  expect(image.includes(round.avatarSeed)).toBe(false);
  expect(image.includes(teamId)).toBe(false);
}

function stubSponsorArtwork(path: string, response: Response) {
  const artworkUrl = getAbsoluteUrl(path);
  const fetchArtwork = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal("fetch", ((input, options) => String(input) === artworkUrl
    ? fetchArtwork(input, options)
    : nativeFetch(input, options)) satisfies typeof globalThis.fetch);
  return fetchArtwork;
}

afterEach(() => vi.unstubAllGlobals());

describe("mystery rider portrait preparation", () => {
  it.each([
    { avatarProfileKey: "europe_west", avatarSeed: "4890137762154501831", age: 24 },
    { avatarProfileKey: "africa_west", avatarSeed: null, age: 36 },
  ])("uploads the normal avatar framing with the amateur team jersey for $avatarProfileKey", async (features) => {
    const { admin, from, upload, exists, databaseFrom } = storage();
    const input = { ...round, ...features };
    const path = await prepareGlobalChatQuizPortrait(admin, input);
    expect(path).toBe(`${round.id}.webp`);
    expect(from).toHaveBeenCalledExactlyOnceWith("global-chat-quiz-portraits");
    expect(exists).not.toHaveBeenCalled();
    const [uploadedPath, image, options] = upload.mock.calls[0];
    expect(uploadedPath).toBe(path);
    expect(options).toEqual({ contentType: "image/webp", cacheControl: "86400", upsert: false });
    expect(databaseFrom.mock.calls).toEqual([["rider_contracts"], ["team_sponsor_contracts"]]);
    await expectCompactPrivatePortrait(image);
    const reference = await referencePixels(input, createAmateurRiderJersey(amateurJersey));
    const rendered = await sharp(image).raw().toBuffer();
    expect(meanColorDifference(rendered, reference)).toBeLessThan(2);
  });

  it("uses the selected sponsor artwork inside the normal avatar chest, without exposing identity metadata", async () => {
    const sponsor = SPONSORS.find(({ id }) => id === "exuma-blue-resorts")!;
    const selected = sponsor.jerseys.find(({ id }) => id === selectedJerseyId)!;
    const artwork = await readFile(`public${selected.imagePath}`);
    const fetchArtwork = stubSponsorArtwork(selected.imagePath,
      new Response(new Uint8Array(artwork), { headers: { "Content-Type": "image/webp" } }),
    );
    const { admin, upload } = storage({ sponsored: true });
    await expect(prepareGlobalChatQuizPortrait(admin, round)).resolves.toBe(`${round.id}.webp`);
    expect(fetchArtwork).toHaveBeenCalledTimes(1);
    const [, image] = upload.mock.calls[0];
    await expectCompactPrivatePortrait(image);
    expect(image.includes(selectedJerseyId)).toBe(false);
    expect(image.includes(selected.imagePath)).toBe(false);

    const baseJersey = { colors: sponsor.colors, style: selected.style };
    const encodedArtwork = (await sharp(artwork).png().toBuffer()).toString("base64");
    const reference = await referencePixels(round, createSponsoredRiderJersey({
      ...baseJersey, imagePath: `data:image/png;base64,${encodedArtwork}`,
    }));
    const withoutArtwork = await referencePixels(round, createSponsoredRiderJersey(baseJersey));
    const rendered = await sharp(image).raw().toBuffer();
    const distance = meanColorDifference(rendered, reference);
    expect(distance).toBeLessThan(2);
    expect(distance).toBeLessThan(meanColorDifference(rendered, withoutArtwork));
  });

  it("keeps the sponsor colours and pattern if the artwork is unavailable", async () => {
    const sponsor = SPONSORS.find(({ id }) => id === "exuma-blue-resorts")!;
    const selected = sponsor.jerseys.find(({ id }) => id === selectedJerseyId)!;
    stubSponsorArtwork(selected.imagePath, new Response(null, { status: 404 }));
    const { admin, upload } = storage({ sponsored: true });
    await prepareGlobalChatQuizPortrait(admin, round);
    const [, image] = upload.mock.calls[0];
    const reference = await referencePixels(round, createSponsoredRiderJersey({
      colors: sponsor.colors, style: selected.style,
    }));
    expect(meanColorDifference(await sharp(image).raw().toBuffer(), reference)).toBeLessThan(2);
  });

  it("reuses the immutable object when a previous preparation already uploaded it", async () => {
    const { admin, upload, exists } = storage({ uploadError: true, objectExists: true });
    await expect(prepareGlobalChatQuizPortrait(admin, round)).resolves.toBe(`${round.id}.webp`);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(exists).toHaveBeenCalledExactlyOnceWith(`${round.id}.webp`);
  });

  it("fails when the upload is missing and refuses to expose a rider ID as a path", async () => {
    const { admin, from } = storage({ uploadError: true });
    await expect(prepareGlobalChatQuizPortrait(admin, { ...round, id: round.riderId })).rejects.toThrow("identifier");
    await expect(prepareGlobalChatQuizPortrait(admin, { ...round, avatarSeed: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow("seed");
    expect(from).not.toHaveBeenCalled();
    await expect(prepareGlobalChatQuizPortrait(admin, round)).rejects.toThrow("upload failed");
  });
});
