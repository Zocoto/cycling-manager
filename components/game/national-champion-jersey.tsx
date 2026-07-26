import { useId } from "react";

import { getNationalChampionPalette } from "@/lib/rider-jersey";

type NationalChampionJerseyProps = {
  countryCode: string;
  countryName: string;
  championshipType: "road" | "time_trial";
  className?: string;
};

export function NationalChampionJersey({
  countryCode,
  countryName,
  championshipType,
  className = "h-64 w-56 drop-shadow-xl",
}: NationalChampionJerseyProps) {
  const rawId = useId();
  const svgId = rawId.replace(/:/g, "");
  const jerseyClipId = `national-champion-jersey-${svgId}`;
  const normalizedCountryCode = countryCode.trim().toLowerCase();
  const palette = getNationalChampionPalette(countryCode);
  const jerseyPath =
    "M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z";

  return (
    <svg
      aria-label={`Maillot de champion national ${championshipType === "road" ? "sur route" : "du contre-la-montre"} de ${countryName}`}
      role="img"
      viewBox="0 0 260 300"
      className={className}
    >
      <defs>
        <clipPath id={jerseyClipId}>
          <path d={jerseyPath} />
        </clipPath>
      </defs>

      <path
        d={jerseyPath}
        fill={palette.primary}
        stroke="#071A17"
        strokeWidth="5"
        strokeLinejoin="round"
      />

      <g clipPath={`url(#${jerseyClipId})`}>
        <foreignObject x="0" y="0" width="260" height="300">
          <span
            aria-hidden="true"
            className={`fi fi-${normalizedCountryCode}`}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 100%",
            }}
          />
        </foreignObject>
        <path
          d="M22 100 55 58 88 42 107 62H72v43l-17 21Z"
          fill="#FFFFFF"
          opacity="0.08"
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
        opacity="0.32"
      />
      {championshipType === "time_trial" ? (
        <path
          d="M78 226H182"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeDasharray="10 7"
          opacity="0.82"
        />
      ) : null}
    </svg>
  );
}
