"use client";

import Link from "@/components/ui/app-link";
import { useMemo, useState } from "react";

import type { RaceCalendarEdition } from "@/lib/game/race-calendar";
import type {
  OfficialAttackParticipant,
  OfficialRaceEditionResults,
  OfficialRiderResult,
  OfficialSecondaryClassification,
} from "@/lib/game/race-results";

type ClassificationKey =
  | "stage"
  | "general"
  | "mountain"
  | "sprint"
  | "youth"
  | "team";

const CLASSIFICATION_LABELS: Record<ClassificationKey, string> = {
  stage: "Étape",
  general: "Général",
  mountain: "Meilleur grimpeur",
  sprint: "Classement par points",
  youth: "Meilleur jeune",
  team: "Équipes",
};

export function RaceOfficialResults({
  edition,
  selectedStageId,
  officialResults,
}: {
  edition: RaceCalendarEdition;
  selectedStageId: string;
  officialResults: OfficialRaceEditionResults;
}) {
  const stageClassification = officialResults.stages.find(
    (stage) => stage.stageId === selectedStageId
  );
  const availableTabs = useMemo(() => {
    const tabs: ClassificationKey[] = [];
    if (stageClassification) tabs.push("stage");
    if (edition.raceFormat === "stage_race" && officialResults.general.length > 0) {
      tabs.push("general");
    }
    for (const secondary of officialResults.secondary) {
      tabs.push(secondary.type);
    }
    return tabs;
  }, [edition.raceFormat, officialResults, stageClassification]);
  const [activeTab, setActiveTab] = useState<ClassificationKey>(
    availableTabs[0] ?? "stage"
  );

  const resolvedTab = availableTabs.includes(activeTab)
    ? activeTab
    : availableTabs[0] ?? "stage";

  const secondary = officialResults.secondary.find(
    (classification) => classification.type === resolvedTab
  );
  const riderResults =
    resolvedTab === "stage"
      ? stageClassification?.results ?? []
      : resolvedTab === "general"
        ? officialResults.general
        : secondary?.riders ?? [];
  const winner = riderResults.find((result) => result.rank === 1) ?? null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_28px_80px_rgba(19,60,46,0.14)]">
      <header className="bg-[linear-gradient(135deg,#071A17,#123F35)] px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
              Résultats officiels enregistrés
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              {edition.name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {resolvedTab === "stage" && stageClassification
                ? `${edition.raceFormat === "stage_race" ? `Étape ${stageClassification.stageNumber} · ` : ""}${stageClassification.stageName}`
                : `${CLASSIFICATION_LABELS[resolvedTab]}${officialResults.generalIsProvisional && resolvedTab === "general" ? " · provisoire" : ""}`}
            </p>
          </div>
          {winner ? (
            <div className="min-w-[230px] rounded-2xl border border-[#F2C94C]/30 bg-[#F2C94C]/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F2C94C]">
                En tête du classement
              </p>
              <Link
                href={`/jeu/coureurs/${winner.riderId}`}
                className="mt-1 block text-lg font-black text-white hover:text-[#F2C94C]"
              >
                {winner.riderName}
              </Link>
              <Link
                href={`/jeu/equipes/${winner.teamId}`}
                className="text-xs font-bold text-[#BFD2C9] hover:text-white"
              >
                {winner.teamName}
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      <nav
        aria-label="Classements de la course"
        className="flex gap-2 overflow-x-auto border-b border-[#315B3E]/12 bg-[#F3F8F5] px-4 py-3 sm:px-6"
      >
        {availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={resolvedTab === tab}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${
              resolvedTab === tab
                ? "bg-[#0B302B] text-white shadow-sm"
                : "border border-[#315B3E]/15 bg-white text-[#315B3E] hover:border-[#176951]/45"
            }`}
          >
            {edition.raceFormat === "one_day" && tab === "stage"
              ? "Classement"
              : CLASSIFICATION_LABELS[tab]}
          </button>
        ))}
      </nav>

      {resolvedTab === "team" && secondary ? (
        <TeamResultsTable classification={secondary} />
      ) : (
        <RiderResultsTable
          results={riderResults}
          classification={resolvedTab}
        />
      )}
      <RaceAnimators
        participants={officialResults.attackParticipants}
        isStageRace={edition.raceFormat === "stage_race"}
      />
    </section>
  );
}

function RaceAnimators({
  participants,
  isStageRace,
}: {
  participants: OfficialAttackParticipant[];
  isStageRace: boolean;
}) {
  return (
    <section className="border-t border-[#315B3E]/12 bg-[#F3F8F5] px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Attaquants enregistrés
          </p>
          <h3 className="mt-1 text-lg font-black text-[#0B302B]">
            Les animateurs de la course
          </h3>
        </div>
        <p className="max-w-xl text-xs font-semibold leading-5 text-[#688176]">
          Coureurs passés par une échappée ou un groupe de chasse pendant le live officiel.
        </p>
      </div>

      {participants.length > 0 ? (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((participant) => (
            <li
              key={participant.riderId}
              className="rounded-2xl border border-[#315B3E]/12 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/jeu/coureurs/${participant.riderId}`}
                    className="block truncate text-sm font-black text-[#0B302B] hover:text-[#176951] hover:underline"
                  >
                    {participant.riderName}
                  </Link>
                  <Link
                    href={`/jeu/equipes/${participant.teamId}`}
                    className="mt-0.5 block truncate text-xs font-bold text-[#688176] hover:text-[#176951] hover:underline"
                  >
                    {participant.teamName}
                  </Link>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                    participant.participationType === "breakaway"
                      ? "bg-[#F2C94C]/20 text-[#7B5A00]"
                      : "bg-[#7D5BB1]/12 text-[#684397]"
                  }`}
                >
                  {participant.participationType === "breakaway"
                    ? "Échappée"
                    : "Chasse"}
                </span>
              </div>
              {isStageRace ? (
                <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-[#8A9D96]">
                  {participant.stageNumbers.length > 1 ? "Étapes" : "Étape"}{" "}
                  {participant.stageNumbers.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[#315B3E]/20 bg-white px-4 py-4 text-sm font-semibold text-[#688176]">
          Aucun attaquant n’a été enregistré sur cette course.
        </p>
      )}
    </section>
  );
}

function RiderResultsTable({
  results,
  classification,
}: {
  results: OfficialRiderResult[];
  classification: ClassificationKey;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#315B3E]/12 bg-white text-[10px] font-black uppercase tracking-[0.16em] text-[#688176]">
            <th className="w-20 px-5 py-4 sm:px-7">Pos.</th>
            <th className="px-4 py-4">Coureur</th>
            <th className="px-4 py-4">Équipe</th>
            <th className="px-4 py-4">Temps / écart</th>
            {(classification === "stage" || classification === "mountain" || classification === "sprint") ? (
              <th className="px-4 py-4 text-right">Points annexes</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#315B3E]/10">
          {results.map((result, index) => (
            <tr
              key={result.riderId}
              className={`${result.rank !== null && result.rank <= 3 ? "bg-[#F7FAF0]" : "bg-white"} transition hover:bg-[#EEF7F2]`}
            >
              <td className="px-5 py-4 sm:px-7">
                <Rank rank={result.rank} />
              </td>
              <td className="px-4 py-4">
                <Link
                  href={`/jeu/coureurs/${result.riderId}`}
                  className="font-black text-[#0B302B] hover:text-[#176951] hover:underline"
                >
                  {result.riderName}
                </Link>
                {result.status !== "finished" ? (
                  <span className="ml-2 rounded-full bg-[#A33A3A]/10 px-2 py-1 text-[9px] font-black uppercase text-[#A33A3A]">
                    {statusLabel(result.status)}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-4">
                <Link
                  href={`/jeu/equipes/${result.teamId}`}
                  className="text-sm font-bold text-[#48665F] hover:text-[#176951] hover:underline"
                >
                  {result.teamName}
                </Link>
              </td>
              <td className="px-4 py-4 font-mono text-sm font-black text-[#173E35]">
                {formatResultTime(result, results[index - 1])}
              </td>
              {(classification === "stage" || classification === "mountain" || classification === "sprint") ? (
                <td className="px-4 py-4 text-right text-xs font-black text-[#176951]">
                  {formatSecondaryPoints(result, classification)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {results.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm font-bold text-[#688176]">
          Ce classement ne contient encore aucun résultat.
        </p>
      ) : null}
    </div>
  );
}

function TeamResultsTable({
  classification,
}: {
  classification: OfficialSecondaryClassification;
}) {
  const winnerTime = classification.teams[0]?.totalTimeMs ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#315B3E]/12 text-[10px] font-black uppercase tracking-[0.16em] text-[#688176]">
            <th className="w-20 px-5 py-4 sm:px-7">Pos.</th>
            <th className="px-4 py-4">Équipe</th>
            <th className="px-4 py-4">Temps moyen pondéré</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#315B3E]/10">
          {classification.teams.map((team) => (
            <tr key={team.teamId} className="bg-white hover:bg-[#EEF7F2]">
              <td className="px-5 py-4 sm:px-7"><Rank rank={team.rank} /></td>
              <td className="px-4 py-4">
                <Link
                  href={`/jeu/equipes/${team.teamId}`}
                  className="font-black text-[#0B302B] hover:text-[#176951] hover:underline"
                >
                  {team.teamName}
                </Link>
              </td>
              <td className="px-4 py-4 font-mono text-sm font-black text-[#173E35]">
                {team.rank === 1
                  ? formatDuration(team.totalTimeMs)
                  : formatGap(team.totalTimeMs - winnerTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-xs font-black text-[#A33A3A]">ABD</span>;
  const tone = rank === 1 ? "bg-[#F2C94C] text-[#382E00]" : rank === 2 ? "bg-[#DDE5E2] text-[#173E35]" : rank === 3 ? "bg-[#D7A36A]/25 text-[#734719]" : "bg-[#176951]/10 text-[#176951]";
  return <span className={`inline-grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-black ${tone}`}>{rank}</span>;
}

type OfficialResultStatusLike = OfficialRiderResult["status"];

function formatResultTime(
  result: OfficialRiderResult,
  previousResult: OfficialRiderResult | undefined
) {
  if (result.status !== "finished" || result.elapsedTimeMs === null) {
    return statusLabel(result.status);
  }
  if (result.rank === 1) return formatDuration(result.elapsedTimeMs);
  if (
    previousResult?.status === "finished" &&
    previousResult.elapsedTimeMs === result.elapsedTimeMs
  ) {
    return "MT";
  }
  return formatGap(result.gapToWinnerMs ?? 0);
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}′ ${String(remainingSeconds).padStart(2, "0")}″`;
}

function formatGap(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `+ ${minutes}′ ${String(remainingSeconds).padStart(2, "0")}″`
    : `+ ${remainingSeconds}″`;
}

function formatSecondaryPoints(
  result: OfficialRiderResult,
  classification: ClassificationKey
) {
  if (classification === "mountain") return `${result.mountainPoints} pts`;
  if (classification === "sprint") return `${result.sprintPoints} pts`;
  const points = [
    result.mountainPoints > 0 ? `${result.mountainPoints} GPM` : null,
    result.sprintPoints > 0 ? `${result.sprintPoints} SI` : null,
  ].filter(Boolean);
  return points.length > 0 ? points.join(" · ") : "—";
}

function statusLabel(status: OfficialResultStatusLike) {
  return {
    finished: "Classé",
    did_not_start: "Non-partant",
    did_not_finish: "Abandon",
    disqualified: "Disqualifié",
    outside_time_limit: "Hors délais",
    withdrawn: "Retiré",
  }[status];
}
