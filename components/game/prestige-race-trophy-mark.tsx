import type { RacePrestigeTrophyVisualVariant } from "@/lib/game/race-prestige";
import type { TrophyPalette } from "@/lib/game/trophy-gallery";

type PrestigeRaceTrophyMarkProps = {
  trophyId: string;
  variant: RacePrestigeTrophyVisualVariant;
  palette: TrophyPalette;
  className?: string;
};

export function PrestigeRaceTrophyMark({
  trophyId,
  variant,
  palette,
  className = "h-36 w-36",
}: PrestigeRaceTrophyMarkProps) {
  const safeId = trophyId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const metalId = `prestige-metal-${safeId}`;

  return (
    <svg
      aria-hidden="true"
      data-prestige-race-trophy={variant}
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={metalId} x1="52" y1="28" x2="128" y2="163">
          <stop stopColor={palette.secondary} />
          <stop offset="0.5" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.accent} />
        </linearGradient>
      </defs>

      <ellipse
        cx="90"
        cy="168"
        rx="55"
        ry="11"
        fill={palette.primary}
        opacity="0.22"
      />
      <PrestigeRaceSymbol
        variant={variant}
        palette={palette}
        metalFill={`url(#${metalId})`}
      />
      <path
        d="M84 127h12v24H84z"
        fill={palette.accent}
        stroke={palette.secondary}
        strokeWidth="2"
      />
      <path
        d="M63 150h54l10 16H53l10-16Z"
        fill={`url(#${metalId})`}
        stroke={palette.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="47"
        y="165"
        width="86"
        height="14"
        rx="5"
        fill="#102D28"
        stroke={palette.primary}
        strokeWidth="3"
      />
    </svg>
  );
}

function PrestigeRaceSymbol({
  variant,
  palette,
  metalFill,
}: {
  variant: RacePrestigeTrophyVisualVariant;
  palette: TrophyPalette;
  metalFill: string;
}) {
  if (variant === "regional_rose") {
    return (
      <g>
        <path
          d="M48 39h84l-8 47c-4 25-17 40-34 40S60 111 56 86l-8-47Z"
          fill={metalFill}
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <path
          d="M50 43H38c-17 0-16 29 7 33h9M130 43h12c17 0 16 29-7 33h-9"
          stroke={palette.primary}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M90 91c-20-8-24-25-12-34 7 1 11 5 12 12 1-7 5-11 12-12 12 9 8 26-12 34Z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M90 92c-7-17-4-31 0-38 4 7 7 21 0 38ZM90 91c-13-7-20-16-21-26 12 1 20 8 21 26Zm0 0c13-7 20-16 21-26-12 1-20 8-21 26Z"
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (variant === "province_wheel") {
    return (
      <g>
        <circle
          cx="90"
          cy="78"
          r="45"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="4"
        />
        <circle
          cx="90"
          cy="78"
          r="34"
          fill={metalFill}
          stroke={palette.primary}
          strokeWidth="4"
        />
        <circle cx="90" cy="78" r="9" fill="#163F3B" stroke={palette.secondary} strokeWidth="3" />
        <path
          d="M90 44v25M90 87v25M56 78h25M99 78h25M66 54l17 17M97 85l17 17M114 54 97 71M83 85l-17 17"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M74 120h32l-6 9H80l-6-9Z" fill={palette.primary} />
      </g>
    );
  }

  if (variant === "sierra_peaks") {
    return (
      <g>
        <path
          d="M90 28 139 124H41L90 28Z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m52 111 24-42 14 22 15-36 25 56H52Z"
          fill={metalFill}
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m69 81 7-12 7 11M99 70l6-15 8 18"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54 116c22-15 36 9 62-10"
          stroke={palette.secondary}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (variant === "amber_cobble") {
    return (
      <g>
        <path
          d="m58 38 56-7 20 38-17 52-57 8-17-39 15-52Z"
          fill={metalFill}
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m58 38 24 24 32-31M43 90l39-28 35 59M82 62l34 16 18-9"
          stroke={palette.accent}
          strokeWidth="3"
          strokeLinejoin="round"
          opacity="0.8"
        />
        <circle cx="84" cy="91" r="19" fill="#163F3B" stroke={palette.secondary} strokeWidth="3" />
        <circle cx="84" cy="91" r="6" fill={palette.primary} />
        <path d="M84 72v13M84 97v13M65 91h13M90 91h13" stroke={palette.secondary} strokeWidth="3" />
        <path d="M53 114c18-9 33-9 48 0 10 6 19 6 27 1" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }

  if (variant === "zeeland_lion") {
    return (
      <g>
        <path
          d="M90 29 132 45v37c0 25-16 40-42 51-26-11-42-26-42-51V45l42-16Z"
          fill={metalFill}
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m90 48 11 9 14-2-3 14 8 11-9 9 2 14-14 1-9 11-10-11-14-1 2-14-9-9 8-11-3-14 14 2 11-9Z"
          fill="#163F3B"
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M77 75c0-10 6-17 13-17s13 7 13 17c0 13-6 22-13 22s-13-9-13-22Z"
          fill={palette.secondary}
          stroke={palette.primary}
          strokeWidth="3"
        />
        <path
          d="M83 73h1M96 73h1M86 84h8l-4 5-4-5Z"
          fill="#163F3B"
          stroke="#163F3B"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M76 106c9 6 19 6 28 0" stroke={palette.secondary} strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }

  if (variant === "flanders_bell") {
    return (
      <g>
        <path d="M80 32h20l7 13H73l7-13Z" fill={palette.accent} stroke={palette.secondary} strokeWidth="3" />
        <path
          d="M90 43c-23 0-36 16-36 42 0 17-5 25-12 32h96c-7-7-12-15-12-32 0-26-13-42-36-42Z"
          fill={metalFill}
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M48 117h84" stroke={palette.primary} strokeWidth="7" strokeLinecap="round" />
        <circle cx="90" cy="124" r="8" fill={palette.primary} stroke={palette.secondary} strokeWidth="3" />
        <path
          d="M71 77h38M66 92h48"
          stroke="#163F3B"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path d="M76 77v15M90 77v15M104 77v15" stroke={palette.secondary} strokeWidth="2.5" />
      </g>
    );
  }

  if (variant === "ardennes_crown") {
    return (
      <g>
        <path
          d="m39 57 24 21 16-39 11 36 11-36 16 39 24-21-10 62H49L39 57Z"
          fill={metalFill}
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M48 102h84l-4 20H52l-4-20Z" fill="#163F3B" stroke={palette.primary} strokeWidth="4" />
        <circle cx="63" cy="89" r="6" fill={palette.accent} stroke={palette.secondary} strokeWidth="2" />
        <circle cx="90" cy="89" r="8" fill={palette.secondary} stroke={palette.primary} strokeWidth="2" />
        <circle cx="117" cy="89" r="6" fill={palette.accent} stroke={palette.secondary} strokeWidth="2" />
        <path
          d="M58 112c11-12 21-12 32 0 11-12 21-12 32 0"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    );
  }

  return (
    <g>
      <path
        d="M47 48h86l-8 42c-4 22-18 35-35 35S59 112 55 90l-8-42Z"
        fill={metalFill}
        stroke={palette.secondary}
        strokeWidth="3"
      />
      <path
        d="M49 52H38c-17 0-15 29 7 32h9M131 52h11c17 0 15 29-7 32h-9"
        stroke={palette.primary}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M58 73h64" stroke="#163F3B" strokeWidth="20" strokeLinecap="round" opacity="0.88" />
      <path
        d="M56 70c11-8 22-8 33 0s22 8 34 0M56 84c11-8 22-8 33 0s22 8 34 0"
        stroke={palette.secondary}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="90" cy="102" r="10" fill={palette.accent} stroke={palette.secondary} strokeWidth="3" />
    </g>
  );
}
