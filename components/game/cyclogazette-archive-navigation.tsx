import Link from "@/components/ui/app-link";

import type { CyclogazetteArchiveSeason } from "@/lib/game/cyclogazette";

export function CyclogazetteArchiveNavigation({
  seasons,
  currentEditionId,
  latestEditionId,
}: {
  seasons: CyclogazetteArchiveSeason[];
  currentEditionId: string;
  latestEditionId: string;
}) {
  if (seasons.length === 0) return null;

  return (
    <nav
      aria-label="Archives de La Cyclogazette"
      className="mx-auto mb-5 max-w-[1380px] border border-[#8B7956]/40 bg-[#EEE2C5] px-4 py-4 text-[#241F18] shadow-[0_12px_35px_rgba(45,34,20,0.12)] sm:px-6"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg,rgba(80,61,31,.024) 0,rgba(80,61,31,.024) 1px,transparent 1px,transparent 4px)",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#241F18]/40 pb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#A12742]">
            La collection
          </p>
          <h2 className="mt-1 font-serif text-2xl font-black">Archives de la Gazette</h2>
        </div>
        {currentEditionId !== latestEditionId ? (
          <Link
            href="/jeu/gazette"
            className="border border-[#241F18] px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] transition hover:bg-[#241F18] hover:text-[#F4EBD2]"
          >
            Revenir à la dernière Une
          </Link>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {seasons.map((season) => {
          const containsCurrent = season.editions.some(
            (edition) => edition.id === currentEditionId,
          );
          return (
            <details
              key={season.seasonId}
              open={containsCurrent}
              className="group border border-[#806C45]/35 bg-[#F6EDD7]/70"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] marker:hidden">
                <span>Saison {season.seasonName}</span>
                <span className="flex items-center gap-2 text-[9px] text-[#7A6B4B]">
                  {season.editions.length} numéro{season.editions.length > 1 ? "s" : ""}
                  <span aria-hidden="true" className="text-base transition group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <div className="grid max-h-64 gap-px overflow-y-auto border-t border-[#806C45]/35 bg-[#806C45]/20 sm:grid-cols-2">
                {season.editions.map((edition) => {
                  const isCurrent = edition.id === currentEditionId;
                  const isLatest = edition.id === latestEditionId;
                  return (
                    <Link
                      key={edition.id}
                      href={`/jeu/gazette?edition=${edition.id}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`min-w-0 bg-[#F6EDD7] px-3 py-3 transition hover:bg-[#E4D4AE] ${
                        isCurrent ? "ring-2 ring-inset ring-[#A12742]" : ""
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.13em] text-[#A12742]">
                          Jour {edition.dayNumber} · N° {edition.issueNumber}
                        </span>
                        {isLatest ? (
                          <span className="bg-[#241F18] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#F4EBD2]">
                            Dernière
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate font-serif text-sm font-black">
                        {edition.subtitle}
                      </span>
                      <time
                        dateTime={edition.issueDate}
                        className="mt-1 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#7A6B4B]"
                      >
                        {formatArchiveDate(edition.issueDate)}
                      </time>
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </nav>
  );
}

function formatArchiveDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}
