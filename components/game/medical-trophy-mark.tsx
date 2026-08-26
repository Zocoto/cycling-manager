import type { MedicalTrophyVisualVariant } from "@/lib/game/medical-trophies";
import type { TrophyPalette } from "@/lib/game/trophy-gallery";

export function MedicalTrophyMark({
  variant,
  palette,
  className,
}: {
  variant: MedicalTrophyVisualVariant;
  palette: TrophyPalette;
  className?: string;
}) {
  const gradientId = `medical-trophy-${variant}`;
  const glowId = `medical-glow-${variant}`;

  return (
    <svg
      aria-hidden="true"
      data-medical-trophy={variant}
      viewBox="0 0 180 190"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="52" y1="28" x2="130" y2="166">
          <stop stopColor={palette.secondary} />
          <stop offset="0.48" stopColor={palette.primary} />
          <stop offset="1" stopColor={palette.accent} />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <ellipse
        cx="90"
        cy="165"
        rx="57"
        ry="13"
        fill={palette.primary}
        opacity="0.32"
        filter={`url(#${glowId})`}
      />
      <path
        d="M46 43h88l-8 48c-4 23-18 36-36 36S58 114 54 91l-8-48Z"
        fill={`url(#${gradientId})`}
        stroke={palette.secondary}
        strokeWidth="3"
      />
      <path
        d="M48 47H37c-17 0-16 30 6 33h10M132 47h11c17 0 16 30-6 33h-10"
        stroke={palette.primary}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d="M84 125h12v25H84z" fill={palette.primary} />
      <path
        d="M66 148h48l10 16H56l10-16Z"
        fill={`url(#${gradientId})`}
        stroke={palette.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="51"
        y="163"
        width="78"
        height="14"
        rx="5"
        fill={palette.accent}
        stroke={palette.primary}
        strokeWidth="3"
      />

      {variant === "nurse" ? (
        <g data-medical-emblem="nurse-cap">
          <path
            d="M63 61c4-17 50-17 54 0l-7 24H70l-7-24Z"
            fill="#FFF7EB"
            stroke="#E1535B"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M83 56h14v25H83z" fill="#E1535B" />
          <path d="M77 62h26v13H77z" fill="#E1535B" />
          <path
            d="M68 88c13 6 31 6 44 0"
            stroke="#176B62"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g data-medical-emblem="stethoscope">
          <path
            d="M73 58v14c0 13 8 21 17 21s17-8 17-21V58"
            stroke="#F7FFFF"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="73" cy="57" r="4.5" fill="#B62F46" stroke="#F7FFFF" strokeWidth="2" />
          <circle cx="107" cy="57" r="4.5" fill="#B62F46" stroke="#F7FFFF" strokeWidth="2" />
          <path
            d="M90 93v8c0 10 7 15 15 15"
            stroke="#173F37"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="109" cy="116" r="7" fill="#B62F46" stroke="#F7FFFF" strokeWidth="3" />
          <path d="M84 70h12M90 64v12" stroke="#B62F46" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
