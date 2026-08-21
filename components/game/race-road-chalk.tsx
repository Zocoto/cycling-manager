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
  const chalkLayout = getRaceRoadChalkLayout({
    visualSeed,
    maximumCount: messages.length,
  });
  if (chalkLayout.density === "none") return null;
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
      data-race-road-chalk-density={chalkLayout.density}
      data-race-road-chalk-orientation="top-toward-finish-right"
      data-race-road-chalk-layout="irregular-across-road-width"
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
          chalkLayout.placements.map((placement, index) => {
            const message = messages[index];
            if (!message) return null;
            const x = placement.x + offset;
            const roadY = roadLeft + (roadRight - roadLeft) * (x / 100);
            const y = roadY + roadDepth * placement.laneRatio;
            return (
              <text
                key={`${offset}-${message.text}-${index}`}
                data-race-road-chalk-source={message.source}
                data-race-road-chalk-placement={chalkLayout.density}
                x={x}
                y={y}
                transform={`rotate(${placement.rotation} ${x} ${y})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={placement.fontSize}
                fontWeight="900"
                letterSpacing={placement.letterSpacing}
                textLength={Math.min(
                  roadDepth * placement.widthRatio,
                  placement.maximumWidth,
                )}
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

export type RaceRoadChalkDensity =
  | "none"
  | "sparse"
  | "scattered"
  | "supporter-burst";

type RaceRoadChalkPlacement = {
  x: number;
  laneRatio: number;
  rotation: number;
  fontSize: number;
  letterSpacing: number;
  widthRatio: number;
  maximumWidth: number;
};

export function getRaceRoadChalkLayout({
  visualSeed,
  maximumCount,
}: {
  visualSeed: string | number;
  maximumCount: number;
}): {
  density: RaceRoadChalkDensity;
  placements: RaceRoadChalkPlacement[];
} {
  const seed = stableChalkHash(String(visualSeed));
  const densityRoll = seed % 10;
  const density: RaceRoadChalkDensity =
    densityRoll <= 1
      ? "none"
      : densityRoll <= 4
        ? "sparse"
        : densityRoll <= 7
          ? "scattered"
          : "supporter-burst";
  if (density === "none" || maximumCount <= 0) {
    return { density: "none", placements: [] };
  }

  const sparsePositions = [
    15 + ((seed >>> 3) % 11),
    68 + ((seed >>> 8) % 17),
    43 + ((seed >>> 13) % 9),
  ];
  const scatteredPositions = [
    9 + ((seed >>> 3) % 8),
    31 + ((seed >>> 8) % 10),
    57 + ((seed >>> 13) % 9),
    82 + ((seed >>> 18) % 9),
  ];
  const burstCenter = 34 + ((seed >>> 5) % 33);
  const burstPositions = [-18, -9, -3, 5, 13, 21].map(
    (offset, index) =>
      clampRoadChalkX(
        burstCenter + offset + (((seed >>> (index + 2)) % 5) - 2),
      ),
  );
  const positions = density === "sparse"
    ? sparsePositions.slice(0, 2 + ((seed >>> 6) % 2))
    : density === "scattered"
      ? scatteredPositions
      : burstPositions;

  return {
    density,
    placements: positions.slice(0, maximumCount).map((x, index) => ({
      x,
      laneRatio: 0.38 + ((seed >>> (index + 4)) % 25) / 100,
      rotation: 90 + (((seed >>> (index + 7)) % 15) - 7),
      fontSize: 2.45 + ((seed >>> (index + 10)) % 9) / 10,
      letterSpacing: 0.14 + ((seed >>> (index + 12)) % 12) / 100,
      widthRatio: 0.58 + ((seed >>> (index + 14)) % 22) / 100,
      maximumWidth: 20 + ((seed >>> (index + 16)) % 7),
    })),
  };
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

function clampRoadChalkX(value: number) {
  return Math.max(7, Math.min(93, value));
}
