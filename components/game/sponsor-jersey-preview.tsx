import type { Sponsor } from "@/types/sponsor";

type SponsorJersey =
  Sponsor["jerseys"][number];

type SponsorJerseyPreviewProps = {
  sponsor: Sponsor;
  jersey: SponsorJersey;
  className?: string;
};

export function SponsorJerseyPreview({
  sponsor,
  jersey,
  className = "h-64 w-56 drop-shadow-xl",
}: SponsorJerseyPreviewProps) {
  const clipPathId =
    `jersey-body-${jersey.id}`;

  return (
    <svg
      aria-label={`Maillot ${jersey.name} de ${sponsor.name}`}
      role="img"
      viewBox="0 0 260 300"
      className={className}
    >
      <defs>
        <clipPath id={clipPathId}>
          <path d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z" />
        </clipPath>
      </defs>

      <path
        d="M88 42 55 58 22 100 55 126 72 105 72 267 188 267 188 105 205 126 238 100 205 58 172 42 153 62 107 62Z"
        fill={sponsor.colors.primary}
        stroke={sponsor.colors.text}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      <path
        d="M107 62 117 82H143L153 62"
        fill={sponsor.colors.secondary}
        stroke={sponsor.colors.text}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {jersey.style === "classic" ? (
        <g clipPath={`url(#${clipPathId})`}>
          <rect
            x="0"
            y="112"
            width="260"
            height="62"
            fill={sponsor.colors.secondary}
          />

          <rect
            x="0"
            y="132"
            width="260"
            height="22"
            fill={sponsor.colors.accent}
          />
        </g>
      ) : null}

      {jersey.style === "modern" ? (
        <g clipPath={`url(#${clipPathId})`}>
          <path
            d="M-20 250 220 18 282 72 42 310Z"
            fill={sponsor.colors.secondary}
          />

          <path
            d="M-4 270 236 38 258 58 18 290Z"
            fill={sponsor.colors.accent}
          />
        </g>
      ) : null}

      {jersey.style === "bold" ? (
        <g clipPath={`url(#${clipPathId})`}>
          <path
            d="M130 0H280V320H130Z"
            fill={sponsor.colors.accent}
          />

          <path
            d="M115 0H145V320H115Z"
            fill={sponsor.colors.secondary}
          />

          <circle
            cx="130"
            cy="164"
            r="68"
            fill="none"
            stroke={sponsor.colors.secondary}
            strokeWidth="14"
            opacity="0.65"
          />
        </g>
      ) : null}

      <text
        x="130"
        y="198"
        textAnchor="middle"
        fill={sponsor.colors.text}
        fontSize="17"
        fontWeight="900"
      >
        {sponsor.shortName.toUpperCase()}
      </text>

      <path
        d="M72 238H188"
        stroke={sponsor.colors.text}
        strokeWidth="4"
        opacity="0.45"
      />

      <path
        d="M72 252H188"
        stroke={sponsor.colors.text}
        strokeWidth="4"
        opacity="0.45"
      />
    </svg>
  );
}