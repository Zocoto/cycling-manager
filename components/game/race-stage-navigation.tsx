import { RACE_DAY_SLOT_CONFIG, type RaceCalendarEdition } from "@/lib/game/race-calendar";

import Link from "@/components/ui/app-link";

export function RaceStageNavigation({
  edition,
  currentStageNumber,
  currentDayNumber,
}: {
  edition: RaceCalendarEdition;
  currentStageNumber: number;
  currentDayNumber: number;
}) {
  if (edition.raceFormat !== "stage_race") {
    return null;
  }

  const stages = [...edition.stages].sort(
    (first, second) => first.stageNumber - second.stageNumber,
  );
  const currentIndex = stages.findIndex(
    (stage) => stage.stageNumber === currentStageNumber,
  );

  if (currentIndex < 0) {
    return null;
  }

  const previousStage = stages[currentIndex - 1] ?? null;
  const nextStage = stages[currentIndex + 1] ?? null;

  return (
    <nav
      aria-label="Navigation entre les étapes"
      className="mb-5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2"
    >
      <StageNavigationItem
        direction="previous"
        editionSlug={edition.slug}
        stage={previousStage}
        currentDayNumber={currentDayNumber}
      />

      <Link
        href={`/jeu/resultats/${edition.slug}`}
        className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#176951]/20 bg-white px-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:text-xs"
      >
        Toutes les étapes
      </Link>

      <StageNavigationItem
        direction="next"
        editionSlug={edition.slug}
        stage={nextStage}
        currentDayNumber={currentDayNumber}
      />
    </nav>
  );
}

function StageNavigationItem({
  direction,
  editionSlug,
  stage,
  currentDayNumber,
}: {
  direction: "previous" | "next";
  editionSlug: string;
  stage: RaceCalendarEdition["stages"][number] | null;
  currentDayNumber: number;
}) {
  const isPrevious = direction === "previous";
  const alignment = isPrevious ? "items-start text-left" : "items-end text-right";
  const label = isPrevious ? "Étape précédente" : "Étape suivante";

  if (!stage) {
    return (
      <span
        aria-disabled="true"
        className={`inline-flex min-h-12 flex-col justify-center rounded-xl border border-[#315B3E]/10 bg-[#F4F8F6] px-3 text-[#8AA097] opacity-60 sm:px-4 ${alignment}`}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.12em]">
          {label}
        </span>
        <span className="mt-0.5 text-xs font-bold">
          {isPrevious ? "Début du tour" : "Fin du tour"}
        </span>
      </span>
    );
  }

  const stageLabel = `E${stage.stageNumber} · J${stage.dayNumber} · ${
    RACE_DAY_SLOT_CONFIG[stage.daySlot].shortLabel
  }`;
  const content = (
    <>
      <span className="text-[9px] font-black uppercase tracking-[0.12em]">
        {isPrevious ? `← ${label}` : `${label} →`}
      </span>
      <span className="mt-0.5 text-xs font-black">{stageLabel}</span>
    </>
  );

  if (stage.dayNumber > currentDayNumber) {
    return (
      <span
        aria-disabled="true"
        title={`Cette étape sera disponible au jour ${stage.dayNumber}.`}
        className={`inline-flex min-h-12 flex-col justify-center rounded-xl border border-[#315B3E]/10 bg-[#F4F8F6] px-3 text-[#789087] sm:px-4 ${alignment}`}
      >
        {content}
        <span className="mt-0.5 hidden text-[9px] font-bold text-[#9A7C12] sm:block">
          Disponible à J{stage.dayNumber}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={`/jeu/resultats/${editionSlug}/${stage.stageNumber}`}
      prefetch={false}
      className={`inline-flex min-h-12 flex-col justify-center rounded-xl border border-[#176951]/20 bg-white px-3 text-[#176951] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-4 ${alignment}`}
    >
      {content}
    </Link>
  );
}
