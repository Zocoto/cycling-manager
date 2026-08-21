import type { CSSProperties } from "react";

const FUN_CHALK_MESSAGES = [
  "À BLOC",
  "ÇA PIQUE",
  "PLUS VITE QUE LE WIFI",
  "QUI FREINE PERD LE GOÛTER",
  "GARDE DU GEL POUR NOUS",
  "MÊME PAS MAL",
  "ALLEZ LES JAMBES",
  "ON T’ATTEND EN HAUT",
] as const;

const LOCAL_CLUB_MESSAGES: Record<string, readonly string[]> = {
  BE: ["VC ARDENNES", "WIELERCLUB MOLEN", "PELOTON DU PLAT PAYS"],
  CH: ["VC DES ALPES", "VELO CLUB LEMAN", "PEDALE HELVETIQUE"],
  CO: ["CLUB CICLISTA ANDINO", "ESCUELA CAFETERA", "PEDAL DE ORO"],
  DE: ["RADSPORT FREUNDE", "VELO CLUB RHEIN", "BERGFAHRER"],
  ES: ["CLUB CICLISTA SIERRA", "PEÑA DEL PUERTO", "PEDAL IBERICO"],
  FR: ["VC DU COIN", "PEDALE DES COLS", "AS MONTAGNE"],
  GB: ["HILL CLIMB CLUB", "VELO CLUB DALES", "ROAD CREW"],
  IT: ["VC TOSCANA", "PEDALE FIRENZE", "AS MONTELUPO"],
  NL: ["WIELERCLUB POLDER", "ORANJE PELOTON", "VELO CLUB LIMBURG"],
  PT: ["CLUBE CICLISTA SERRA", "PEDAL ATLANTICO", "VOLTA DO BAIRRO"],
};

const ROAD_MARKING_CYCLE_DISTANCE = 28;
const ROAD_MARKING_CYCLE_DURATION_SECONDS = 0.62;
const ROAD_CHALK_LOOP_DISTANCE = 100;
const ROAD_CHALK_LOOP_OFFSETS = [0, ROAD_CHALK_LOOP_DISTANCE] as const;

export function RaceRoadChalk({
  show,
  favoriteNames,
  teamNames = [],
  countryCode = "",
  visualSeed = "race-chalk",
  roadLeft,
  roadRight,
  roadDepth,
  isMoving,
}: {
  show: boolean;
  favoriteNames: readonly string[];
  teamNames?: readonly string[];
  countryCode?: string;
  visualSeed?: string | number;
  roadLeft: number;
  roadRight: number;
  roadDepth: number;
  isMoving: boolean;
}) {
  if (!show) return null;

  const localClubMessages =
    LOCAL_CLUB_MESSAGES[countryCode.trim().toUpperCase()] ?? [
      "VELO CLUB LOCAL",
      "PEDALE DU PAYS",
      "LES AMIS DU VELO",
    ];
  const messages = selectChalkMessages({
    favorites: favoriteNames,
    teams: teamNames,
    localClubs: localClubMessages,
    visualSeed,
  });
  const roadSlope = (roadRight - roadLeft) / ROAD_CHALK_LOOP_DISTANCE;
  const travelY = -roadSlope * ROAD_CHALK_LOOP_DISTANCE;
  const motionStyle = {
    "--cm-race-road-chalk-travel-y": `${travelY}px`,
    animationDuration: `${
      (Math.hypot(ROAD_CHALK_LOOP_DISTANCE, travelY) /
        ROAD_MARKING_CYCLE_DISTANCE) *
      ROAD_MARKING_CYCLE_DURATION_SECONDS
    }s`,
  } as CSSProperties;

  return (
    <g
      data-race-road-chalk="climb"
      data-race-road-chalk-orientation="top-toward-finish-right"
      data-race-road-chalk-layout="across-road-width"
      data-race-road-flow-direction="right-to-left"
      data-race-road-chalk-moving={isMoving ? "true" : "false"}
      fill="rgba(245,243,226,0.82)"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="0.08"
      paintOrder="stroke"
    >
      <g
        className={isMoving ? "cm-race-road-chalk-svg" : undefined}
        style={isMoving ? motionStyle : undefined}
      >
        {ROAD_CHALK_LOOP_OFFSETS.flatMap((offset) =>
          messages.map((message, index) => {
            const x =
              12 +
              index * (76 / Math.max(1, messages.length - 1)) +
              offset;
            const roadY = roadLeft + (roadRight - roadLeft) * (x / 100);
            const y = roadY + roadDepth * 0.5;
            return (
              <text
                key={`${offset}-${message.text}-${index}`}
                data-race-road-chalk-source={message.source}
                x={x}
                y={y}
                transform={`rotate(90 ${x} ${y})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="2.9"
                fontWeight="900"
                letterSpacing="0.22"
                textLength={Math.min(roadDepth * 0.78, 25)}
                lengthAdjust="spacingAndGlyphs"
              >
                {message.text}
              </text>
            );
          }),
        )}
      </g>
    </g>
  );
}

type ChalkMessage = {
  text: string;
  source: "favorite" | "team" | "local-club" | "supporter";
};

function selectChalkMessages({
  favorites,
  teams,
  localClubs,
  visualSeed,
}: {
  favorites: readonly string[];
  teams: readonly string[];
  localClubs: readonly string[];
  visualSeed: string | number;
}): ChalkMessage[] {
  const seed = stableChalkHash(String(visualSeed));
  const rotate = <T,>(values: readonly T[], offset: number) =>
    values.length === 0
      ? []
      : [
          ...values.slice(offset % values.length),
          ...values.slice(0, offset % values.length),
        ];
  const candidates: ChalkMessage[] = [
    ...rotate(favorites, seed).slice(0, 2).map((text) => ({
      text: formatChalkText(text),
      source: "favorite" as const,
    })),
    ...rotate(teams, seed >>> 3).slice(0, 2).map((text) => ({
      text: formatChalkText(text),
      source: "team" as const,
    })),
    ...rotate(localClubs, seed >>> 5).slice(0, 1).map((text) => ({
      text: formatChalkText(text),
      source: "local-club" as const,
    })),
    ...rotate(FUN_CHALK_MESSAGES, seed >>> 7).slice(0, 3).map((text) => ({
      text: formatChalkText(text),
      source: "supporter" as const,
    })),
  ];
  const unique = new Map<string, ChalkMessage>();
  for (const candidate of candidates) {
    if (!candidate.text || unique.has(candidate.text)) continue;
    unique.set(candidate.text, candidate);
  }
  return [...unique.values()].slice(0, 6);
}

function formatChalkText(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("fr");
  return normalized.length <= 25
    ? normalized
    : `${normalized.slice(0, 24).trimEnd()}…`;
}

function stableChalkHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    19,
  );
}
