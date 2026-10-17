import { useId } from "react";
import { NATIONAL_JERSEY_SHIRT_PATH, NationalJerseyDesignArtwork } from "./national-jersey-design-artwork";
import { SvgCountryFlag } from "./svg-country-flag";
import { NATIONAL_JERSEY_KIND_LABELS, type NationalJerseyDraft, type NationalJerseyKind } from "@/lib/game/national-jersey-preview";

export function NationalFederationJersey({ countryCode, countryName, kind = "national_team", design, className = "h-28 w-24" }: {
  countryCode: string; countryName: string; kind?: NationalJerseyKind; design?: NationalJerseyDraft | null; className?: string;
}) {
  const id = `federation-kit-${useId().replace(/:/g, "")}`;
  return <svg role="img" aria-label={`Maillot · ${NATIONAL_JERSEY_KIND_LABELS[kind]} · ${countryName}`} viewBox="0 0 120 132" className={className}
    data-federation-jersey-kind={kind} data-country-code={countryCode.toUpperCase()}>
    <defs><clipPath id={id}><path d={NATIONAL_JERSEY_SHIRT_PATH} /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      {design ? <NationalJerseyDesignArtwork countryCode={countryCode} design={design} idPrefix={id} /> : <SvgCountryFlag countryCode={countryCode} x={0} y={0} width={120} height={132} />}
      <path d="M5 48 19 18 39 9 32 44v78H44V28Z" fill="#FFFFFF" opacity="0.08" />
      <path d="M115 48 101 18 81 9 88 44v78H76V28Z" fill="#071A17" opacity="0.08" />
    </g>
    <path d={NATIONAL_JERSEY_SHIRT_PATH} fill="none" stroke="#213B36" strokeWidth="2" strokeLinejoin="round" />
    <path d="M39 9c4 7 10 10 21 10S77 16 81 9" fill="none" stroke="#213B36" strokeWidth="2" />
  </svg>;
}
