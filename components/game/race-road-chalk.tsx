const FUN_CHALK_MESSAGES = ["À BLOC", "ÇA PIQUE", "ALLEZ !"] as const;

export function RaceRoadChalk({
  show,
  favoriteNames,
  roadLeft,
  roadRight,
  roadDepth,
}: {
  show: boolean;
  favoriteNames: readonly string[];
  roadLeft: number;
  roadRight: number;
  roadDepth: number;
}) {
  if (!show) return null;

  const messages = [...favoriteNames.slice(0, 2), ...FUN_CHALK_MESSAGES]
    .filter((message, index, values) => values.indexOf(message) === index)
    .slice(0, 3);

  return (
    <g
      data-race-road-chalk="climb"
      data-race-road-chalk-orientation="top-toward-finish-right"
      fill="rgba(245,243,226,0.82)"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="0.08"
      paintOrder="stroke"
    >
      {messages.map((message, index) => {
        const x = 31 + index * 19;
        const roadY = roadLeft + (roadRight - roadLeft) * (x / 100);
        const y = roadY + roadDepth * 0.5;
        return (
          <text
            key={`${message}-${index}`}
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
      })}
    </g>
  );
}
