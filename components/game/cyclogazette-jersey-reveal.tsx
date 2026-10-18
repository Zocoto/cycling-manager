import { RiderAvatar } from "@/components/game/rider-avatar";
import { NationalFederationJersey } from "@/components/game/national-federation-jersey";
import type { CyclogazetteJerseyReveal as JerseyReveal } from "@/lib/game/cyclogazette-jerseys";
import { getNationalJerseyPalette } from "@/lib/game/national-jersey-preview";

export function CyclogazetteJerseyReveal({ reveal, isEnglish }: { reveal: JerseyReveal; isEnglish: boolean }) {
  const { rider } = reveal;
  const champion = reveal.kind === "national_champion";
  const role = champion
    ? rider?.championshipType === "time_trial"
      ? isEnglish ? "National time trial champion" : "Champion national du contre-la-montre"
      : isEnglish ? "National road champion" : "Champion national sur route"
    : isEnglish ? "National rider" : "Coureur de la nation";

  return (
    <figure data-gazette-jersey-reveal={reveal.kind} className="mx-auto mt-5 w-full max-w-64 border border-[var(--gazette-rule)]/30 bg-[var(--gazette-aside)] px-4 pb-4 pt-3 text-center">
      <p className="mb-3 text-[9px] font-black uppercase tracking-[.2em] text-[var(--gazette-accent)]">
        {isEnglish ? "The new kit" : "La nouvelle tunique"}
      </p>
      {rider ? (
        <RiderAvatar
          riderId={rider.id} profileKey={rider.avatarProfileKey} seed={rider.avatarSeed}
          presentation="jersey"
          jersey={{ ...getNationalJerseyPalette(reveal.design), pattern: "solid", status: champion ? "national-champion" : "national-team", countryCode: reveal.countryCode, nationalDesign: reveal.design }}
          label={isEnglish ? `${rider.name} wearing the new jersey` : `${rider.name} porte le nouveau maillot`}
          className="h-auto w-full max-w-48 aspect-[96/178]"
        />
      ) : (
        <NationalFederationJersey countryCode={reveal.countryCode} countryName={reveal.countryName} kind={reveal.kind} design={reveal.design} className="mx-auto h-auto w-full max-w-48 aspect-[120/132]" />
      )}
      <figcaption className="mt-3 border-t border-[var(--gazette-rule)]/30 pt-3">
        {rider ? <><span className="block font-serif text-lg font-black leading-tight">{rider.name}</span><span className="mt-1 block text-[10px] font-bold text-[var(--gazette-muted)]">{role}</span></> : null}
        <span className="mt-1 block text-[10px] font-black uppercase tracking-wider">{reveal.countryName}</span>
      </figcaption>
    </figure>
  );
}
