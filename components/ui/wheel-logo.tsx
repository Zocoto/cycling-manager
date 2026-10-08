import Image from "next/image";

const LOGO_SRC = "/logo-cyclo-stratege.png";

export type WheelLogoColors = {
  primary: string;
  secondary: string;
  accent: string;
};

type WheelLogoProps = {
  className?: string;
  /**
   * Couleurs du sponsor. Quand elles sont fournies, le logo est teinté
   * avec le même dégradé que le liseré au-dessus de la bannière.
   * À chaque changement de sponsor, le logo reprend ses couleurs.
   */
  colors?: WheelLogoColors | null;
};

export function WheelLogo({
  className = "h-9 w-9",
  colors = null,
}: WheelLogoProps) {
  if (!colors) {
    return (
      <Image
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        sizes="48px"
        className={`block shrink-0 ${className}`}
      />
    );
  }

  return (
    <span className={`relative block shrink-0 isolate ${className}`}>
      <Image
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        sizes="48px"
        className="block h-full w-full"
      />

      <span
        aria-hidden="true"
        data-halloween-logo-tint="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.secondary})`,
          mixBlendMode: "color",
          WebkitMaskImage: `url(${LOGO_SRC})`,
          maskImage: `url(${LOGO_SRC})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
      <svg data-halloween-logo-web="true" aria-hidden="true" viewBox="0 0 60 60" fill="none">
        <g stroke="currentColor" strokeWidth="1.2" opacity=".7">
          <path d="M3 3h54M3 3v54M3 3l45 45M3 3l51 21M3 3l21 51" />
          <path d="M3 15q4-2 8-1t5-11M3 27q8-5 17-4t8-20M3 40q14-7 24-6t13-31M3 53q16-8 31-8t18-42" />
        </g>
      </svg>
    </span>
  );
}
