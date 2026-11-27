import Image from "next/image";
import { useId } from "react";
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
  if (sponsor.logoPath && sponsor.logoBackgroundColor && colorMode !== "original") {
    return <OpaqueLibraryLogo sponsor={sponsor} className={className} colorMode={colorMode} />;
  }
  if (sponsor.logoPath) {
    return <Image src={sponsor.logoPath} alt={`Logo de ${sponsor.name}`} width={240} height={86}
      className={`${className} object-contain`} unoptimized data-secondary-logo-color={colorMode}
      style={colorMode === "original" ? undefined : { filter: colorMode === "black" ? "brightness(0)" : "brightness(0) invert(1)" }} />;
  }
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

function OpaqueLibraryLogo({ sponsor, className, colorMode }: {
  sponsor: SecondarySponsorIdentity;
  className: string;
  colorMode: "black" | "white";
}) {
  const uniqueId = useId();
  const background = sponsor.logoBackgroundColor!.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(background.slice(offset, offset + 2), 16) / 255);
  const filterId = `secondary-logo-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <svg role="img" aria-label={`Logo de ${sponsor.name}`} viewBox="0 0 240 86"
      className={className} preserveAspectRatio="xMidYMid meet" data-secondary-logo-color={colorMode}
      data-secondary-logo-background={sponsor.logoBackgroundColor}>
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          {/* Distance from the known card background supplies transparency without altering the asset. */}
          <feColorMatrix in="SourceGraphic" type="matrix" result="lighter"
            values={`1 0 0 0 ${-red} 0 1 0 0 ${-green} 0 0 1 0 ${-blue} 0 0 0 1 0`} />
          <feColorMatrix in="SourceGraphic" type="matrix" result="darker"
            values={`-1 0 0 0 ${red} 0 -1 0 0 ${green} 0 0 -1 0 ${blue} 0 0 0 1 0`} />
          <feComposite in="lighter" in2="darker" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="distance" />
          <feColorMatrix in="distance" type="matrix" result="backgroundMask"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4 4 4 0 -0.1" />
          <feComposite in="backgroundMask" in2="SourceAlpha" operator="in" result="logoMask" />
          <feFlood floodColor={colorMode === "black" ? "#111111" : "#FFFFFF"} result="ink" />
          <feComposite in="ink" in2="logoMask" operator="in" />
        </filter>
      </defs>
      <image href={sponsor.logoPath} width="240" height="86" preserveAspectRatio="xMidYMid meet" filter={`url(#${filterId})`} />
    </svg>
  );
}
