import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { RiderAvatar } from "@/components/game/rider-avatar";
import { prepareGlobalChatQuizPortrait } from "./global-chat-quiz-portrait";

const round = {
  id: "20112233-4455-4677-8899-aabbccddeeff",
  riderId: "30112233-4455-4677-8899-aabbccddeeff",
  avatarProfileKey: "europe_west",
  avatarSeed: "4890137762154501831",
  age: 24,
};

function storage({ uploadError = false, objectExists = false } = {}) {
  const upload = vi.fn<(path: string, image: Buffer, options: unknown) => Promise<{ error: Error | null }>>()
    .mockResolvedValue({ error: uploadError ? new Error("upload failed") : null });
  const exists = vi.fn().mockResolvedValue({ error: null, data: objectExists });
  const from = vi.fn().mockReturnValue({ upload, exists });
  const admin = { storage: { from } } as unknown as Pick<SupabaseClient, "storage">;
  return { admin, from, upload, exists };
}

describe("mystery rider portrait preparation", () => {
  it.each([
    { avatarProfileKey: "europe_west", avatarSeed: "4890137762154501831", age: 24 },
    { avatarProfileKey: "africa_west", avatarSeed: null, age: 36 },
  ])("uploads a compact opaque WebP matching the normal neutral portrait for $avatarProfileKey", async (features) => {
    const { admin, from, upload, exists } = storage();
    const input = { ...round, ...features };
    const path = await prepareGlobalChatQuizPortrait(admin, input);
    expect(path).toBe(`${round.id}.webp`);
    expect(from).toHaveBeenCalledExactlyOnceWith("global-chat-quiz-portraits");
    expect(exists).not.toHaveBeenCalled();
    const [uploadedPath, image, options] = upload.mock.calls[0];
    expect(uploadedPath).toBe(path);
    expect(options).toEqual({ contentType: "image/webp", cacheControl: "86400", upsert: false });
    expect(image.length).toBeLessThanOrEqual(30_000);
    const metadata = await sharp(image).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 256, height: 256, hasAlpha: false });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(image.includes(input.riderId)).toBe(false);
    if (input.avatarSeed) expect(image.includes(input.avatarSeed)).toBe(false);

    const original = renderToStaticMarkup(<RiderAvatar profileKey={input.avatarProfileKey} seed={input.avatarSeed}
      riderId={input.riderId} age={input.age} />);
    const nativeSvg = original.match(/<svg[\s\S]*<\/svg>/)?.[0]
      .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ');
    expect(nativeSvg).toBeTruthy();
    const reference = await sharp(Buffer.from(nativeSvg!)).removeAlpha().raw().toBuffer();
    const rendered = await sharp(image).raw().toBuffer();
    expect(rendered.length).toBe(reference.length);
    const meanColorDifference = rendered.reduce((sum, value, index) => sum + Math.abs(value - reference[index]), 0) / rendered.length;
    expect(meanColorDifference).toBeLessThan(2);
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
