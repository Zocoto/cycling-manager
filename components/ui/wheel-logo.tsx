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
        priority
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
        priority
        className="block h-full w-full"
      />

      <span
        aria-hidden="true"
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
    </span>
  );
}
