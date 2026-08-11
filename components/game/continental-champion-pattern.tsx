import {
  CONTINENTAL_CHAMPION_PALETTES,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";

type ContinentalChampionPatternProps = {
  continentCode: ContinentalChampionshipCode;
  x?: number;
  y?: number;
  width: number;
  height: number;
  clipPathId?: string;
};

export function ContinentalChampionPattern({
  continentCode,
  x = 0,
  y = 0,
  width,
  height,
  clipPathId,
}: ContinentalChampionPatternProps) {
  const palette = CONTINENTAL_CHAMPION_PALETTES[continentCode];
  const clipPath = clipPathId ? `url(#${clipPathId})` : undefined;

  return (
    <g
      clipPath={clipPath}
      data-continental-champion={continentCode}
      aria-hidden="true"
    >
      <rect x={x} y={y} width={width} height={height} fill={palette.primary} />
      {continentCode === "europe" ? (
        <EuropeanPattern x={x} y={y} width={width} height={height} />
      ) : continentCode === "africa" ? (
        <AfricanPattern x={x} y={y} width={width} height={height} />
      ) : continentCode === "america" ? (
        <AmericanPattern x={x} y={y} width={width} height={height} />
      ) : continentCode === "asia" ? (
        <AsianPattern x={x} y={y} width={width} height={height} />
      ) : (
        <OceaniaPattern x={x} y={y} width={width} height={height} />
      )}
    </g>
  );
}

function EuropeanPattern({ x, y, width, height }: PatternGeometry) {
  const bandY = y + height * 0.34;
  const bandHeight = height * 0.32;
  return (
    <>
      <rect x={x} y={bandY} width={width} height={bandHeight} fill="#003399" />
      {Array.from({ length: 8 }, (_, index) => (
        <circle
          key={index}
          cx={x + width * (0.15 + index * 0.1)}
          cy={bandY + bandHeight / 2}
          r={Math.max(0.8, Math.min(width, height) * 0.025)}
          fill="#FFCC00"
        />
      ))}
      <rect
        x={x}
        y={bandY}
        width={width}
        height={height * 0.035}
        fill="#5EA8E0"
      />
    </>
  );
}

function AfricanPattern({ x, y, width, height }: PatternGeometry) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#16834A" />
      <path
        d={`M${x} ${y + height * 0.15} L${x + width * 0.58} ${y + height * 0.5} L${x} ${y + height * 0.85}Z`}
        fill="#D64045"
      />
      <path
        d={`M${x} ${y + height * 0.27} L${x + width * 0.38} ${y + height * 0.5} L${x} ${y + height * 0.73}Z`}
        fill="#F2C94C"
      />
      <path
        d={`M${x} ${y + height * 0.39} L${x + width * 0.19} ${y + height * 0.5} L${x} ${y + height * 0.61}Z`}
        fill="#111111"
      />
    </>
  );
}

function AmericanPattern({ x, y, width, height }: PatternGeometry) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#174A8B" />
      <path
        d={`M${x - width * 0.1} ${y + height * 0.84} L${x + width * 0.72} ${y} H${x + width} L${x + width * 0.18} ${y + height}Z`}
        fill="#FFFFFF"
      />
      <path
        d={`M${x} ${y + height} L${x + width} ${y} L${x + width} ${y + height * 0.18} L${x + width * 0.18} ${y + height}Z`}
        fill="#D64045"
      />
      <circle
        cx={x + width * 0.18}
        cy={y + height * 0.24}
        r={Math.min(width, height) * 0.07}
        fill="#F2C94C"
      />
    </>
  );
}

function AsianPattern({ x, y, width, height }: PatternGeometry) {
  const centerX = x + width * 0.24;
  const centerY = y + height * 0.32;
  return (
    <>
      <path
        d={`M${x} ${y + height * 0.72} Q${x + width * 0.46} ${y + height * 0.42} ${x + width} ${y + height * 0.66} V${y + height} H${x}Z`}
        fill="#C62828"
      />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        const inner = Math.min(width, height) * 0.11;
        const outer = Math.min(width, height) * 0.23;
        return (
          <path
            key={index}
            d={`M${centerX + Math.cos(angle - 0.13) * inner} ${centerY + Math.sin(angle - 0.13) * inner} L${centerX + Math.cos(angle) * outer} ${centerY + Math.sin(angle) * outer} L${centerX + Math.cos(angle + 0.13) * inner} ${centerY + Math.sin(angle + 0.13) * inner}Z`}
            fill="#F2C94C"
          />
        );
      })}
      <circle
        cx={centerX}
        cy={centerY}
        r={Math.min(width, height) * 0.1}
        fill="#F2C94C"
      />
    </>
  );
}

function OceaniaPattern({ x, y, width, height }: PatternGeometry) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#0B3158" />
      <path
        d={`M${x} ${y + height * 0.46} Q${x + width * 0.22} ${y + height * 0.16} ${x + width * 0.45} ${y + height * 0.48} T${x + width} ${y + height * 0.43} V${y + height * 0.72} Q${x + width * 0.76} ${y + height} ${x + width * 0.48} ${y + height * 0.68} T${x} ${y + height * 0.74}Z`}
        fill="#32C6C8"
      />
      <path
        d={`M${x} ${y + height * 0.55} Q${x + width * 0.22} ${y + height * 0.3} ${x + width * 0.45} ${y + height * 0.57} T${x + width} ${y + height * 0.52}`}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={Math.max(1, Math.min(width, height) * 0.055)}
      />
    </>
  );
}

type PatternGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};
