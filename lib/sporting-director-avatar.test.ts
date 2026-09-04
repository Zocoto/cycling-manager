import { describe, expect, it } from "vitest";

import {
  AVATAR_BACKGROUNDS,
  AVATAR_EAR_SHAPES,
  AVATAR_EYEBROW_STYLES,
  AVATAR_EYE_COLORS,
  AVATAR_EYE_SHAPES,
  AVATAR_FACE_SHAPES,
  AVATAR_FACIAL_HAIR_STYLES,
  getAvailableAvatarCheekStyles,
  getAvailableAvatarGlassesStyles,
  AMBULANCIER_AVATAR_OUTFIT_KEY,
  ASSIDU_AVATAR_GLASSES_KEY,
  HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY,
  NIGHT_AUCTION_AVATAR_CHEEK_KEY,
  PATRON_HAT_AVATAR_OUTFIT_KEY,
  SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_MOUTH_SHAPES,
  AVATAR_NOSE_SHAPES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_TONES,
  DEFAULT_SPORTING_DIRECTOR_AVATAR,
  EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
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
  it("round-trips the Assidu glasses in a custom avatar key", () => {
    const key = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      glasses: ASSIDU_AVATAR_GLASSES_KEY,
    });

    expect(decodeCustomSportingDirectorAvatar(key)?.glasses).toBe(
      ASSIDU_AVATAR_GLASSES_KEY,
    );
  });


  it("only exposes Premier de la classe after the Assidu trophy", () => {
    expect(
      getAvailableAvatarGlassesStyles({
        hasAssiduTrophy: false,
        hasHiddenSwitchbackTrophy: false,
      }).some(
        ({ key }) => key === ASSIDU_AVATAR_GLASSES_KEY,
      ),
    ).toBe(false);
    expect(
      getAvailableAvatarGlassesStyles({
        hasAssiduTrophy: true,
        hasHiddenSwitchbackTrophy: false,
      }).some(
        ({ key }) => key === ASSIDU_AVATAR_GLASSES_KEY,
      ),
    ).toBe(true);
  });

  it("only exposes the spy glasses after discovering the hidden switchback", () => {
    expect(
      getAvailableAvatarGlassesStyles({
        hasAssiduTrophy: false,
        hasHiddenSwitchbackTrophy: false,
      }).some(({ key }) => key === HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY),
    ).toBe(false);
    expect(
      getAvailableAvatarGlassesStyles({
        hasAssiduTrophy: false,
        hasHiddenSwitchbackTrophy: true,
      }).some(({ key }) => key === HIDDEN_SWITCHBACK_AVATAR_GLASSES_KEY),
    ).toBe(true);
  });

  it("only exposes Cernes after the night-auction trophy", () => {
    expect(
      getAvailableAvatarCheekStyles({
        hasNightAuctionTrophy: false,
      }).some(({ key }) => key === NIGHT_AUCTION_AVATAR_CHEEK_KEY),
    ).toBe(false);
    expect(
      getAvailableAvatarCheekStyles({
        hasNightAuctionTrophy: true,
      }).some(({ key }) => key === NIGHT_AUCTION_AVATAR_CHEEK_KEY),
    ).toBe(true);
  });

  it("round-trips the Cernes skin in a custom avatar key", () => {
    const key = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      cheekStyle: NIGHT_AUCTION_AVATAR_CHEEK_KEY,
    });

    expect(decodeCustomSportingDirectorAvatar(key)?.cheekStyle).toBe(
      NIGHT_AUCTION_AVATAR_CHEEK_KEY,
    );
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
      cheekStyle: "freckles",
      facialHair: AVATAR_FACIAL_HAIR_STYLES.at(-1)?.key,
      glasses: "cat-eye",
      outfit: AVATAR_OUTFITS.find(({ key }) => key === "violet")?.key,
      background: AVATAR_BACKGROUNDS.at(-1)?.key,
    });
    expect(isSportingDirectorAvatarKey(key)).toBe(true);
    expect(avatar.outfit).not.toBe("patron");
    expect(avatar.outfit).not.toBe(PATRON_HAT_AVATAR_OUTFIT_KEY);
    expect(avatar.outfit).not.toBe(SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY);
    expect(avatar.outfit).not.toBe(AMBULANCIER_AVATAR_OUTFIT_KEY);
    expect(avatar.outfit).not.toBe(EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY);
    expect(avatar.cheekStyle).not.toBe(NIGHT_AUCTION_AVATAR_CHEEK_KEY);
  });

  it("round-trips the sponsor ambassador outfit without adding it to random avatars", () => {
    const key = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit: SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
    });

    expect(decodeCustomSportingDirectorAvatar(key)?.outfit).toBe(
      SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY,
    );
  });

  it("round-trips the exclusive Don outfit and fedora", () => {
    const key = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit: PATRON_HAT_AVATAR_OUTFIT_KEY,
    });

    expect(decodeCustomSportingDirectorAvatar(key)?.outfit).toBe(
      PATRON_HAT_AVATAR_OUTFIT_KEY,
    );
  });

  it.each([
    AMBULANCIER_AVATAR_OUTFIT_KEY,
    EMERGENCY_DOCTOR_AVATAR_OUTFIT_KEY,
  ] as const)("round-trips the exclusive medical outfit %s", (outfit) => {
    const key = encodeSportingDirectorAvatar({
      ...DEFAULT_SPORTING_DIRECTOR_AVATAR,
      outfit,
    });

    expect(decodeCustomSportingDirectorAvatar(key)?.outfit).toBe(outfit);
  });
});
