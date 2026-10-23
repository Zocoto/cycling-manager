import Link from "@/components/ui/app-link";
import {
  RACE_DAY_SLOT_CONFIG,
  compareRaceDaySlots,
  isInternationalChampionshipEdition,
  type RaceCalendarEdition,
  type RaceCalendarStage,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";

type ChampionshipAccessGroup = {
  title: string;
  entries: { edition: RaceCalendarEdition; stage: RaceCalendarStage }[];
};

export function InternationalChampionshipResultsAccess({
  calendar,
  now,
}: {
  calendar: SeasonRaceCalendar;
  now: Date;
}) {
  const groups = new Map<string, ChampionshipAccessGroup>();
  const editionsBySlug = new Map(
    calendar.editions.map((edition) => [edition.slug, edition]),
  );

  for (const edition of calendar.editions) {
    if (
      !isInternationalChampionshipEdition(edition) ||
      edition.isJuniorChampionship === true ||
      edition.status === "cancelled"
    ) {
      continue;
    }

    const baseSlug = edition.slug.replace(/-contre-la-montre$/, "");
    const key = edition.competitionType === "world_championship"
      ? "world_championship"
      : baseSlug;
    const title = edition.competitionType === "world_championship"
      ? "Championnats du monde"
      : editionsBySlug.get(baseSlug)?.name ?? edition.name.replace(/\s+CLM$/i, "");

    for (const stage of edition.stages) {
      // Keep completed races visible until the end of their calendar day.
      if (
        stage.dayNumber !== calendar.currentDayNumber ||
        stage.status === "cancelled"
      ) {
        continue;
      }
      const group = groups.get(key) ?? { title, entries: [] };
      group.entries.push({ edition, stage });
      groups.set(key, group);
    }
  }

  if (groups.size === 0) return null;

  return (
    <section
      id="championnats-internationaux-resultats"
      aria-labelledby="championnats-internationaux-resultats-title"
      className="mb-6 scroll-mt-24 rounded-[2rem] border border-[#BE984B]/35 bg-[#FFFCF3] p-5 shadow-[0_12px_35px_rgba(19,60,46,0.07)] sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="championnats-internationaux-resultats-title" className="text-xl font-black tracking-tight text-[#0B302B]">
          Championnats internationaux · Aujourd’hui
        </h2>
        <span className="rounded-full bg-[#EAE0C4] px-3 py-1 text-xs font-extrabold text-[#614B1E]">
          Jour {calendar.currentDayNumber}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#48665F]">
        Accès direct aux courses et aux classements, toute la journée.
      </p>
      <div className="mt-4 grid gap-3 min-[360px]:grid-cols-2 xl:grid-cols-5">
        {[...groups].map(([key, group]) => (
          <div key={key} className="min-w-0 rounded-2xl border border-[#315B3E]/15 bg-white p-3">
            <h3 className="mb-3 break-words text-sm font-black leading-5 text-[#0B302B]">{group.title}</h3>
            <div className="grid gap-2">
              {group.entries.sort((a, b) => compareRaceDaySlots(a.stage.daySlot, b.stage.daySlot)).map(({ edition, stage }) => {
                const liveState = getStageLiveState(stage, now);
                const discipline = stage.stageType === "road" ? "Route" : "CLM";
                const actionLabel = stage.status === "completed" || edition.status === "completed"
                  ? "Résultats"
                  : liveState.status === "live"
                    ? "En direct"
                    : liveState.status === "finished"
                      ? "Direct / résultats"
                      : RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel;
                return (
                  <Link
                    key={stage.id}
                    href={`/jeu/resultats/${edition.slug}/${stage.stageNumber}`}
                    prefetch={false}
                    aria-label={`${edition.name} · ${discipline} · ${actionLabel}`}
                    className="flex min-h-12 items-center justify-between gap-2 rounded-xl bg-[#EAF5F0] px-3 py-2 text-[#12503E] transition hover:bg-[#D7EEE8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951]"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-black">{discipline}</span>
                      <span className="block text-xs font-semibold leading-5">{actionLabel}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 font-black">→</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
