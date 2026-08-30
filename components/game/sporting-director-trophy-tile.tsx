import { CareerTrophyMark } from "@/components/game/career-trophy-mark";
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
    <article
      data-public-trophy={trophy.kind}
      className="flex min-w-0 items-center gap-4 rounded-2xl border border-[#315B3E]/10 bg-white/85 p-4"
    >
      <span
        className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#071A17,#123B34)] shadow-sm"
        style={{ boxShadow: `0 8px 22px ${trophy.palette.glow}` }}
      >
        <CareerTrophyMark
          trophy={trophy}
          className="h-[4.5rem] w-[4.5rem]"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black leading-tight text-[#183F37]">
          {trophy.title}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-4 text-[#60756E]">
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
