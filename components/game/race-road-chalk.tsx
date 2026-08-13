import type { CSSProperties } from "react";

const FUN_CHALK_MESSAGES = ["À BLOC", "ÇA PIQUE", "ALLEZ !"] as const;

const ROAD_MARKING_CYCLE_DISTANCE = 28;
const ROAD_MARKING_CYCLE_DURATION_SECONDS = 0.62;
const ROAD_CHALK_LOOP_DISTANCE = 100;
const ROAD_CHALK_LOOP_OFFSETS = [0, ROAD_CHALK_LOOP_DISTANCE] as const;

export function RaceRoadChalk({
  show,
  favoriteNames,
  roadLeft,
  roadRight,
  roadDepth,
  isMoving,
}: {
  show: boolean;
  favoriteNames: readonly string[];
  roadLeft: number;
  roadRight: number;
  roadDepth: number;
  isMoving: boolean;
}) {
  if (!show) return null;

  const messages = [...favoriteNames.slice(0, 2), ...FUN_CHALK_MESSAGES]
    .filter((message, index, values) => values.indexOf(message) === index)
    .slice(0, 3);
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
            const x = 31 + index * 19 + offset;
            const roadY = roadLeft + (roadRight - roadLeft) * (x / 100);
            const y = roadY + roadDepth * 0.5;
            return (
              <text
                key={`${offset}-${message}-${index}`}
                x={x}
                y={y}
                transform={`rotate(90 ${x} ${y})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="3.2"
                fontWeight="900"
                letterSpacing="0.28"
                textLength={Math.min(roadDepth * 0.72, 23)}
                lengthAdjust="spacingAndGlyphs"
              >
                {message.toLocaleUpperCase("fr")}
              </text>
            );
          }),
        )}
      </g>
    </g>
  );
}
