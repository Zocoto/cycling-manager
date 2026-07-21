import { describe, expect, it } from "vitest";

import {
  AVATAR_BACKGROUNDS,
  AVATAR_CHEEK_STYLES,
  AVATAR_EAR_SHAPES,
  AVATAR_EYEBROW_STYLES,
  AVATAR_EYE_COLORS,
  AVATAR_EYE_SHAPES,
  AVATAR_FACE_SHAPES,
  AVATAR_FACIAL_HAIR_STYLES,
  AVATAR_GLASSES_STYLES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_MOUTH_SHAPES,
  AVATAR_NOSE_SHAPES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
  DEFAULT_SPORTING_DIRECTOR_AVATAR,
  createRandomSportingDirectorAvatar,
  decodeCustomSportingDirectorAvatar,
  encodeSportingDirectorAvatar,
  isSportingDirectorAvatarKey,
  resolveSportingDirectorAvatar,
} from "./sporting-director-avatar";

describe("sporting director avatar editor", () => {
  it("keeps legacy avatar keys valid", () => {
    expect(isSportingDirectorAvatarKey("director_m_01")).toBe(true);
    expect(isSportingDirectorAvatarKey("director_f_06")).toBe(true);
    expect(resolveSportingDirectorAvatar("director_m_01")).toEqual(
      DEFAULT_SPORTING_DIRECTOR_AVATAR
    );
  });

  it("round-trips every custom choice through the versioned key", () => {
    const key = encodeSportingDirectorAvatar({
      skinTone: "ebony",
      faceShape: "heart",
      hairStyle: "braids",
      hairColor: "copper",
      eyebrowStyle: "angled",
      eyeShape: "upturned",
      eyeColor: "green",
      noseShape: "aquiline",
      mouthShape: "full",
      earShape: "pronounced",
      cheekStyle: "freckles",
      facialHair: "goatee",
      glasses: "cat-eye",
      outfit: "violet",
      background: "coral",
    });

    expect(key).toBe(
      "director_custom_v1:ebony.heart.braids.copper.angled.upturned.green.aquiline.full.pronounced.freckles.goatee.cat-eye.violet.coral"
    );
    expect(isSportingDirectorAvatarKey(key)).toBe(true);
    expect(encodeSportingDirectorAvatar(
      decodeCustomSportingDirectorAvatar(key)!
    )).toBe(key);
  });

  it("rejects malformed or unknown custom options", () => {
    const validKey = encodeSportingDirectorAvatar(
      DEFAULT_SPORTING_DIRECTOR_AVATAR
    );

    expect(decodeCustomSportingDirectorAvatar("director_custom_v1:mint"))
      .toBeNull();
    expect(decodeCustomSportingDirectorAvatar(
      validKey.replace("golden", "unknown")
    )).toBeNull();
    expect(isSportingDirectorAvatarKey(`${validKey}.extra`)).toBe(false);
    expect(isSportingDirectorAvatarKey("https://example.com/avatar.png"))
      .toBe(false);
  });

  it("can generate a valid random avatar across all categories", () => {
    const avatar = createRandomSportingDirectorAvatar(() => 0.999999);
    const key = encodeSportingDirectorAvatar(avatar);

    expect(avatar).toEqual({
      skinTone: AVATAR_SKIN_TONES.at(-1)?.key,
      faceShape: AVATAR_FACE_SHAPES.at(-1)?.key,
      hairStyle: AVATAR_HAIR_STYLES.at(-1)?.key,
      hairColor: AVATAR_HAIR_COLORS.at(-1)?.key,
      eyebrowStyle: AVATAR_EYEBROW_STYLES.at(-1)?.key,
      eyeShape: AVATAR_EYE_SHAPES.at(-1)?.key,
      eyeColor: AVATAR_EYE_COLORS.at(-1)?.key,
      noseShape: AVATAR_NOSE_SHAPES.at(-1)?.key,
      mouthShape: AVATAR_MOUTH_SHAPES.at(-1)?.key,
      earShape: AVATAR_EAR_SHAPES.at(-1)?.key,
      cheekStyle: AVATAR_CHEEK_STYLES.at(-1)?.key,
      facialHair: AVATAR_FACIAL_HAIR_STYLES.at(-1)?.key,
      glasses: AVATAR_GLASSES_STYLES.at(-1)?.key,
      outfit: AVATAR_OUTFITS.at(-1)?.key,
      background: AVATAR_BACKGROUNDS.at(-1)?.key,
    });
    expect(isSportingDirectorAvatarKey(key)).toBe(true);
  });
});
