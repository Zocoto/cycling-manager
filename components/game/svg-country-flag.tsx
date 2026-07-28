type SvgCountryFlagProps = {
  countryCode: string;
  x: number | string;
  y: number | string;
  width: number;
  height: number;
  clipPathId?: string;
  preserveAspectRatio?: "none" | "xMidYMid slice";
};

const ISO_COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;

export function SvgCountryFlag({
  countryCode,
  x,
  y,
  width,
  height,
  clipPathId,
  preserveAspectRatio = "none",
}: SvgCountryFlagProps) {
  const normalizedCountryCode = countryCode.trim().toLowerCase();

  if (!ISO_COUNTRY_CODE_PATTERN.test(normalizedCountryCode)) {
    return null;
  }

  return (
    <image
      aria-hidden="true"
      data-national-champion-flag={normalizedCountryCode}
      href={`/images/flags/4x3/${normalizedCountryCode}.svg`}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio}
      clipPath={clipPathId ? `url(#${clipPathId})` : undefined}
    />
  );
}