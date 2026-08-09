export function SponsorCountryBadge({
  countryCode,
  primaryColor = "#176951",
  className = "",
}: {
  countryCode: string;
  primaryColor?: string;
  className?: string;
}) {
  const normalizedCode = countryCode.trim().toLowerCase();
  const countryName = getSponsorCountryName(countryCode);
  const hasValidFlag = /^[a-z]{2}$/.test(normalizedCode);

  return (
    <span
      title={`Nationalité du sponsor : ${countryName}`}
      className={`inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full border bg-white/85 px-2.5 py-1 text-xs font-black ${className}`}
      style={{
        borderColor: `${primaryColor}35`,
        color: primaryColor,
      }}
    >
      {hasValidFlag ? (
        <span
          role="img"
          aria-label={`Drapeau : ${countryName}`}
          className={`fi fi-${normalizedCode} h-3.5 w-5 shrink-0 overflow-hidden rounded-sm shadow-sm`}
        />
      ) : (
        <span aria-hidden="true" className="text-base leading-none">
          ◇
        </span>
      )}
      <span>{countryName}</span>
    </span>
  );
}

export function getSponsorCountryName(countryCode: string): string {
  const normalizedCode = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return normalizedCode || "International";

  const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
  return countryNames.of(normalizedCode) ?? normalizedCode;
}
