import type {
  RaceCourseJournalEntry,
  RaceCourseJournalEntryKind,
} from "@/lib/game/race-course-journal";

const KIND_STYLES: Record<
  RaceCourseJournalEntryKind,
  { dot: string; label: string }
> = {
  start: { dot: "bg-[#8CA69B]", label: "Départ" },
  breakaway: { dot: "bg-[#E1A82B]", label: "Échappée" },
  gap: { dot: "bg-[#D47E34]", label: "Écart" },
  junction: { dot: "bg-[#4B8EB5]", label: "Jonction" },
  attack: { dot: "bg-[#B84B52]", label: "Attaque" },
  incident: { dot: "bg-[#7D5BB1]", label: "Incident" },
  selection: { dot: "bg-[#278B70]", label: "Sélection" },
  finish: { dot: "bg-[#F2C94C]", label: "Arrivée" },
};

export function RaceCourseJournal({
  entries,
}: {
  entries: RaceCourseJournalEntry[];
}) {
  if (entries.length === 0) return null;

  return (
    <details
      data-race-course-journal
      className="group/journal border-b border-[#315B3E]/12 bg-[linear-gradient(135deg,#F3F8F5,#FFFDF5)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 transition hover:bg-white/55 sm:px-8 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0B302B] text-lg text-white shadow-sm"
          >
            ≡
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#278B70]">
              Le déroulé de l’épreuve
            </span>
            <span className="mt-0.5 block text-base font-black text-[#0B302B] sm:text-lg">
              Journal de course
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-[#688176]">
              Échappées, écarts, attaques et incidents marquants
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden rounded-full border border-[#315B3E]/12 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#48665F] sm:inline-flex">
            {entries.length} faits marquants
          </span>
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full border border-[#315B3E]/15 bg-white text-[#176951] transition group-open/journal:rotate-180"
          >
            ⌄
          </span>
        </span>
      </summary>

      <div className="border-t border-[#315B3E]/10 px-5 pb-6 pt-2 sm:px-8">
        <ol className="relative ml-2 border-l border-[#315B3E]/15 py-2">
          {entries.map((entry) => {
            const style = KIND_STYLES[entry.kind];
            return (
              <li
                key={entry.id}
                className="relative grid gap-1 py-2.5 pl-5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start sm:gap-3"
              >
                <span
                  aria-hidden="true"
                  className={`absolute -left-[5px] top-[1.15rem] h-2.5 w-2.5 rounded-full ring-4 ring-[#F7FAF5] ${style.dot}`}
                />
                <span className="inline-flex w-fit rounded-full bg-[#0B302B]/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#48665F]">
                  {entry.kind === "start"
                    ? "Départ"
                    : entry.kind === "finish"
                      ? "Arrivée"
                      : `Km ${formatDistance(entry.distanceKm)}`}
                </span>
                <p className="text-sm font-semibold leading-6 text-[#48665F]">
                  <span className="font-black text-[#0B302B]">
                    {entry.title}
                  </span>{" "}
                  <span className="sr-only">{style.label}. </span>
                  {entry.detail}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}

function formatDistance(distanceKm: number) {
  return distanceKm.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
  });
}
