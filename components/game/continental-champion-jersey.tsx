import { useId } from "react";

import {
  CONTINENTAL_CHAMPION_PALETTES,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";
import { ContinentalChampionPattern } from "./continental-champion-pattern";

type ContinentalChampionJerseyProps = {
  continentCode: ContinentalChampionshipCode;
  championshipType: "road" | "time_trial";
  className?: string;
};

export function ContinentalChampionJersey({
  continentCode,
  championshipType,
  className = "h-64 w-56 drop-shadow-xl",
}: ContinentalChampionJerseyProps) {
  const rawId = useId();
  const clipId = `continental-champion-jersey-${rawId.replace(/:/g, "")}`;
  const jerseyPath =
    "M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z";
  const continentName = CONTINENTAL_CHAMPION_PALETTES[continentCode].name;

  return (
    <svg
      aria-label={`Maillot de champion continental ${championshipType === "road" ? "sur route" : "du contre-la-montre"} · ${continentName}`}
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
      <ContinentalChampionPattern
        continentCode={continentCode}
        width={260}
        height={300}
        clipPathId={clipId}
      />
      <path
        d="M22 100 55 58 88 42 107 62H72v43l-17 21Z"
        fill="#FFFFFF"
        opacity="0.12"
        clipPath={`url(#${clipId})`}
      />
      <path
        d="M107 62 117 82H143L153 62"
        fill="none"
        stroke="#071A17"
        strokeWidth="4"
        strokeLinejoin="round"
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
