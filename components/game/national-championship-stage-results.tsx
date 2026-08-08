import { RaceOfficialResults } from "@/components/game/race-official-results";
import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "@/lib/game/race-calendar";
import {
  canSimulateRaceEdition,
  getStageLiveState,
} from "@/lib/game/race-live";
import type { OfficialRaceEditionResults } from "@/lib/game/race-results";

export function NationalChampionshipStageResults({
  edition,
  stage,
  nowIso,
  officialResults,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  nowIso: string;
  officialResults: OfficialRaceEditionResults | null;
}) {
  const state = getStageLiveState(stage, new Date(nowIso));
  const resultAvailable = Boolean(
    officialResults?.stages.some((result) => result.stageId === stage.id),
  );

  if (!canSimulateRaceEdition(edition)) {
    return (
      <StatusPanel
        eyebrow="Championnat non disputé"
        title="Aucun coureur engagé"
        description="Aucun classement n’est produit pour cette nation."
      />
    );
  }

  if (state.status === "cancelled") {
    return (
      <StatusPanel
        eyebrow="Championnat annulé"
        title="Aucun résultat officiel"
        description="Cette épreuve a été annulée."
      />
    );
  }

  if (state.status !== "finished" || !resultAvailable || !officialResults) {
    return (
      <StatusPanel
        eyebrow="Simulation automatique"
        title={
          state.status === "scheduled"
            ? "Les résultats seront publiés après le départ"
            : "Homologation du classement en cours"
        }
        description="Ce championnat est simulé en arrière-plan, sans direct, animation ni replay. Toutes les nations et les deux disciplines sont traitées en J8."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#176951]/20 bg-[#DFF2EA] px-5 py-4 text-sm font-bold leading-6 text-[#164C3E]">
        Classement officiel · aucune diffusion graphique ni replay n’a été
        généré pour cette épreuve.
      </div>
      <RaceOfficialResults
        edition={edition}
        selectedStageId={stage.id}
        officialResults={officialResults}
        postRaceInterview={null}
      />
    </div>
  );
}

function StatusPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[#071A17] p-7 text-white shadow-[0_30px_80px_rgba(7,26,23,0.2)] sm:p-10">
      <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black">{title}</h2>
      <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#C8D7D0]">
        {description}
      </p>
    </section>
  );
}
