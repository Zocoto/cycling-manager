export const RIDER_AVATAR_PROFILE_KEYS = [
  "anatolia",
  "caribbean",
  "caucasus",
  "central_africa",
  "central_asia",
  "east_africa",
  "east_asia",
  "europe_central",
  "europe_east",
  "europe_north",
  "europe_south",
  "europe_southeast",
  "europe_west",
  "latin_america",
  "middle_east",
  "north_africa",
  "north_america",
  "oceania",
  "south_asia",
  "southeast_asia",
  "southern_africa",
  "west_africa",
] as const;

export type RiderAvatarProfileKey =
  (typeof RIDER_AVATAR_PROFILE_KEYS)[number];

export type RiderAvatarProfileGroup =
  | "africa"
  | "east_asia"
  | "europe"
  | "latin_america"
  | "mixed"
  | "south_asia"
  | "southeast_asia"
  | "west_asia";

export type RiderHairStyle =
  | "buzz"
  | "coily"
  | "crop"
  | "curly"
  | "fringe"
  | "messy"
  | "quiff"
  | "shaved"
  | "short-locks"
  | "side-part"
  | "slicked"
  | "waves";

export type RiderEyeStyle =
  | "almond"
  | "deep"
  | "hooded"
  | "narrow"
  | "round"
  | "soft";

export type RiderNoseStyle =
  | "angular"
  | "broad"
  | "compact"
  | "rounded"
  | "straight"
  | "tapered";

export type RiderMouthStyle =
  | "balanced"
  | "defined"
  | "full"
  | "narrow"
  | "soft"
  | "wide";

export type RiderFacialHairStyle =
  | "clean"
  | "goatee"
  | "light-beard"
  | "moustache"
  | "short-beard"
  | "stubble";

export type RiderFaceMark =
  | "cheek-freckles"
  | "freckles"
  | "left-scar"
  | "none"
  | "right-scar"
  | "sun-kissed";

type AvatarProfile = {
  group: RiderAvatarProfileGroup;
  skinTones: readonly string[];
  hairColors: readonly string[];
  eyeColors: readonly string[];
  hairStyles: readonly RiderHairStyle[];
  eyeStyles: readonly RiderEyeStyle[];
  noseStyles: readonly RiderNoseStyle[];
  mouthStyles: readonly RiderMouthStyle[];
};

export type RiderAvatarDesign = {
  profileKey: RiderAvatarProfileKey;
  profileGroup: RiderAvatarProfileGroup;
  seed: string;
  skinTone: string;
  skinShadow: string;
  skinHighlight: string;
  hairColor: string;
  hairHighlight: string;
  eyeColor: string;
  backgroundColor: string;
  hairStyle: RiderHairStyle;
  eyeStyle: RiderEyeStyle;
  noseStyle: RiderNoseStyle;
  mouthStyle: RiderMouthStyle;
  facialHairStyle: RiderFacialHairStyle;
  faceMark: RiderFaceMark;
  faceWidth: number;
  faceHeight: number;
  jawWidth: number;
  foreheadWidth: number;
  cheekboneWidth: number;
  chinWidth: number;
  eyeSpacing: number;
  eyeWidth: number;
  eyeTilt: number;
  eyeY: number;
  eyeAsymmetry: number;
  browY: number;
  noseWidth: number;
  noseLength: number;
  mouthWidth: number;
  mouthCurve: number;
  earHeight: number;
  earWidth: number;
  neckWidth: number;
  ageLineOpacity: number;
  geometrySignature: string;
};

const EUROPE_SKIN = [
  "#F5D5C0",
  "#EFC8AF",
  "#E8B99D",
  "#DDAA89",
  "#D39A75",
  "#C68A67",
  "#B97857",
  "#A9684A",
] as const;

const EUROPE_NORTH_SKIN = [
  "#F8DDCC",
  "#F4D2BD",
  "#EFC5AA",
  "#E6B796",
  "#DDA985",
  "#D19A75",
  "#C58B67",
  "#B77A58",
] as const;

const EUROPE_SOUTH_SKIN = [
  "#F1CFB6",
  "#E8BFA1",
  "#DEAE8B",
  "#D29C76",
  "#C38A63",
  "#B87A56",
  "#A96B49",
  "#995D3F",
] as const;

const EAST_ASIA_SKIN = [
  "#F1D0B5",
  "#E8C19F",
  "#DDB18B",
  "#D1A079",
  "#C49068",
  "#B78059",
  "#A8704D",
  "#956043",
] as const;

const SOUTH_ASIA_SKIN = [
  "#D7AA82",
  "#C9966E",
  "#BA835C",
  "#AA714B",
  "#99613F",
  "#875137",
  "#74432F",
  "#63372A",
] as const;

const WEST_ASIA_SKIN = [
  "#E9C3A3",
  "#DDB08C",
  "#CF9D77",
  "#BE8964",
  "#AD7652",
  "#9B6545",
  "#89563B",
  "#76472F",
] as const;

const AFRICA_SKIN = [
  "#A86E4B",
  "#965E40",
  "#844F37",
  "#73432F",
  "#62382A",
  "#512E24",
  "#42251E",
  "#351E19",
] as const;

const LATIN_AMERICA_SKIN = [
  "#E7BC9B",
  "#D8A985",
  "#C89570",
  "#B7815E",
  "#A66E4E",
  "#945D42",
  "#824E38",
  "#70412F",
] as const;

const MIXED_SKIN = [
  "#F3D1B8",
  "#DEAE8C",
  "#C88F69",
  "#AF7453",
  "#955E43",
  "#794933",
  "#5F382A",
  "#42261F",
] as const;

const DARK_HAIR = [
  "#181512",
  "#211A16",
  "#2C211A",
  "#35271F",
  "#402E23",
  "#1A1715",
  "#241D19",
  "#30241D",
] as const;

const VARIED_HAIR = [
  "#161311",
  "#241A15",
  "#35241B",
  "#513521",
  "#6A472B",
  "#8A6036",
  "#B08A58",
  "#4A2C21",
] as const;

const LIGHT_EYES = [
  "#5E766E",
  "#6E8064",
  "#6C768B",
  "#7E684F",
  "#5B4939",
  "#3F332B",
  "#586B72",
  "#78674C",
] as const;

const DARK_EYES = [
  "#211915",
  "#2B211A",
  "#36291F",
  "#433327",
  "#503D2C",
  "#604A35",
  "#30251E",
  "#493728",
] as const;

const MIXED_EYES = [
  "#241B17",
  "#38291F",
  "#4C3929",
  "#67513A",
  "#66705F",
  "#61727A",
  "#78664A",
  "#2D231D",
] as const;

const BALANCED_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "quiff",
  "buzz",
  "messy",
  "waves",
  "curly",
  "slicked",
  "crop",
  "side-part",
  "quiff",
  "buzz",
  "fringe",
  "messy",
  "waves",
  "shaved",
] as const;

const AFRICAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "coily",
  "buzz",
  "short-locks",
  "waves",
  "shaved",
  "crop",
  "coily",
  "buzz",
  "short-locks",
  "curly",
  "waves",
  "shaved",
  "coily",
  "crop",
  "buzz",
  "curly",
] as const;

const ASIAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "fringe",
  "buzz",
  "messy",
  "slicked",
  "crop",
  "side-part",
  "fringe",
  "quiff",
  "buzz",
  "shaved",
  "messy",
  "waves",
  "crop",
  "side-part",
] as const;

const BALANCED_EYES: readonly RiderEyeStyle[] = [
  "soft",
  "almond",
  "deep",
  "round",
  "hooded",
  "narrow",
  "soft",
  "deep",
  "almond",
  "round",
  "hooded",
  "soft",
  "deep",
  "almond",
  "round",
  "narrow",
] as const;

const EAST_ASIAN_EYES: readonly RiderEyeStyle[] = [
  "almond",
  "hooded",
  "narrow",
  "soft",
  "almond",
  "hooded",
  "deep",
  "narrow",
  "almond",
  "soft",
  "hooded",
  "round",
  "narrow",
  "almond",
  "soft",
  "deep",
] as const;

const BALANCED_NOSES: readonly RiderNoseStyle[] = [
  "straight",
  "rounded",
  "tapered",
  "compact",
  "angular",
  "broad",
  "straight",
  "rounded",
  "compact",
  "tapered",
  "broad",
  "angular",
  "straight",
  "rounded",
  "compact",
  "tapered",
] as const;

const BROADER_NOSES: readonly RiderNoseStyle[] = [
  "broad",
  "rounded",
  "compact",
  "straight",
  "broad",
  "rounded",
  "angular",
  "compact",
  "straight",
  "broad",
  "tapered",
  "rounded",
  "compact",
  "broad",
  "straight",
  "angular",
] as const;

const BALANCED_MOUTHS: readonly RiderMouthStyle[] = [
  "balanced",
  "defined",
  "soft",
  "wide",
  "full",
  "narrow",
  "balanced",
  "soft",
  "defined",
  "full",
  "wide",
  "balanced",
  "narrow",
  "soft",
  "defined",
  "full",
] as const;

function createProfile({
  group,
  skinTones,
  hairColors = DARK_HAIR,
  eyeColors = DARK_EYES,
  hairStyles = BALANCED_HAIR_STYLES,
  eyeStyles = BALANCED_EYES,
  noseStyles = BALANCED_NOSES,
}: {
  group: RiderAvatarProfileGroup;
  skinTones: readonly string[];
  hairColors?: readonly string[];
  eyeColors?: readonly string[];
  hairStyles?: readonly RiderHairStyle[];
  eyeStyles?: readonly RiderEyeStyle[];
  noseStyles?: readonly RiderNoseStyle[];
}): AvatarProfile {
  return {
    group,
    skinTones,
    hairColors,
    eyeColors,
    hairStyles,
    eyeStyles,
    noseStyles,
    mouthStyles: BALANCED_MOUTHS,
  };
}

const AVATAR_PROFILES: Record<
  RiderAvatarProfileKey,
  AvatarProfile
> = {
  anatolia: createProfile({
    group: "west_asia",
    skinTones: WEST_ASIA_SKIN,
  }),
  caribbean: createProfile({
    group: "latin_america",
    skinTones: MIXED_SKIN,
    hairStyles: AFRICAN_HAIR_STYLES,
    noseStyles: BROADER_NOSES,
  }),
  caucasus: createProfile({
    group: "west_asia",
    skinTones: EUROPE_SOUTH_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  central_africa: createProfile({
    group: "africa",
    skinTones: AFRICA_SKIN,
    hairStyles: AFRICAN_HAIR_STYLES,
    noseStyles: BROADER_NOSES,
  }),
  central_asia: createProfile({
    group: "west_asia",
    skinTones: WEST_ASIA_SKIN,
    eyeStyles: EAST_ASIAN_EYES,
  }),
  east_africa: createProfile({
    group: "africa",
    skinTones: AFRICA_SKIN,
    hairStyles: AFRICAN_HAIR_STYLES,
    noseStyles: BROADER_NOSES,
  }),
  east_asia: createProfile({
    group: "east_asia",
    skinTones: EAST_ASIA_SKIN,
    hairStyles: ASIAN_HAIR_STYLES,
    eyeStyles: EAST_ASIAN_EYES,
  }),
  europe_central: createProfile({
    group: "europe",
    skinTones: EUROPE_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: LIGHT_EYES,
  }),
  europe_east: createProfile({
    group: "europe",
    skinTones: EUROPE_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  europe_north: createProfile({
    group: "europe",
    skinTones: EUROPE_NORTH_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: LIGHT_EYES,
  }),
  europe_south: createProfile({
    group: "europe",
    skinTones: EUROPE_SOUTH_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  europe_southeast: createProfile({
    group: "europe",
    skinTones: EUROPE_SOUTH_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  europe_west: createProfile({
    group: "europe",
    skinTones: EUROPE_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: LIGHT_EYES,
  }),
  latin_america: createProfile({
    group: "latin_america",
    skinTones: LATIN_AMERICA_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  middle_east: createProfile({
    group: "west_asia",
    skinTones: WEST_ASIA_SKIN,
  }),
  north_africa: createProfile({
    group: "west_asia",
    skinTones: WEST_ASIA_SKIN,
  }),
  north_america: createProfile({
    group: "mixed",
    skinTones: MIXED_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  oceania: createProfile({
    group: "mixed",
    skinTones: MIXED_SKIN,
    hairColors: VARIED_HAIR,
    eyeColors: MIXED_EYES,
  }),
  south_asia: createProfile({
    group: "south_asia",
    skinTones: SOUTH_ASIA_SKIN,
  }),
  southeast_asia: createProfile({
    group: "southeast_asia",
    skinTones: EAST_ASIA_SKIN,
    hairStyles: ASIAN_HAIR_STYLES,
    eyeStyles: EAST_ASIAN_EYES,
  }),
  southern_africa: createProfile({
    group: "africa",
    skinTones: AFRICA_SKIN,
    hairStyles: AFRICAN_HAIR_STYLES,
    noseStyles: BROADER_NOSES,
  }),
  west_africa: createProfile({
    group: "africa",
    skinTones: AFRICA_SKIN,
    hairStyles: AFRICAN_HAIR_STYLES,
    noseStyles: BROADER_NOSES,
  }),
};

const BACKGROUNDS = [
  "#E8EFEA",
  "#EDEBE3",
  "#DFE9E5",
  "#E9E5DD",
  "#DDE8E1",
  "#E7ECE6",
  "#E5E8DE",
  "#E1EBE8",
] as const;

const FACIAL_HAIR_STYLES: readonly RiderFacialHairStyle[] = [
  "clean",
  "stubble",
  "clean",
  "light-beard",
  "clean",
  "moustache",
  "stubble",
  "short-beard",
  "clean",
  "goatee",
  "stubble",
  "clean",
  "light-beard",
  "clean",
  "short-beard",
  "stubble",
] as const;

const FACE_MARKS: readonly RiderFaceMark[] = [
  "none",
  "freckles",
  "none",
  "sun-kissed",
  "none",
  "cheek-freckles",
  "none",
  "left-scar",
  "none",
  "sun-kissed",
  "none",
  "right-scar",
  "none",
  "freckles",
  "none",
  "cheek-freckles",
] as const;

const BIGINT_ZERO = BigInt(0);
const MASK_64 =
  (BigInt(1) << BigInt(64)) - BigInt(1);
const SCRAMBLE_MULTIPLIER = BigInt(
  "6364136223846793005"
);
const SCRAMBLE_INCREMENT = BigInt(
  "1442695040888963407"
);

export function isRiderAvatarProfileKey(
  value: string
): value is RiderAvatarProfileKey {
  return (
    RIDER_AVATAR_PROFILE_KEYS as readonly string[]
  ).includes(value);
}

export function createRiderAvatarDesign({
  profileKey,
  seed,
  fallbackKey = "rider",
  age = 25,
}: {
  profileKey: string | null | undefined;
  seed: bigint | number | string | null | undefined;
  fallbackKey?: string;
  age?: number;
}): RiderAvatarDesign {
  const normalizedProfileKey =
    normalizeProfileKey(profileKey);
  const profile = AVATAR_PROFILES[normalizedProfileKey];
  const normalizedSeed = normalizeSeed(seed, fallbackKey);
  const primary = new MixedRadixCursor(
    scrambleSeed(normalizedSeed)
  );
  const details = new MixedRadixCursor(
    mixSeed(
      normalizedSeed ^ BigInt("0x9e3779b97f4a7c15")
    )
  );

  const faceWidthStep = primary.take(17);
  const faceHeightStep = primary.take(17);
  const jawWidthStep = primary.take(13);
  const foreheadWidthStep = primary.take(11);
  const eyeSpacingStep = primary.take(13);
  const eyeWidthStep = primary.take(11);
  const eyeTiltStep = primary.take(9);
  const noseWidthStep = primary.take(11);
  const noseLengthStep = primary.take(11);
  const mouthWidthStep = primary.take(11);
  const mouthCurveStep = primary.take(9);
  const earHeightStep = primary.take(11);
  const earWidthStep = primary.take(9);
  const neckWidthStep = primary.take(11);
  const cheekboneWidthStep = primary.take(11);
  const chinWidthStep = primary.take(11);
  const browHeightStep = primary.take(9);
  const eyeYStep = primary.take(7);
  const asymmetryStep = primary.take(7);

  const geometrySignature = [
    faceWidthStep,
    faceHeightStep,
    jawWidthStep,
    foreheadWidthStep,
    eyeSpacingStep,
    eyeWidthStep,
    eyeTiltStep,
    noseWidthStep,
    noseLengthStep,
    mouthWidthStep,
    mouthCurveStep,
    earHeightStep,
    earWidthStep,
    neckWidthStep,
    cheekboneWidthStep,
    chinWidthStep,
    browHeightStep,
    eyeYStep,
    asymmetryStep,
  ].join("-");

  const skinTone = pick(profile.skinTones, details.take(8));
  const hairColor = pick(profile.hairColors, details.take(8));
  const eyeColor = pick(profile.eyeColors, details.take(8));

  return {
    profileKey: normalizedProfileKey,
    profileGroup: profile.group,
    seed: normalizedSeed.toString(),
    skinTone,
    skinShadow: shiftHexColor(skinTone, -25),
    skinHighlight: shiftHexColor(skinTone, 18),
    hairColor,
    hairHighlight: shiftHexColor(hairColor, 24),
    eyeColor,
    backgroundColor: pick(BACKGROUNDS, details.take(8)),
    hairStyle: pick(profile.hairStyles, details.take(16)),
    eyeStyle: pick(profile.eyeStyles, details.take(16)),
    noseStyle: pick(profile.noseStyles, details.take(16)),
    mouthStyle: pick(profile.mouthStyles, details.take(16)),
    facialHairStyle: pick(
      FACIAL_HAIR_STYLES,
      details.take(16)
    ),
    faceMark: pick(FACE_MARKS, details.take(16)),
    faceWidth: 31 + faceWidthStep * 0.38,
    faceHeight: 42 + faceHeightStep * 0.32,
    jawWidth: 18 + jawWidthStep * 0.42,
    foreheadWidth: 25 + foreheadWidthStep * 0.46,
    cheekboneWidth: 25 + cheekboneWidthStep * 0.44,
    chinWidth: 8.5 + chinWidthStep * 0.38,
    eyeSpacing: 14.5 + eyeSpacingStep * 0.42,
    eyeWidth: 6.2 + eyeWidthStep * 0.19,
    eyeTilt: -1 + eyeTiltStep * 0.25,
    eyeY: 39.5 + eyeYStep * 0.36,
    eyeAsymmetry: (asymmetryStep - 3) * 0.12,
    browY: 34.2 + browHeightStep * 0.28,
    noseWidth: 4.2 + noseWidthStep * 0.27,
    noseLength: 8.4 + noseLengthStep * 0.31,
    mouthWidth: 10.5 + mouthWidthStep * 0.33,
    mouthCurve: -1 + mouthCurveStep * 0.25,
    earHeight: 10 + earHeightStep * 0.32,
    earWidth: 3.8 + earWidthStep * 0.18,
    neckWidth: 14 + neckWidthStep * 0.4,
    ageLineOpacity: clamp((age - 27) / 32, 0, 0.34),
    geometrySignature,
  };
}

function normalizeProfileKey(
  profileKey: string | null | undefined
): RiderAvatarProfileKey {
  const normalized = profileKey?.trim().toLowerCase() ?? "";

  return isRiderAvatarProfileKey(normalized)
    ? normalized
    : "north_america";
}

function normalizeSeed(
  seed: bigint | number | string | null | undefined,
  fallbackKey: string
): bigint {
  if (typeof seed === "bigint") {
    return absolute64(seed);
  }

  if (typeof seed === "number" && Number.isFinite(seed)) {
    return absolute64(BigInt(Math.trunc(seed)));
  }

  if (typeof seed === "string" && /^\d+$/.test(seed.trim())) {
    return absolute64(BigInt(seed.trim()));
  }

  return hashText64(fallbackKey.trim() || "rider");
}

function absolute64(value: bigint): bigint {
  const positive = value < BIGINT_ZERO ? -value : value;
  return positive & MASK_64;
}

function scrambleSeed(seed: bigint): bigint {
  return (
    seed * SCRAMBLE_MULTIPLIER + SCRAMBLE_INCREMENT
  ) & MASK_64;
}

function mixSeed(seed: bigint): bigint {
  let value = seed & MASK_64;
  value =
    ((value ^ (value >> BigInt(30))) *
      BigInt("0xbf58476d1ce4e5b9")) &
    MASK_64;
  value =
    ((value ^ (value >> BigInt(27))) *
      BigInt("0x94d049bb133111eb")) &
    MASK_64;
  return (value ^ (value >> BigInt(31))) & MASK_64;
}

function hashText64(value: string): bigint {
  let hash = BigInt("0xcbf29ce484222325");

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash =
      (hash * BigInt("0x100000001b3")) & MASK_64;
  }

  return hash;
}

class MixedRadixCursor {
  private value: bigint;

  constructor(value: bigint) {
    this.value = value;
  }

  take(radix: number): number {
    const bigintRadix = BigInt(radix);
    const digit = Number(this.value % bigintRadix);
    this.value /= bigintRadix;
    return digit;
  }
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function shiftHexColor(hexColor: string, amount: number): string {
  const normalized = hexColor.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    clamp(
      Number.parseInt(normalized.slice(offset, offset + 2), 16) + amount,
      0,
      255
    )
  );

  return `#${channels
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
