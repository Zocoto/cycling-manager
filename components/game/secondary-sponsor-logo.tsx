import type { SecondarySponsorIdentity } from "@/lib/game/secondary-sponsor";

export function SecondarySponsorLogo({
  sponsor,
  className = "h-auto w-full",
}: {
  sponsor: SecondarySponsorIdentity;
  className?: string;
}) {
  const initials = sponsor.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <svg
      role="img"
      aria-label={`Logo de ${sponsor.name}`}
      viewBox="0 0 240 86"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      {sponsor.logoVariant === "badge" ? (
        <>
          <path
            d="M14 10h60v42c0 16-13 24-30 30C27 76 14 68 14 52Z"
            fill={sponsor.primaryColor}
          />
          <path
            d="M25 25h38M25 39h38M31 53h26"
            stroke={sponsor.accentColor}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      ) : null}

      {sponsor.logoVariant === "monogram" ? (
        <>
          <circle cx="44" cy="43" r="32" fill={sponsor.primaryColor} />
          <text
            x="44"
            y="53"
            textAnchor="middle"
            fill={sponsor.accentColor}
            fontSize="27"
            fontWeight="900"
          >
            {initials}
          </text>
        </>
      ) : null}

      {sponsor.logoVariant === "orbit" ? (
        <>
          <ellipse
            cx="44"
            cy="43"
            rx="33"
            ry="19"
            fill="none"
            stroke={sponsor.primaryColor}
            strokeWidth="8"
            transform="rotate(-24 44 43)"
          />
          <circle cx="44" cy="43" r="10" fill={sponsor.accentColor} />
        </>
      ) : null}

      {sponsor.logoVariant === "stripe" ? (
        <>
          <path d="M8 63 37 13h18L26 63Z" fill={sponsor.primaryColor} />
          <path d="M35 63 64 13h14L49 63Z" fill={sponsor.accentColor} />
        </>
      ) : null}

      {sponsor.logoVariant === "wordmark" ? (
        <>
          <path
            d="M12 22h58L58 64H0Z"
            fill={sponsor.primaryColor}
          />
          <path d="M25 31h30L47 55H17Z" fill={sponsor.accentColor} />
        </>
      ) : null}

      <text
        x="84"
        y="52"
        fill={sponsor.primaryColor}
        fontSize="28"
        fontWeight="900"
        letterSpacing="-0.8"
        textLength="145"
        lengthAdjust="spacingAndGlyphs"
      >
        {sponsor.name.toUpperCase()}
      </text>
    </svg>
  );
}
