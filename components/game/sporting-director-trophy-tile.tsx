import { AlphaTesterTrophyMark } from "@/components/game/alpha-tester-trophy-mark";
import { MedicalTrophyMark } from "@/components/game/medical-trophy-mark";
import { SponsorAmbassadorTrophyMark } from "@/components/game/sponsor-ambassador-trophy-mark";
import type { CareerTrophy, TrophyGallery } from "@/lib/game/trophy-gallery";

export function SportingDirectorTrophyTile({
  gallery,
}: {
  gallery: TrophyGallery;
}) {
  const visibleTrophies = gallery.trophies.slice(0, 4);
  const hiddenTrophies = gallery.trophies.slice(4);

  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-[linear-gradient(135deg,#F8FBF9,#F2F0FB)] p-5 shadow-[0_8px_24px_rgba(19,60,46,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Galerie personnelle
          </p>
          <h2 className="mt-1 text-xl font-black text-[#183F37]">
            Trophées du DS
          </h2>
        </div>
        <span className="rounded-full border border-[#5CC8B2]/30 bg-white px-3 py-1 text-sm font-black text-[#5B4BA5]">
          {gallery.counts.total}
        </span>
      </div>

      {visibleTrophies.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visibleTrophies.map((trophy) => (
            <PublicTrophy key={trophy.id} trophy={trophy} />
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[#315B3E]/20 bg-white/70 px-4 py-5 text-sm font-semibold text-[#60756E]">
          Aucun trophée exposé pour le moment.
        </div>
      )}

      {hiddenTrophies.length > 0 ? (
        <details className="group mt-4 rounded-xl border border-[#315B3E]/10 bg-white/55">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-xs font-black text-[#176951] marker:hidden">
            <span>
              Voir les {hiddenTrophies.length} autre
              {hiddenTrophies.length > 1 ? "s" : ""} distinction
              {hiddenTrophies.length > 1 ? "s" : ""}
            </span>
            <span
              aria-hidden="true"
              className="text-base transition group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <div className="grid gap-3 border-t border-[#315B3E]/10 p-3 sm:grid-cols-2">
            {hiddenTrophies.map((trophy) => (
              <PublicTrophy key={trophy.id} trophy={trophy} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function PublicTrophy({ trophy }: { trophy: CareerTrophy }) {
  return (
    <article className="flex min-w-0 items-start gap-3 rounded-xl border border-[#315B3E]/10 bg-white/85 p-3">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B302B] text-[#F2C94C] shadow-sm"
        style={{ boxShadow: `0 6px 16px ${trophy.palette.glow}` }}
      >
        {trophy.kind === "special" ? (
          <AlphaTesterTrophyMark className="h-10 w-10" />
        ) : trophy.kind === "medical" && trophy.medicalVariant ? (
          <MedicalTrophyMark
            variant={trophy.medicalVariant}
            palette={trophy.palette}
            className="h-11 w-11"
          />
        ) : trophy.kind === "sponsor" ? (
          <SponsorAmbassadorTrophyMark className="h-11 w-11" />
        ) : (
          <TrophyIcon />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-[#183F37]">
          {trophy.title}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[#60756E]">
          {trophy.competitionName}
        </span>
        {trophy.seasonNames?.length ? (
          <span className="mt-2 flex flex-wrap gap-1" aria-label="Saisons obtenues">
            {trophy.seasonNames.map((seasonName) => (
              <span
                key={seasonName}
                className="rounded-full bg-[#E7F1EC] px-2 py-0.5 text-[10px] font-black text-[#176951]"
              >
                {seasonName}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </article>
  );
}

function TrophyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11" />
      <path d="M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5" />
      <path d="M12 13v4" />
      <path d="M8.5 20h7" />
      <path d="M10 17h4" />
    </svg>
  );
}
