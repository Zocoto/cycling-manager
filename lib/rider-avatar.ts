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

export type RiderAvatarAgingStage = "adult" | "grey" | "white" | "lich";

export type RiderHairStyle =
  | "afro"
  | "bald"
  | "balding"
  | "big-afro"
  | "braids"
  | "buzz"
  | "coily"
  | "crew-cut"
  | "crop"
  | "curly"
  | "dreadlocks"
  | "football-curl"
  | "fringe"
  | "high-top"
  | "long-waves"
  | "long-dreadlocks"
  | "man-bun"
  | "messy"
  | "mohawk"
  | "ponytail"
  | "quiff"
  | "receding"
  | "shaved"
  | "shoulder-curls"
  | "shoulder-length"
  | "short-locks"
  | "side-part"
  | "slicked"
  | "undercut"
  | "widows-peak"
  | "waves";

export type RiderEyeStyle =
  | "almond"
  | "crescent"
  | "deep"
  | "droopy"
  | "downturned"
  | "heavy-lidded"
  | "hooded"
  | "large"
  | "laughing"
  | "monolid"
  | "narrow"
  | "piercing"
  | "prominent"
  | "round"
  | "sharp"
  | "sleepy"
  | "small"
  | "soft"
  | "squinting"
  | "upturned"
  | "wide-open";

export type RiderNoseStyle =
  | "angular"
  | "aquiline"
  | "bulbous"
  | "broad"
  | "button"
  | "compact"
  | "crooked"
  | "drooping"
  | "eagle"
  | "fine"
  | "flared"
  | "flat"
  | "hooked"
  | "long"
  | "massive"
  | "minimal"
  | "petite"
  | "potato"
  | "roman"
  | "rounded"
  | "snub"
  | "straight"
  | "tapered"
  | "upturned"
  | "wide-bridge";

export type RiderMouthStyle =
  | "balanced"
  | "big-grin"
  | "bowed"
  | "clenched"
  | "crooked-smile"
  | "defined"
  | "downturned"
  | "flat"
  | "full"
  | "gritted"
  | "grimace"
  | "narrow"
  | "open"
  | "open-smile"
  | "plush"
  | "pursed"
  | "rictus"
  | "smile"
  | "smirk"
  | "soft"
  | "thin-lips"
  | "underbite"
  | "wide";

export type RiderEarStyle =
  | "angular"
  | "attached"
  | "cupped"
  | "flat"
  | "high-set"
  | "large-lobed"
  | "lobed"
  | "low-set"
  | "long"
  | "pointed"
  | "prominent"
  | "rounded"
  | "small"
  | "tapered"
  | "uneven"
  | "wide";

export type RiderFaceShape =
  | "angular"
  | "broad"
  | "diamond"
  | "gaunt"
  | "heart"
  | "inverted-triangle"
  | "long"
  | "oval"
  | "pear"
  | "rectangular"
  | "round"
  | "soft-round"
  | "square"
  | "strong-jaw"
  | "tapered"
  | "wide-cheek";

export type RiderFacialHairStyle =
  | "chinstrap"
  | "clean"
  | "five-o-clock"
  | "full-beard"
  | "goatee"
  | "handlebar"
  | "light-beard"
  | "long-beard"
  | "moustache"
  | "sideburns"
  | "short-beard"
  | "stubble"
  | "thick-moustache";

export type RiderGazeStyle =
  | "centered"
  | "crossed"
  | "left"
  | "right"
  | "wall-eyed";

export type RiderBrowStyle =
  | "arched"
  | "bushy"
  | "classic"
  | "furrowed"
  | "heavy"
  | "low-angled"
  | "rounded"
  | "soft"
  | "straight"
  | "thin";

export type RiderFaceMark =
  | "beauty-mark"
  | "birthmark"
  | "cheek-freckles"
  | "cleft-chin"
  | "dimples"
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
  expandedHairStyles: readonly RiderHairStyle[];
  expandedEyeStyles: readonly RiderEyeStyle[];
  expandedNoseStyles: readonly RiderNoseStyle[];
  thirdGenerationSkinTones: readonly string[];
  thirdGenerationEyeColors: readonly string[];
  thirdGenerationHairStyles: readonly RiderHairStyle[];
};

export type RiderAvatarDesign = {
  version: 1 | 2 | 3;
  profileKey: RiderAvatarProfileKey;
  profileGroup: RiderAvatarProfileGroup;
  seed: string;
  skinTone: string;
  skinShadow: string;
  skinHighlight: string;
  hairColor: string;
  hairHighlight: string;
  eyeColor: string;
  rightEyeColor: string;
  backgroundColor: string;
  hairStyle: RiderHairStyle;
  eyeStyle: RiderEyeStyle;
  noseStyle: RiderNoseStyle;
  mouthStyle: RiderMouthStyle;
  earStyle: RiderEarStyle;
  gazeStyle: RiderGazeStyle;
  browStyle: RiderBrowStyle;
  faceShape: RiderFaceShape;
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
  mouthYOffset: number;
  earHeight: number;
  earWidth: number;
  neckWidth: number;
  ageLineOpacity: number;
  agingStage: RiderAvatarAgingStage;
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

// Version 2 only. Short styles deliberately remain the overwhelming majority:
// tied or genuinely long hair appears, but stays unusual among road cyclists.
const EXPANDED_BALANCED_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "quiff",
  "buzz",
  "messy",
  "waves",
  "curly",
  "slicked",
  "football-curl",
  "undercut",
  "mohawk",
  "buzz",
  "fringe",
  "ponytail",
  "shaved",
  "man-bun",
] as const;

const EXPANDED_AFRICAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "coily",
  "buzz",
  "short-locks",
  "waves",
  "shaved",
  "crop",
  "afro",
  "buzz",
  "dreadlocks",
  "curly",
  "waves",
  "shaved",
  "braids",
  "crop",
  "buzz",
  "long-dreadlocks",
] as const;

const EXPANDED_ASIAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "fringe",
  "buzz",
  "messy",
  "slicked",
  "undercut",
  "side-part",
  "football-curl",
  "quiff",
  "buzz",
  "shaved",
  "mohawk",
  "ponytail",
  "crop",
  "man-bun",
] as const;

const BALANCED_EYES: readonly RiderEyeStyle[] = [
  "soft",
  "almond",
  "deep",
  "round",
  "hooded",
  "narrow",
  "upturned",
  "downturned",
  "monolid",
  "prominent",
  "almond",
  "round",
  "hooded",
  "soft",
  "deep",
  "upturned",
] as const;

const EAST_ASIAN_EYES: readonly RiderEyeStyle[] = [
  "almond",
  "hooded",
  "narrow",
  "soft",
  "monolid",
  "upturned",
  "deep",
  "downturned",
  "almond",
  "soft",
  "hooded",
  "prominent",
  "narrow",
  "monolid",
  "round",
  "deep",
] as const;

const EXPANDED_BALANCED_EYES: readonly RiderEyeStyle[] = [
  "soft",
  "almond",
  "deep",
  "round",
  "hooded",
  "narrow",
  "upturned",
  "downturned",
  "monolid",
  "prominent",
  "large",
  "small",
  "sharp",
  "sleepy",
  "squinting",
  "almond",
] as const;

const EXPANDED_EAST_ASIAN_EYES: readonly RiderEyeStyle[] = [
  "almond",
  "hooded",
  "narrow",
  "soft",
  "monolid",
  "upturned",
  "deep",
  "downturned",
  "large",
  "small",
  "sharp",
  "sleepy",
  "squinting",
  "monolid",
  "prominent",
  "almond",
] as const;

const BALANCED_NOSES: readonly RiderNoseStyle[] = [
  "straight",
  "rounded",
  "tapered",
  "compact",
  "angular",
  "broad",
  "aquiline",
  "button",
  "long",
  "snub",
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
  "button",
  "snub",
  "angular",
  "aquiline",
  "long",
  "broad",
  "tapered",
  "rounded",
  "compact",
  "broad",
  "straight",
  "angular",
] as const;

const EXPANDED_BALANCED_NOSES: readonly RiderNoseStyle[] = [
  "straight",
  "rounded",
  "tapered",
  "compact",
  "angular",
  "broad",
  "aquiline",
  "button",
  "long",
  "snub",
  "bulbous",
  "fine",
  "flared",
  "flat",
  "hooked",
  "wide-bridge",
] as const;

const EXPANDED_BROADER_NOSES: readonly RiderNoseStyle[] = [
  "broad",
  "rounded",
  "compact",
  "straight",
  "button",
  "snub",
  "angular",
  "aquiline",
  "long",
  "bulbous",
  "flared",
  "flat",
  "wide-bridge",
  "broad",
  "fine",
  "hooked",
] as const;

const BALANCED_MOUTHS: readonly RiderMouthStyle[] = [
  "balanced",
  "defined",
  "soft",
  "wide",
  "full",
  "narrow",
  "bowed",
  "flat",
  "smile",
  "downturned",
  "wide",
  "balanced",
  "narrow",
  "soft",
  "defined",
  "full",
] as const;

const EXPANDED_MOUTHS: readonly RiderMouthStyle[] = [
  "balanced",
  "defined",
  "soft",
  "wide",
  "full",
  "narrow",
  "bowed",
  "flat",
  "smile",
  "downturned",
  "gritted",
  "grimace",
  "open",
  "open-smile",
  "pursed",
  "smirk",
] as const;

const FACE_SHAPES: readonly RiderFaceShape[] = [
  "oval",
  "angular",
  "round",
  "square",
  "diamond",
  "long",
  "heart",
  "oval",
  "angular",
  "round",
  "square",
  "oval",
  "diamond",
  "long",
  "heart",
  "oval",
] as const;

const EAR_STYLES: readonly RiderEarStyle[] = [
  "rounded",
  "attached",
  "small",
  "angular",
  "prominent",
  "tapered",
  "rounded",
  "attached",
  "small",
  "rounded",
  "prominent",
  "angular",
  "attached",
  "tapered",
  "rounded",
  "small",
] as const;

const EXPANDED_FACE_SHAPES: readonly RiderFaceShape[] = [
  "oval",
  "angular",
  "tapered",
  "oval",
  "diamond",
  "long",
  "heart",
  "oval",
  "angular",
  "round",
  "square",
  "oval",
  "broad",
  "long",
  "tapered",
  "oval",
] as const;

const EXPANDED_EAR_STYLES: readonly RiderEarStyle[] = [
  "rounded",
  "attached",
  "small",
  "angular",
  "prominent",
  "tapered",
  "lobed",
  "long",
  "pointed",
  "wide",
  "rounded",
  "attached",
  "small",
  "rounded",
  "prominent",
  "angular",
] as const;

const EXPANDED_BROW_STYLES: readonly RiderBrowStyle[] = [
  "classic",
  "arched",
  "straight",
  "soft",
  "heavy",
  "low-angled",
  "classic",
  "straight",
  "soft",
  "arched",
  "classic",
  "heavy",
  "straight",
  "classic",
  "low-angled",
  "soft",
] as const;

// Version 3 is deliberately isolated from the historical catalogues above.
// Only seeds in the v3 namespace can select these traits, so adding diversity
// here never redraws an existing v1 or v2 rider.
const THIRD_GENERATION_BALANCED_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "crew-cut",
  "buzz",
  "messy",
  "waves",
  "curly",
  "slicked",
  "football-curl",
  "undercut",
  "widows-peak",
  "quiff",
  "fringe",
  "shaved",
  "bald",
  "receding",
  "balding",
  "long-waves",
  "shoulder-length",
  "shoulder-curls",
  "big-afro",
  "high-top",
  "crop",
  "side-part",
  "crew-cut",
  "buzz",
  "curly",
  "waves",
  "messy",
  "quiff",
  "ponytail",
  "man-bun",
] as const;

const THIRD_GENERATION_AFRICAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "coily",
  "buzz",
  "short-locks",
  "waves",
  "crew-cut",
  "crop",
  "big-afro",
  "high-top",
  "afro",
  "dreadlocks",
  "curly",
  "shaved",
  "braids",
  "long-dreadlocks",
  "shoulder-curls",
  "bald",
  "receding",
  "balding",
  "coily",
  "buzz",
  "short-locks",
  "waves",
  "crop",
  "big-afro",
  "high-top",
  "afro",
  "dreadlocks",
  "curly",
  "crew-cut",
  "braids",
  "shoulder-length",
  "widows-peak",
] as const;

const THIRD_GENERATION_ASIAN_HAIR_STYLES: readonly RiderHairStyle[] = [
  "crop",
  "side-part",
  "fringe",
  "buzz",
  "messy",
  "slicked",
  "undercut",
  "crew-cut",
  "football-curl",
  "quiff",
  "widows-peak",
  "shaved",
  "high-top",
  "long-waves",
  "shoulder-length",
  "ponytail",
  "man-bun",
  "bald",
  "receding",
  "balding",
  "crop",
  "side-part",
  "fringe",
  "buzz",
  "messy",
  "slicked",
  "crew-cut",
  "quiff",
  "long-waves",
  "shoulder-length",
  "waves",
  "curly",
] as const;

const THIRD_GENERATION_EYES: readonly RiderEyeStyle[] = [
  "soft",
  "almond",
  "deep",
  "round",
  "hooded",
  "narrow",
  "upturned",
  "downturned",
  "monolid",
  "prominent",
  "large",
  "small",
  "sharp",
  "sleepy",
  "squinting",
  "wide-open",
  "laughing",
  "crescent",
  "droopy",
  "piercing",
  "heavy-lidded",
  "almond",
  "soft",
  "round",
  "hooded",
  "narrow",
  "large",
  "upturned",
  "downturned",
  "monolid",
  "deep",
  "laughing",
] as const;

const THIRD_GENERATION_NOSES: readonly RiderNoseStyle[] = [
  "straight",
  "rounded",
  "tapered",
  "compact",
  "angular",
  "broad",
  "aquiline",
  "button",
  "long",
  "snub",
  "bulbous",
  "fine",
  "flared",
  "flat",
  "hooked",
  "wide-bridge",
  "potato",
  "roman",
  "eagle",
  "massive",
  "minimal",
  "petite",
  "crooked",
  "upturned",
  "drooping",
  "straight",
  "rounded",
  "broad",
  "aquiline",
  "button",
  "fine",
  "compact",
] as const;

const THIRD_GENERATION_MOUTHS: readonly RiderMouthStyle[] = [
  "balanced",
  "defined",
  "soft",
  "wide",
  "full",
  "narrow",
  "bowed",
  "flat",
  "smile",
  "downturned",
  "gritted",
  "grimace",
  "open",
  "open-smile",
  "pursed",
  "smirk",
  "big-grin",
  "rictus",
  "clenched",
  "plush",
  "thin-lips",
  "crooked-smile",
  "underbite",
  "balanced",
  "soft",
  "wide",
  "full",
  "narrow",
  "smile",
  "defined",
  "bowed",
  "flat",
] as const;

const THIRD_GENERATION_FACE_SHAPES: readonly RiderFaceShape[] = [
  "oval",
  "angular",
  "tapered",
  "diamond",
  "long",
  "heart",
  "round",
  "square",
  "broad",
  "gaunt",
  "rectangular",
  "pear",
  "strong-jaw",
  "soft-round",
  "wide-cheek",
  "inverted-triangle",
  "oval",
  "angular",
  "tapered",
  "diamond",
  "long",
  "heart",
  "round",
  "square",
  "broad",
  "oval",
  "gaunt",
  "rectangular",
  "strong-jaw",
  "soft-round",
  "wide-cheek",
  "oval",
] as const;

const THIRD_GENERATION_EAR_STYLES: readonly RiderEarStyle[] = [
  "rounded",
  "attached",
  "small",
  "angular",
  "prominent",
  "tapered",
  "lobed",
  "long",
  "pointed",
  "wide",
  "cupped",
  "flat",
  "large-lobed",
  "high-set",
  "low-set",
  "uneven",
  "rounded",
  "attached",
  "small",
  "angular",
  "prominent",
  "tapered",
  "lobed",
  "long",
  "rounded",
  "small",
  "cupped",
  "flat",
  "large-lobed",
  "attached",
  "prominent",
  "rounded",
] as const;

const THIRD_GENERATION_BROW_STYLES: readonly RiderBrowStyle[] = [
  "classic",
  "arched",
  "straight",
  "soft",
  "heavy",
  "low-angled",
  "bushy",
  "furrowed",
  "rounded",
  "thin",
  "classic",
  "straight",
  "soft",
  "arched",
  "heavy",
  "classic",
] as const;

const THIRD_GENERATION_FACE_MARKS: readonly RiderFaceMark[] = [
  "none",
  "freckles",
  "none",
  "sun-kissed",
  "none",
  "cheek-freckles",
  "none",
  "left-scar",
  "none",
  "right-scar",
  "none",
  "beauty-mark",
  "none",
  "cleft-chin",
  "none",
  "dimples",
  "none",
  "birthmark",
  "none",
  "freckles",
  "none",
  "sun-kissed",
  "none",
  "cheek-freckles",
  "none",
  "none",
  "none",
  "beauty-mark",
  "none",
  "cleft-chin",
  "none",
  "dimples",
] as const;

const THIRD_GENERATION_SKIN_TONE_ACCENTS: Record<
  RiderAvatarProfileGroup,
  readonly string[]
> = {
  africa: ["#B97955", "#9E6447", "#89533B", "#6D4030", "#583126", "#47271F", "#3A211C", "#2D1916"],
  east_asia: ["#F4D8C0", "#EAC8AA", "#DBB394", "#CFA27F", "#BD8D6A", "#A97759", "#946048", "#7E4E3C"],
  europe: ["#F9E1D2", "#F2CEB9", "#E5B69C", "#D8A185", "#C98D70", "#B8785D", "#A96651", "#955443"],
  latin_america: ["#EDC8AC", "#DFB392", "#D09C79", "#BF8765", "#AD7254", "#995E46", "#824B39", "#6B3A2E"],
  mixed: ["#F7DAC6", "#E6B99C", "#CF9875", "#B87D5C", "#9F664B", "#82503D", "#63392E", "#452720"],
  south_asia: ["#E0B590", "#D0A078", "#BE8964", "#AB7452", "#976044", "#814D38", "#6C3D2F", "#573027"],
  southeast_asia: ["#EBC9AC", "#DEB696", "#CFA27F", "#BD8D6C", "#AA795A", "#956449", "#7D4F3A", "#67402F"],
  west_asia: ["#F0CEB2", "#E3B99A", "#D4A581", "#C08F6B", "#AD7957", "#986448", "#80503A", "#69402F"],
};

const THIRD_GENERATION_EYE_COLOR_ACCENTS: Record<
  RiderAvatarProfileGroup,
  readonly string[]
> = {
  africa: ["#241914", "#31221A", "#423024", "#523C2B", "#654B33", "#76572F", "#596049", "#2D211B"],
  east_asia: ["#201713", "#2B1E18", "#392920", "#493527", "#5A432F", "#6B5037", "#55624C", "#251B16"],
  europe: ["#3D6F88", "#4E7D70", "#668A65", "#708B8F", "#7787A1", "#78935E", "#8A744F", "#526D76"],
  latin_america: ["#251A15", "#38271E", "#4C3727", "#60482F", "#755A37", "#697056", "#557269", "#2E211A"],
  mixed: ["#251A15", "#493326", "#654B33", "#7A613F", "#60755E", "#4C7580", "#687E91", "#416A5B"],
  south_asia: ["#211713", "#302019", "#422D21", "#563D2B", "#6D5135", "#806138", "#5B6045", "#2A1D17"],
  southeast_asia: ["#201713", "#2D2019", "#3E2C21", "#513B2A", "#654A32", "#755A3A", "#56624E", "#291D17"],
  west_asia: ["#251A15", "#39281E", "#4C3727", "#604A32", "#765C3C", "#687556", "#4D7469", "#344F58"],
};

const FACE_SHAPE_GEOMETRY: Record<
  RiderFaceShape,
  {
    faceWidth: number;
    faceHeight: number;
    jawWidth: number;
    foreheadWidth: number;
    cheekboneWidth: number;
    chinWidth: number;
  }
> = {
  angular: {
    faceWidth: 0.2,
    faceHeight: 0.5,
    jawWidth: 1,
    foreheadWidth: 0,
    cheekboneWidth: 0.8,
    chinWidth: -1.2,
  },
  broad: {
    faceWidth: 2.8,
    faceHeight: -0.4,
    jawWidth: 3.3,
    foreheadWidth: 2.2,
    cheekboneWidth: 2.4,
    chinWidth: 2.8,
  },
  diamond: {
    faceWidth: 0,
    faceHeight: 0.4,
    jawWidth: -0.8,
    foreheadWidth: -1,
    cheekboneWidth: 2.6,
    chinWidth: -0.3,
  },
  gaunt: {
    faceWidth: -1.5,
    faceHeight: 2,
    jawWidth: -2.1,
    foreheadWidth: -0.6,
    cheekboneWidth: 1.8,
    chinWidth: -1.8,
  },
  heart: {
    faceWidth: 0.3,
    faceHeight: 0,
    jawWidth: -1.8,
    foreheadWidth: 2,
    cheekboneWidth: 1,
    chinWidth: -1,
  },
  "inverted-triangle": {
    faceWidth: 0.4,
    faceHeight: 0.6,
    jawWidth: -2.4,
    foreheadWidth: 3,
    cheekboneWidth: 1.3,
    chinWidth: -1.9,
  },
  long: {
    faceWidth: -0.6,
    faceHeight: 3,
    jawWidth: -0.5,
    foreheadWidth: -0.5,
    cheekboneWidth: -0.4,
    chinWidth: -0.2,
  },
  oval: {
    faceWidth: 0,
    faceHeight: 0,
    jawWidth: 0,
    foreheadWidth: 0,
    cheekboneWidth: 0,
    chinWidth: 0,
  },
  pear: {
    faceWidth: 1.2,
    faceHeight: 0.3,
    jawWidth: 3.8,
    foreheadWidth: -1.4,
    cheekboneWidth: 0.8,
    chinWidth: 2.2,
  },
  rectangular: {
    faceWidth: 0.8,
    faceHeight: 2.7,
    jawWidth: 3.1,
    foreheadWidth: 1.2,
    cheekboneWidth: 1.1,
    chinWidth: 2.5,
  },
  round: {
    faceWidth: 1.4,
    faceHeight: -1.6,
    jawWidth: 1.4,
    foreheadWidth: 0.5,
    cheekboneWidth: 1.2,
    chinWidth: 1.4,
  },
  "soft-round": {
    faceWidth: 2.4,
    faceHeight: -2.1,
    jawWidth: 2.2,
    foreheadWidth: 1.4,
    cheekboneWidth: 2.1,
    chinWidth: 2,
  },
  square: {
    faceWidth: 1,
    faceHeight: -0.7,
    jawWidth: 3,
    foreheadWidth: 1,
    cheekboneWidth: 1,
    chinWidth: 2.3,
  },
  "strong-jaw": {
    faceWidth: 1.3,
    faceHeight: 0.3,
    jawWidth: 4.8,
    foreheadWidth: 0.7,
    cheekboneWidth: 1.5,
    chinWidth: 3.5,
  },
  tapered: {
    faceWidth: -0.2,
    faceHeight: 0.7,
    jawWidth: -1.8,
    foreheadWidth: 1.1,
    cheekboneWidth: 0.6,
    chinWidth: -1.4,
  },
  "wide-cheek": {
    faceWidth: 2,
    faceHeight: 0,
    jawWidth: 0.2,
    foreheadWidth: 0.4,
    cheekboneWidth: 4,
    chinWidth: 0.2,
  },
};

const NOSE_LENGTH_FACTORS: Record<RiderNoseStyle, number> = {
  angular: 1,
  aquiline: 1.06,
  bulbous: 0.98,
  broad: 0.98,
  button: 0.76,
  compact: 0.88,
  crooked: 1.02,
  drooping: 1.14,
  eagle: 1.17,
  fine: 1.03,
  flared: 0.96,
  flat: 0.84,
  hooked: 1.1,
  long: 1.14,
  massive: 1.1,
  minimal: 0.68,
  petite: 0.72,
  potato: 0.91,
  roman: 1.12,
  rounded: 0.96,
  snub: 0.82,
  straight: 1,
  tapered: 1.02,
  upturned: 0.8,
  "wide-bridge": 1,
};

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
    expandedHairStyles:
      hairStyles === AFRICAN_HAIR_STYLES
        ? EXPANDED_AFRICAN_HAIR_STYLES
        : hairStyles === ASIAN_HAIR_STYLES
          ? EXPANDED_ASIAN_HAIR_STYLES
          : EXPANDED_BALANCED_HAIR_STYLES,
    expandedEyeStyles:
      eyeStyles === EAST_ASIAN_EYES
        ? EXPANDED_EAST_ASIAN_EYES
        : EXPANDED_BALANCED_EYES,
    expandedNoseStyles:
      noseStyles === BROADER_NOSES
        ? EXPANDED_BROADER_NOSES
        : EXPANDED_BALANCED_NOSES,
    thirdGenerationSkinTones: [
      ...skinTones,
      ...THIRD_GENERATION_SKIN_TONE_ACCENTS[group],
    ],
    thirdGenerationEyeColors: [
      ...eyeColors,
      ...THIRD_GENERATION_EYE_COLOR_ACCENTS[group],
    ],
    thirdGenerationHairStyles:
      hairStyles === AFRICAN_HAIR_STYLES
        ? THIRD_GENERATION_AFRICAN_HAIR_STYLES
        : hairStyles === ASIAN_HAIR_STYLES
          ? THIRD_GENERATION_ASIAN_HAIR_STYLES
          : THIRD_GENERATION_BALANCED_HAIR_STYLES,
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

const EXPANDED_FACIAL_HAIR_STYLES: readonly RiderFacialHairStyle[] = [
  "clean",
  "five-o-clock",
  "clean",
  "stubble",
  "clean",
  "light-beard",
  "five-o-clock",
  "moustache",
  "clean",
  "sideburns",
  "stubble",
  "chinstrap",
  "clean",
  "goatee",
  "short-beard",
  "five-o-clock",
] as const;

const HEAVY_FACIAL_HAIR_STYLES: readonly RiderFacialHairStyle[] = [
  "full-beard",
  "long-beard",
  "thick-moustache",
  "handlebar",
] as const;

const RARE_HAIR_COLORS = [
  "#C9B18C",
  "#D9D6CB",
  "#B85C38",
  "#8E4930",
  "#E2C98E",
] as const;

const RARE_EYE_COLORS = [
  "#3F7696",
  "#4D8367",
  "#9A7134",
  "#78828B",
  "#5C8A84",
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
export const RIDER_AVATAR_V3_SEED_OFFSET = BigInt("1000000000000");
const MASK_64 =
  (BigInt(1) << BigInt(64)) - BigInt(1);
const SCRAMBLE_MULTIPLIER = BigInt(
  "6364136223846793005"
);
const SCRAMBLE_INCREMENT = BigInt(
  "1442695040888963407"
);

export function isExpandedRiderAvatarSeed(
  seed: bigint | number | string | null | undefined
): boolean {
  if (typeof seed === "bigint") {
    return seed < BIGINT_ZERO;
  }

  if (typeof seed === "number") {
    return Number.isFinite(seed) && seed < 0;
  }

  return typeof seed === "string" && /^-\d+$/.test(seed.trim());
}

export function isThirdGenerationRiderAvatarSeed(
  seed: bigint | number | string | null | undefined
): boolean {
  if (typeof seed === "bigint") {
    return seed < -RIDER_AVATAR_V3_SEED_OFFSET;
  }

  if (typeof seed === "number") {
    return (
      Number.isSafeInteger(seed) &&
      seed < -Number(RIDER_AVATAR_V3_SEED_OFFSET)
    );
  }

  if (typeof seed !== "string" || !/^-\d+$/.test(seed.trim())) {
    return false;
  }

  return BigInt(seed.trim()) < -RIDER_AVATAR_V3_SEED_OFFSET;
}

export function createThirdGenerationRiderAvatarSeed(
  identitySeed: bigint | number | string
): string {
  const parsedSeed = BigInt(identitySeed);
  const positiveSeed = parsedSeed < BIGINT_ZERO ? -parsedSeed : parsedSeed;

  return `-${RIDER_AVATAR_V3_SEED_OFFSET + positiveSeed}`;
}

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
  const version: 1 | 2 | 3 = isThirdGenerationRiderAvatarSeed(seed)
    ? 3
    : isExpandedRiderAvatarSeed(seed)
      ? 2
      : 1;
  const normalizedSeed = normalizeSeed(seed, fallbackKey);
  const primary = new MixedRadixCursor(
    scrambleSeed(normalizedSeed)
  );
  const details = new MixedRadixCursor(
    mixSeed(
      normalizedSeed ^ BigInt("0x9e3779b97f4a7c15")
    )
  );
  const rareDetails = new MixedRadixCursor(
    mixSeed(
      normalizedSeed ^ BigInt("0xd1b54a32d192ed03")
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
  const mouthYStep = primary.take(7);

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
    mouthYStep,
  ].join("-");

  let skinTone = pick(
    version === 3 ? profile.thirdGenerationSkinTones : profile.skinTones,
    details.take(version === 3 ? profile.thirdGenerationSkinTones.length : 8)
  );
  let hairColor = pick(profile.hairColors, details.take(8));
  let eyeColor = pick(
    version === 3 ? profile.thirdGenerationEyeColors : profile.eyeColors,
    details.take(version === 3 ? profile.thirdGenerationEyeColors.length : 8)
  );
  const backgroundColor = pick(BACKGROUNDS, details.take(8));
  let hairStyle = pick(
    version === 3
      ? profile.thirdGenerationHairStyles
      : version === 2
        ? profile.expandedHairStyles
        : profile.hairStyles,
    details.take(version === 3 ? profile.thirdGenerationHairStyles.length : 16)
  );
  const eyeStyle = pick(
    version === 3
      ? THIRD_GENERATION_EYES
      : version === 2
        ? profile.expandedEyeStyles
        : profile.eyeStyles,
    details.take(version === 3 ? THIRD_GENERATION_EYES.length : 16)
  );
  const noseStyle = pick(
    version === 3
      ? THIRD_GENERATION_NOSES
      : version === 2
        ? profile.expandedNoseStyles
        : profile.noseStyles,
    details.take(version === 3 ? THIRD_GENERATION_NOSES.length : 16)
  );
  const mouthStyle = pick(
    version === 3
      ? THIRD_GENERATION_MOUTHS
      : version === 2
        ? EXPANDED_MOUTHS
        : profile.mouthStyles,
    details.take(version === 3 ? THIRD_GENERATION_MOUTHS.length : 16)
  );
  let facialHairStyle = pick(
    version === 2 ? EXPANDED_FACIAL_HAIR_STYLES : FACIAL_HAIR_STYLES,
    details.take(16)
  );
  const faceMark = pick(
    version === 3 ? THIRD_GENERATION_FACE_MARKS : FACE_MARKS,
    details.take(version === 3 ? THIRD_GENERATION_FACE_MARKS.length : 16)
  );
  const faceShape = pick(
    version === 3
      ? THIRD_GENERATION_FACE_SHAPES
      : version === 2
        ? EXPANDED_FACE_SHAPES
        : FACE_SHAPES,
    details.take(version === 3 ? THIRD_GENERATION_FACE_SHAPES.length : 16)
  );
  const earStyle = pick(
    version === 3
      ? THIRD_GENERATION_EAR_STYLES
      : version === 2
        ? EXPANDED_EAR_STYLES
        : EAR_STYLES,
    details.take(version === 3 ? THIRD_GENERATION_EAR_STYLES.length : 16)
  );
  const shapeGeometry = FACE_SHAPE_GEOMETRY[faceShape];

  let rightEyeColor = eyeColor;
  let gazeStyle: RiderGazeStyle = "centered";
  let browStyle: RiderBrowStyle = "classic";

  if (version >= 2) {
    if (rareDetails.take(36) === 0) {
      hairColor = pick(RARE_HAIR_COLORS, rareDetails.take(5));
    }

    if (rareDetails.take(40) === 0) {
      eyeColor = pick(RARE_EYE_COLORS, rareDetails.take(5));
      rightEyeColor = eyeColor;
    }

    if (rareDetails.take(128) === 0) {
      rightEyeColor = pick(
        RARE_EYE_COLORS,
        rareDetails.take(5) + 1
      );
    }

    const gazeRoll = rareDetails.take(128);
    gazeStyle =
      gazeRoll === 0
        ? "crossed"
        : gazeRoll === 1
          ? "wall-eyed"
          : gazeRoll <= 4
            ? "left"
            : gazeRoll <= 7
              ? "right"
              : "centered";
    browStyle = pick(
      version === 3 ? THIRD_GENERATION_BROW_STYLES : EXPANDED_BROW_STYLES,
      rareDetails.take(16)
    );

    const heavyHairRadix = age < 19 ? 96 : 32;
    if (rareDetails.take(heavyHairRadix) === 0) {
      facialHairStyle = pick(
        HEAVY_FACIAL_HAIR_STYLES,
        rareDetails.take(4)
      );
    }
  }

  const normalizedAge = Number.isFinite(age)
    ? clamp(Math.trunc(age), 15, 120)
    : 25;

  if (
    version === 3 &&
    normalizedAge < 23 &&
    (hairStyle === "receding" || hairStyle === "balding") &&
    rareDetails.take(8) !== 0
  ) {
    hairStyle = pick(["crew-cut", "buzz"] as const, rareDetails.take(2));
  }
  const agingStage: RiderAvatarAgingStage =
    normalizedAge >= 90
      ? "lich"
      : normalizedAge >= 55
        ? "white"
        : normalizedAge >= 40
          ? "grey"
          : "adult";

  if (agingStage === "grey") {
    hairColor = mixHexColors(hairColor, "#8C918E", 0.64);
  } else if (agingStage === "white") {
    hairColor = "#E7E8E2";
  } else if (agingStage === "lich") {
    skinTone = "#B8D2C9";
    hairColor = "#EEF4EF";
    eyeColor = "#71F4E4";
    rightEyeColor = eyeColor;
  }

  const ageLineOpacity =
    agingStage === "lich"
      ? 0.82
      : agingStage === "white"
        ? 0.48
        : agingStage === "grey"
          ? 0.28
          : 0;

  return {
    version,
    profileKey: normalizedProfileKey,
    profileGroup: profile.group,
    seed: version >= 2 ? `-${normalizedSeed}` : normalizedSeed.toString(),
    skinTone,
    skinShadow: shiftHexColor(skinTone, -25),
    skinHighlight: shiftHexColor(skinTone, 18),
    hairColor,
    hairHighlight:
      agingStage === "lich"
        ? "#FFFFFF"
        : shiftHexColor(hairColor, agingStage === "white" ? 12 : 24),
    eyeColor,
    rightEyeColor,
    backgroundColor,
    hairStyle,
    eyeStyle,
    noseStyle,
    mouthStyle,
    facialHairStyle,
    gazeStyle,
    browStyle,
    faceMark,
    faceShape,
    earStyle,
    faceWidth:
      (version === 3
        ? 29.8 + faceWidthStep * 0.58
        : version === 2
          ? 30.4 + faceWidthStep * 0.46
          : 31 + faceWidthStep * 0.38) +
      shapeGeometry.faceWidth,
    faceHeight:
      (version === 3
        ? 40.8 + faceHeightStep * 0.48
        : version === 2
          ? 41.4 + faceHeightStep * 0.39
          : 42 + faceHeightStep * 0.32) +
      shapeGeometry.faceHeight,
    jawWidth:
      (version === 3
        ? 15.8 + jawWidthStep * 0.67
        : version === 2
          ? 17.2 + jawWidthStep * 0.5
          : 18 + jawWidthStep * 0.42) +
      shapeGeometry.jawWidth,
    foreheadWidth:
      (version === 3
        ? 23 + foreheadWidthStep * 0.72
        : version === 2
          ? 24.2 + foreheadWidthStep * 0.58
          : 25 + foreheadWidthStep * 0.46) + shapeGeometry.foreheadWidth,
    cheekboneWidth:
      (version === 3
        ? 23 + cheekboneWidthStep * 0.7
        : version === 2
          ? 24.4 + cheekboneWidthStep * 0.54
          : 25 + cheekboneWidthStep * 0.44) + shapeGeometry.cheekboneWidth,
    chinWidth:
      (version === 3
        ? 6.8 + chinWidthStep * 0.64
        : version === 2
          ? 7.9 + chinWidthStep * 0.48
          : 8.5 + chinWidthStep * 0.38) +
      shapeGeometry.chinWidth,
    eyeSpacing:
      version === 3
        ? 12.5 + eyeSpacingStep * 0.6
        : version === 2
          ? 13.2 + eyeSpacingStep * 0.58
          : 14.5 + eyeSpacingStep * 0.42,
    eyeWidth:
      version === 3
        ? 5.2 + eyeWidthStep * 0.38
        : version === 2
          ? 5.55 + eyeWidthStep * 0.29
          : 6.2 + eyeWidthStep * 0.19,
    eyeTilt: -1 + eyeTiltStep * 0.25,
    eyeY: 39.5 + eyeYStep * 0.36,
    eyeAsymmetry: (asymmetryStep - 3) * 0.12,
    browY: 34.2 + browHeightStep * 0.28,
    noseWidth:
      version === 3
        ? 3.1 + noseWidthStep * 0.51
        : version === 2
          ? 3.75 + noseWidthStep * 0.37
          : 4.2 + noseWidthStep * 0.27,
    noseLength:
      version === 3
        ? 6.8 + noseLengthStep * 0.58
        : version === 2
          ? 7.9 + noseLengthStep * 0.4
          : 8.4 + noseLengthStep * 0.31,
    mouthWidth:
      version === 3
        ? 8.7 + mouthWidthStep * 0.7
        : version === 2
          ? 9.8 + mouthWidthStep * 0.47
          : 10.5 + mouthWidthStep * 0.33,
    mouthCurve: -1 + mouthCurveStep * 0.25,
    mouthYOffset: (mouthYStep - 3) * 0.18,
    earHeight:
      version === 3
        ? 8.2 + earHeightStep * 0.62
        : version === 2
          ? 9.2 + earHeightStep * 0.47
          : 10 + earHeightStep * 0.32,
    earWidth:
      version === 3
        ? 2.8 + earWidthStep * 0.42
        : version === 2
          ? 3.25 + earWidthStep * 0.3
          : 3.8 + earWidthStep * 0.18,
    neckWidth: 14 + neckWidthStep * 0.4,
    ageLineOpacity,
    agingStage,
    geometrySignature,
  };
}

export type RiderAvatarFeatureLayout = {
  faceBottom: number;
  noseTopY: number;
  noseBaseY: number;
  noseTipY: number;
  mouthY: number;
};

export function getRiderAvatarFeatureLayout(
  design: RiderAvatarDesign,
  faceTop = 20
): RiderAvatarFeatureLayout {
  const faceBottom = faceTop + design.faceHeight;
  const noseTopY = design.eyeY + 2.5;
  const desiredNoseBaseY =
    noseTopY + design.noseLength * NOSE_LENGTH_FACTORS[design.noseStyle];
  const noseBaseY = Math.min(desiredNoseBaseY, faceBottom - 11.2);
  const noseTipY = noseBaseY + 1;
  const desiredMouthY = faceBottom - 7.1 + design.mouthYOffset;
  const mouthY = Math.min(
    faceBottom - 5.8,
    Math.max(desiredMouthY, noseTipY + 3.1)
  );

  return {
    faceBottom,
    noseTopY,
    noseBaseY,
    noseTipY,
    mouthY,
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

  if (typeof seed === "string" && /^-?\d+$/.test(seed.trim())) {
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

function mixHexColors(
  sourceColor: string,
  targetColor: string,
  targetWeight: number,
): string {
  const source = sourceColor.replace("#", "");
  const target = targetColor.replace("#", "");
  const weight = clamp(targetWeight, 0, 1);

  return `#${[0, 2, 4]
    .map((offset) => {
      const sourceChannel = Number.parseInt(source.slice(offset, offset + 2), 16);
      const targetChannel = Number.parseInt(target.slice(offset, offset + 2), 16);
      return Math.round(sourceChannel * (1 - weight) + targetChannel * weight)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`.toUpperCase();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
