import type { SecondarySponsorIdentity, SecondarySponsorLogoPlacement } from "@/lib/game/secondary-sponsor";

export function SecondarySponsorLogo({
  sponsor,
  className = "h-auto w-full",
  colorMode = "original",
}: {
  sponsor: SecondarySponsorIdentity;
  className?: string;
  colorMode?: SecondarySponsorLogoPlacement["colorMode"];
}) {
  const primaryColor = colorMode === "black" ? "#111111" : colorMode === "white" ? "#FFFFFF" : sponsor.primaryColor;
  const accentColor = colorMode === "black" ? "#FFFFFF" : colorMode === "white" ? "#111111" : sponsor.accentColor;
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
      data-secondary-logo-color={colorMode}
    >
      {sponsor.logoVariant === "badge" ? (
        <>
          <path
            d="M14 10h60v42c0 16-13 24-30 30C27 76 14 68 14 52Z"
            fill={primaryColor}
          />
          <path
            d="M25 25h38M25 39h38M31 53h26"
            stroke={accentColor}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </>
      ) : null}

      {sponsor.logoVariant === "monogram" ? (
        <>
          <circle cx="44" cy="43" r="32" fill={primaryColor} />
          <text
            x="44"
            y="53"
            textAnchor="middle"
            fill={accentColor}
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
            stroke={primaryColor}
            strokeWidth="8"
            transform="rotate(-24 44 43)"
          />
          <circle cx="44" cy="43" r="10" fill={accentColor} />
        </>
      ) : null}

      {sponsor.logoVariant === "stripe" ? (
        <>
          <path d="M8 63 37 13h18L26 63Z" fill={primaryColor} />
          <path d="M35 63 64 13h14L49 63Z" fill={accentColor} />
        </>
      ) : null}

      {sponsor.logoVariant === "wordmark" ? (
        <>
          <path
            d="M12 22h58L58 64H0Z"
            fill={primaryColor}
          />
          <path d="M25 31h30L47 55H17Z" fill={accentColor} />
        </>
      ) : null}

      <text
        x="84"
        y="52"
        fill={primaryColor}
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
