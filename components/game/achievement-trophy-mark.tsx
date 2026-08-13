import type { AchievementTrophyVisualVariant } from "@/lib/game/achievement-trophies";
import type { TrophyPalette } from "@/lib/game/trophy-gallery";

type AchievementTrophyMarkProps = {
  variant: AchievementTrophyVisualVariant;
  palette: TrophyPalette;
  className?: string;
};

export function AchievementTrophyMark({
  variant,
  palette,
  className = "h-40 w-40",
}: AchievementTrophyMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 190"
      className={className}
      fill="none"
      data-achievement-trophy-mark={variant}
    >
      <ellipse
        cx="90"
        cy="168"
        rx="56"
        ry="11"
        fill={palette.primary}
        opacity="0.2"
      />
      <TrophySymbol variant={variant} palette={palette} />
      <path
        d="M84 132h12v20H84z"
        fill={palette.accent}
        stroke={palette.secondary}
        strokeWidth="2"
      />
      <path
        d="M63 151h54l10 15H53l10-15Z"
        fill={palette.accent}
        stroke={palette.primary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="47"
        y="166"
        width="86"
        height="13"
        rx="5"
        fill="#102D28"
        stroke={palette.secondary}
        strokeWidth="2"
      />
    </svg>
  );
}

function TrophySymbol({
  variant,
  palette,
}: {
  variant: AchievementTrophyVisualVariant;
  palette: TrophyPalette;
}) {
  if (variant === "astrolabe") {
    return (
      <g>
        <circle
          cx="90"
          cy="78"
          r="45"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <circle
          cx="90"
          cy="78"
          r="31"
          fill={palette.accent}
          stroke={palette.primary}
          strokeWidth="4"
        />
        <ellipse
          cx="90"
          cy="78"
          rx="14"
          ry="31"
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <path
          d="M60 78h60M67 61c14 8 32 8 46 0M67 95c14-8 32-8 46 0"
          stroke={palette.primary}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="90" cy="35" r="4" fill={palette.primary} />
        <circle cx="53" cy="63" r="4" fill={palette.secondary} />
        <circle cx="127" cy="63" r="4" fill={palette.secondary} />
        <circle cx="61" cy="108" r="4" fill={palette.primary} />
        <circle cx="119" cy="108" r="4" fill={palette.primary} />
      </g>
    );
  }

  if (variant === "panorama") {
    return (
      <g>
        <path
          d="M35 119h110v13H35z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <path
          d="M44 68h30v51H44zM106 78h30v41h-30z"
          fill={palette.accent}
          stroke={palette.primary}
          strokeWidth="3"
        />
        <path
          d="M74 48h32v71H74z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <path
          d="m42 68 17-14 17 14M72 48l18-15 18 15M104 78l17-14 17 14"
          stroke={palette.primary}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="90" cy="72" r="9" fill={palette.primary} />
        <path
          d="M52 91h14M52 104h14M114 96h14M83 96h14M83 109h14"
          stroke={palette.secondary}
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (variant === "apparatus") {
    return (
      <g>
        <path
          d="m90 34 39 22v45l-39 23-39-23V56l39-22Z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
        />
        <path
          d="m90 53 23 13v27l-23 13-23-13V66l23-13Z"
          fill={palette.accent}
          stroke={palette.primary}
          strokeWidth="4"
        />
        <circle cx="90" cy="80" r="10" fill={palette.secondary} />
        <path
          d="M90 70V53M99 85l14 8M81 85l-14 8"
          stroke={palette.primary}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="90" cy="49" r="6" fill={palette.primary} />
        <circle cx="118" cy="96" r="6" fill={palette.primary} />
        <circle cx="62" cy="96" r="6" fill={palette.primary} />
      </g>
    );
  }

  if (variant === "regalia") {
    return (
      <g>
        <path
          d="m34 62 22 20 17-37 17 34 17-34 17 37 22-20-9 61H43L34 62Z"
          fill="#163F3B"
          stroke={palette.secondary}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M44 105h92l-3 18H47l-3-18Z"
          fill={palette.accent}
          stroke={palette.primary}
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="56" cy="91" r="6" fill={palette.primary} />
        <circle cx="90" cy="91" r="8" fill={palette.secondary} />
        <circle cx="124" cy="91" r="6" fill={palette.primary} />
        <path
          d="M55 116h70"
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
        d="M90 31 137 123H43L90 31Z"
        fill="#163F3B"
        stroke={palette.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M71 108c27-2 34-12 15-19-19-7-15-18 15-23 14-2 18-8 15-17"
        stroke={palette.primary}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="71" cy="108" r="5" fill={palette.secondary} />
      <circle cx="116" cy="49" r="5" fill={palette.secondary} />
      <path
        d="M55 123h70"
        stroke={palette.accent}
        strokeWidth="5"
        strokeLinecap="round"
      />
    </g>
  );
}
