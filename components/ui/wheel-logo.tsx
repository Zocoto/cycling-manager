import Image from "next/image";

const LOGO_SRC = "/logo-cyclo-stratege.png";
const LOGO_MASK_SRC = "/logo-cyclo-stratege-mask.png";

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
      <span className={`relative block shrink-0 ${className}`}>
      <Image
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        sizes="48px"
        className="block h-full w-full"
      />
      <ChristmasLogoAccent />
      </span>
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
          WebkitMaskImage: `url(${LOGO_MASK_SRC})`,
          maskImage: `url(${LOGO_MASK_SRC})`,
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
      <ChristmasLogoAccent />
    </span>
  );
}

function ChristmasLogoAccent() {
  return <svg data-christmas-logo-accent aria-hidden="true" viewBox="0 0 32 28"
    className="pointer-events-none absolute -right-1 -top-1 h-[46%] w-[46%]">
    <path d="m17 15-7-1 1-4-5-1 1-5 5 1 2-4 4 5 3-1 1 7Z" fill="#366E42" stroke="#EFF0CC" strokeWidth="1" />
    <path d="m18 16 5-8 3 3 4-1-1 5 2 4-5 2-1 4-6-3Z" fill="#285A37" stroke="#EFF0CC" strokeWidth="1" />
    <path d="m10 6 9 12 8-3" fill="none" stroke="#AAB779" strokeWidth="1" />
    <circle cx="16" cy="17" r="3.5" fill="#A83242" stroke="#F5D7B0" />
    <circle cx="21" cy="19" r="3" fill="#C64E57" stroke="#F5D7B0" />
    <circle cx="17" cy="23" r="3" fill="#8F2F40" stroke="#F5D7B0" />
  </svg>;
}
