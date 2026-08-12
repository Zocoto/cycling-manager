import { useId } from "react";

type WorldChampionJerseyProps = {
  championshipType: "road" | "time_trial";
  className?: string;
};

const RAINBOW_BANDS = [
  "#2166B1",
  "#E32636",
  "#111111",
  "#F2C94C",
  "#16834A",
] as const;

export function WorldChampionJersey({
  championshipType,
  className = "h-64 w-56 drop-shadow-xl",
}: WorldChampionJerseyProps) {
  const rawId = useId();
  const clipId = `world-champion-jersey-${rawId.replace(/:/g, "")}`;
  const jerseyPath =
    "M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z";

  return (
    <svg
      aria-label={`Maillot de champion du monde ${
        championshipType === "road"
          ? "sur route"
          : "du contre-la-montre"
      }`}
      role="img"
      viewBox="0 0 260 300"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={jerseyPath} />
        </clipPath>
      </defs>
      <path
        d={jerseyPath}
        fill="#FFFFFF"
        stroke="#071A17"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <g clipPath={`url(#${clipId})`}>
        {RAINBOW_BANDS.map((color, index) => (
          <rect
            key={color}
            x="0"
            y={104 + index * 17}
            width="260"
            height="17"
            fill={color}
          />
        ))}
        <path
          d="M22 100 55 58 88 42 107 62H72v43l-17 21Z"
          fill="#FFFFFF"
          opacity="0.2"
        />
        <path
          d="M238 100 205 58 172 42 153 62h35v43l17 21Z"
          fill="#071A17"
          opacity="0.08"
        />
      </g>
      <path
        d="M107 62 117 82H143L153 62"
        fill="none"
        stroke="#071A17"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M72 238H188M72 252H188"
        stroke="#071A17"
        strokeWidth="3"
        opacity="0.22"
      />
    </svg>
  );
}
