"use client";

import { useActionState, useMemo, useState } from "react";

import {
  FederationSelectionCoursePreview,
  getFederationCourseProfileLabel,
} from "@/components/game/federation-selection-course";

import {
  publishFederationPreselectionAction,
  respondFederationPreselectionAction,
  saveFederationPreselectionAction,
  setFederationAutomaticSelectionAction,
} from "@/app/jeu/federations/selection-actions";
import {
  RIDER_CLIMATE_LABELS,
  RiderClimateIcon,
} from "@/components/game/rider-climate-profile-card";

import { initialFederationSelectionActionState } from "@/lib/game/federation-action-states";
import { formatFederationSelectionDeadline } from "@/lib/game/federation-callups";
import type { FederationHostingEventType } from "@/lib/game/federation-hosting";
import type { FederationSelectionForecast } from "@/lib/game/federation-selection-weather";
import {
  FEDERATION_SELECTION_SORT_OPTIONS,
  getFederationSelectionSortLabel,
  getFederationSelectionSortValue,
  sortFederationSelectionRiders,
  type FederationSelectionSortDirection,
  type FederationSelectionSortKey,
} from "@/lib/game/federation-selection-ranking";
import {
  getRaceClimatePerformanceAdjustment,
  getRaceWeatherLabel,
  getRaceWindLabel,
  getRiderClimateProfile,
  type RiderClimateProfile,
} from "@/lib/game/race-weather";
import type { FederationSelectionRider } from "@/services/federation-selection-pool";
import type { FederationSelectionState } from "@/services/federation-selections";

type SelectionCompetitionId =
  | "continental-pro"
  | "continental-junior"
  | "nations-pro"
  | "nations-junior"
  | "world-pro"
  | "world-junior";

type SelectionSlot = {
  id: string;
  label: string;
  competition: string;
  competitionId: SelectionCompetitionId;
  subRaceLabel: string;
  category: FederationSelectionRider["category"];
  hostName: string;
  hostCode: string;
  day: number;
  limit: number;
  nationsCupProfile?: FederationSelectionRider["profile"];
};

const SELECTION_SLOTS: SelectionSlot[] = [
  { id: "cc-pro-road", label: "CC Pros · Route", competition: "Championnats continentaux", competitionId: "continental-pro", subRaceLabel: "En ligne", category: "professional", hostName: "Pays-Bas", hostCode: "nl", day: 15, limit: 8 },
  { id: "cc-pro-itt", label: "CC Pros · CLM", competition: "Championnats continentaux", competitionId: "continental-pro", subRaceLabel: "Contre-la-montre", category: "professional", hostName: "Pays-Bas", hostCode: "nl", day: 15, limit: 2 },
  { id: "cc-junior-road", label: "CC Juniors · Route", competition: "Championnats continentaux juniors", competitionId: "continental-junior", subRaceLabel: "En ligne", category: "junior", hostName: "Pays-Bas", hostCode: "nl", day: 15, limit: 6 },
  { id: "cc-junior-itt", label: "CC Juniors · CLM", competition: "Championnats continentaux juniors", competitionId: "continental-junior", subRaceLabel: "Contre-la-montre", category: "junior", hostName: "Pays-Bas", hostCode: "nl", day: 15, limit: 2 },
  { id: "nc-mountain", label: "Nations Cup · Montagne", competition: "Nations Cup", competitionId: "nations-pro", subRaceLabel: "Montagne", category: "professional", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Montagne" },
  { id: "nc-hills", label: "Nations Cup · Vallons", competition: "Nations Cup", competitionId: "nations-pro", subRaceLabel: "Vallons", category: "professional", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Vallons" },
  { id: "nc-sprint", label: "Nations Cup · Sprint", competition: "Nations Cup", competitionId: "nations-pro", subRaceLabel: "Sprint", category: "professional", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Sprint" },
  { id: "nc-cobbles", label: "Nations Cup · Pavés", competition: "Nations Cup", competitionId: "nations-pro", subRaceLabel: "Pavés", category: "professional", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Pavés" },
  { id: "nc-time-trial", label: "Nations Cup · Chrono", competition: "Nations Cup", competitionId: "nations-pro", subRaceLabel: "Chrono", category: "professional", hostName: "Suisse", hostCode: "ch", day: 24, limit: 1, nationsCupProfile: "Chrono" },
  { id: "nc-junior-road", label: "Nations Cup Juniors · Route", competition: "Nations Cup juniors", competitionId: "nations-junior", subRaceLabel: "En ligne", category: "junior", hostName: "Suisse", hostCode: "ch", day: 24, limit: 6 },
  { id: "world-pro-road", label: "Mondiaux Pros · Route", competition: "Championnats du monde", competitionId: "world-pro", subRaceLabel: "En ligne", category: "professional", hostName: "Canada", hostCode: "ca", day: 26, limit: 8 },
  { id: "world-pro-itt", label: "Mondiaux Pros · CLM", competition: "Championnats du monde", competitionId: "world-pro", subRaceLabel: "Contre-la-montre", category: "professional", hostName: "Canada", hostCode: "ca", day: 26, limit: 2 },
  { id: "world-junior-road", label: "Mondiaux Juniors · Route", competition: "Championnats du monde juniors", competitionId: "world-junior", subRaceLabel: "En ligne", category: "junior", hostName: "Canada", hostCode: "ca", day: 26, limit: 6 },
  { id: "world-junior-itt", label: "Mondiaux Juniors · CLM", competition: "Championnats du monde juniors", competitionId: "world-junior", subRaceLabel: "Contre-la-montre", category: "junior", hostName: "Canada", hostCode: "ca", day: 26, limit: 2 },
];

type SelectionCompetition = {
  id: SelectionCompetitionId;
  day: number;
  name: string;
  detail: string;
};

function getFederationSelectionCompetitions(
  gameYear: number,
): SelectionCompetition[] {
  const quadriennialSeason = gameYear % 4 === 0;

  return [
    { id: "continental-pro", day: 15, name: "Championnats continentaux", detail: "Professionnels · en ligne et contre-la-montre" },
    { id: "continental-junior", day: 15, name: "Championnats continentaux juniors", detail: "Juniors · en ligne et contre-la-montre" },
    { id: "nations-pro", day: 24, name: quadriennialSeason ? "Jeux quadriennaux" : "Nations Cup", detail: quadriennialSeason ? "Cinq épreuves professionnelles exceptionnelles" : "Cinq épreuves · classement de division et de groupe" },
    { id: "nations-junior", day: 24, name: "Nations Cup juniors", detail: "Sélection fédérale · 6 juniors issus des écoles ou DevTeams" },
    { id: "world-pro", day: 26, name: "Championnats du monde", detail: "Professionnels · en ligne et contre-la-montre" },
    { id: "world-junior", day: 26, name: "Championnats du monde juniors", detail: "Juniors · en ligne et contre-la-montre" },
  ];
}

function getFederationSelectionSlots(gameYear: number): SelectionSlot[] {
  if (gameYear % 4 !== 0) return SELECTION_SLOTS;

  return SELECTION_SLOTS.map((slot) =>
    slot.category === "professional" && slot.competition === "Nations Cup"
      ? {
          ...slot,
          label: slot.label.replace("Nations Cup", "Jeux quadriennaux"),
          competition: "Jeux quadriennaux",
        }
      : slot,
  );
}

type SelectionCompetitionProgress = {
  sent: number;
  confirmed: number;
  pending: number;
  isComplete: boolean;
};

function getSelectionCompetitionProgress({
  competitionId,
  slots,
  selections,
}: {
  competitionId: SelectionCompetitionId;
  slots: SelectionSlot[];
  selections: FederationSelectionState["selections"];
}): SelectionCompetitionProgress {
  const competitionSlots = slots.filter(
    (candidate) => candidate.competitionId === competitionId,
  );

  return competitionSlots.reduce<SelectionCompetitionProgress>(
    (progress, candidate) => {
      const selection = selections[candidate.id];
      if (!selection) {
        return { ...progress, isComplete: false };
      }

      const responses = Object.values(selection.responses ?? {});
      const confirmed = selection.confirmedRiderIds?.length ??
        responses.filter((response) => response === "confirmed").length;
      const sent = responses.length > 0
        ? responses.filter((response) => response !== "draft").length
        : selection.status === "draft"
          ? 0
          : selection.riderIds.length;
      const pending = responses.length > 0
        ? responses.filter((response) => response === "pending").length
        : Math.max(0, sent - confirmed);
      const slotComplete =
        selection.status === "finalized" &&
        confirmed >= candidate.limit &&
        pending === 0;

      return {
        sent: progress.sent + sent,
        confirmed: progress.confirmed + confirmed,
        pending: progress.pending + pending,
        isComplete: progress.isComplete && slotComplete,
      };
    },
    { sent: 0, confirmed: 0, pending: 0, isComplete: true },
  );
}

const PRIMARY_RATING_COLUMNS = [
  { key: "mountain", label: "MO" },
  { key: "hills", label: "VAL" },
  { key: "flat", label: "PL" },
  { key: "timeTrial", label: "CLM" },
  { key: "cobbles", label: "PAV" },
  { key: "sprint", label: "SPR" },
] as const;

export function FederationSelectionWorkbench({
  countryCode,
  countryName,
  riders,
  gameYear,
  selectionState,
}: {
  countryCode: string;
  countryName: string;
  riders: FederationSelectionRider[];
  gameYear: number;
  selectionState: FederationSelectionState | null;
}) {
  const selectionSlots = useMemo(
    () => getFederationSelectionSlots(gameYear),
    [gameYear],
  );
  const competitions = useMemo(
    () => getFederationSelectionCompetitions(gameYear),
    [gameYear],
  );
  const [slotId, setSlotId] = useState(selectionSlots[0].id);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("all");
  const [profile, setProfile] = useState("all");
  const [sortKey, setSortKey] =
    useState<FederationSelectionSortKey>("overall");
  const [sortDirection, setSortDirection] =
    useState<FederationSelectionSortDirection>("descending");
  const [automaticSelection, setAutomaticSelection] = useState(
    selectionState?.automaticSelection ?? true,
  );
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, string[]>>(
    () =>
      Object.fromEntries(
        Object.entries(selectionState?.selections ?? {}).map(([key, value]) => [
          key,
          value.riderIds,
        ]),
      ),
  );
  const [selectionSnapshot, setSelectionSnapshot] = useState(selectionState?.selections);
  if (selectionSnapshot !== selectionState?.selections) {
    setSelectionSnapshot(selectionState?.selections);
    setSelectedBySlot(Object.fromEntries(Object.entries(selectionState?.selections ?? {}).map(([key, value]) => [key, value.riderIds])));
    setAutomaticSelection(selectionState?.automaticSelection ?? true);
  }
  const [saveState, saveAction, savePending] = useActionState(
    saveFederationPreselectionAction,
    initialFederationSelectionActionState,
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishFederationPreselectionAction,
    initialFederationSelectionActionState,
  );
  const baseSlot =
    selectionSlots.find((candidate) => candidate.id === slotId) ??
    selectionSlots[0];
  const hostingEventType = getSlotHostingEventType(baseSlot.id, gameYear);
  const competitionHost = hostingEventType
    ? selectionState?.competitionHosts[hostingEventType]
    : null;
  const forecast = selectionState?.forecasts[baseSlot.id] ?? null;
  const course = forecast?.course ?? null;
  const slot = course
    ? {
        ...baseSlot,
        hostName: course.countryName,
        hostCode: course.countryCode.toLowerCase(),
        day: course.dayNumber,
      }
    : competitionHost
    ? {
        ...baseSlot,
        hostName: competitionHost.countryName,
        hostCode: competitionHost.countryCode.toLowerCase(),
      }
    : baseSlot;
  const activeCompetition =
    competitions.find(
      (competition) => competition.id === slot.competitionId,
    ) ?? competitions[0];
  const competitionSlots = selectionSlots.filter(
    (candidate) => candidate.competitionId === slot.competitionId,
  );
  const competitionProgress = Object.fromEntries(
    competitions.map((competition) => [
      competition.id,
      getSelectionCompetitionProgress({
        competitionId: competition.id,
        slots: selectionSlots,
        selections: selectionState?.selections ?? {},
      }),
    ]),
  ) as Record<SelectionCompetitionId, SelectionCompetitionProgress>;
  const storedSelection = selectionState?.selections[slot.id] ?? null;
  const confirmedRiderIds = storedSelection?.confirmedRiderIds ?? [];
  const selected = [...new Set([...(selectedBySlot[slot.id] ?? storedSelection?.riderIds ?? []), ...confirmedRiderIds])];
  const schedule = selectionState?.schedules?.[slot.id];
  const deadlineOpen = schedule?.is_open === true;
  const publishedWeather = forecast?.weather ?? null;
  const canManage = gameYear >= 3 && selectionState?.canManage === true;
  const availableTeams = useMemo(
    () => [...new Set(riders.filter((rider) => rider.category === slot.category).map((rider) => rider.teamName))].sort((a, b) => a.localeCompare(b, "fr")),
    [riders, slot.category],
  );
  const filteredRiders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return sortFederationSelectionRiders(
      riders.filter((rider) =>
        rider.category === slot.category &&
        (team === "all" || rider.teamName === team) &&
        (profile === "all" || rider.profile === profile) &&
        (!normalizedQuery || `${rider.name} ${rider.teamName}`.toLocaleLowerCase("fr").includes(normalizedQuery)),
      ),
      {
        key: sortKey,
        direction: sortDirection,
        countryCode,
        weather: publishedWeather,
      },
    );
  }, [countryCode, profile, publishedWeather, query, riders, slot.category, sortDirection, sortKey, team]);

  function updateSort(nextKey: FederationSelectionSortKey) {
    if (nextKey === "weatherAffinity" && !publishedWeather) return;
    if (nextKey === sortKey) {
      setSortDirection((current) =>
        current === "descending" ? "ascending" : "descending",
      );
      return;
    }
    setSortKey(nextKey);
    setSortDirection("descending");
  }

  function changeSlot(nextSlotId: string) {
    setSlotId(nextSlotId);
    setTeam("all");
    setProfile("all");
    setSortKey("overall");
    setSortDirection("descending");
  }

  function changeCompetition(nextCompetitionId: SelectionCompetitionId) {
    const firstSlot = selectionSlots.find(
      (candidate) => candidate.competitionId === nextCompetitionId,
    );
    if (firstSlot) changeSlot(firstSlot.id);
  }

  function toggleRider(riderId: string) {
    if (!canManage || !deadlineOpen || automaticSelection || confirmedRiderIds.includes(riderId)) return;
    if (slot.nationsCupProfile && Object.entries(selectionState?.selections ?? {}).some(
      ([key, selection]) => key !== slot.id && key.startsWith("nc-") && selection.confirmedRiderIds?.includes(riderId),
    )) return;
    setSelectedBySlot((current) => {
      const currentSlot = selected;
      if (currentSlot.includes(riderId)) {
        return { ...current, [slot.id]: currentSlot.filter((id) => id !== riderId) };
      }
      if (currentSlot.length >= slot.limit) return current;

      const withoutOtherNationsCupEntries = slot.nationsCupProfile
        ? Object.fromEntries(
            Object.entries(current).map(([key, riderIds]) => [
              key,
              key.startsWith("nc-") ? riderIds.filter((id) => id !== riderId) : riderIds,
            ]),
          )
        : current;
      return { ...withoutOtherNationsCupEntries, [slot.id]: [...currentSlot, riderId] };
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[var(--federation-secondary)]/25 bg-[#E8F7F1] p-5 shadow-[0_14px_36px_rgba(19,60,46,0.08)] sm:p-6">
        <SelectionAutomaticModeControl
          countryCode={countryCode}
          canManage={canManage}
          checked={automaticSelection}
          onChange={setAutomaticSelection}
        />
      </section>

      {selectionState?.pendingConfirmations.length ? (
        <PendingConfirmationPanel
          countryCode={countryCode}
          confirmations={selectionState.pendingConfirmations}
          riders={riders}
          gameYear={gameYear}
        />
      ) : null}

      <section
        aria-label="Compétitions internationales"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {competitions.map((competition) => {
          const progress = competitionProgress[competition.id];
          const isActive = competition.id === activeCompetition.id;
          const maturityLabel = `${competition.name} : ${progress.sent} convocations envoyées, ${progress.confirmed} confirmées, ${progress.pending} en attente${progress.isComplete ? ", sélection finalisée" : ""}`;

          return (
            <button
              key={competition.id}
              type="button"
              data-selection-competition={competition.id}
              aria-label={maturityLabel}
              aria-pressed={isActive}
              aria-controls="federation-selection-detail"
              onClick={() => changeCompetition(competition.id)}
              className={`group relative min-h-64 overflow-hidden rounded-[1.65rem] border bg-white p-6 text-left shadow-[0_14px_36px_rgba(19,60,46,0.07)] transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--federation-secondary)] ${
                isActive
                  ? "border-[var(--federation-secondary)] shadow-[0_18px_44px_rgba(19,60,46,0.14)]"
                  : "border-[#315B3E]/12 hover:-translate-y-0.5 hover:border-[var(--federation-secondary)]/45"
              }`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2D74DA,#F2C94C,#C75348,#42B99A,#8D60C7)]"
              />
              <span className="flex items-start justify-between gap-4">
                <span className="rounded-xl bg-[var(--federation-primary)] px-3 py-2 text-sm font-black text-white">
                  J{competition.day}
                </span>
                {progress.isComplete ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#DDF3E7] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#176951]">
                    <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-[#176951] text-xs text-white">✓</span>
                    Sélection finalisée
                  </span>
                ) : (
                  <span className="rounded-full border border-[#315B3E]/12 bg-[#EEF3F1] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#60756E]">
                    {gameYear < 3 ? "Gestion verrouillée" : "Calendrier officiel"}
                  </span>
                )}
              </span>
              <span className="mt-5 block text-xl font-black text-[#183F37]">
                {competition.name}
              </span>
              <span className="mt-2 block min-h-12 text-sm font-semibold leading-6 text-[#60756E]">
                {competition.detail}
              </span>
              <span className="mt-5 grid grid-cols-3 gap-2 border-t border-[#315B3E]/10 pt-4">
                <SelectionMaturityMetric value={progress.sent} label="Convocations envoyées" />
                <SelectionMaturityMetric value={progress.confirmed} label="Convocations confirmées" tone="confirmed" />
                <SelectionMaturityMetric value={progress.pending} label="Confirmations en attente" tone={progress.pending > 0 ? "pending" : "neutral"} />
              </span>
              <span className={`mt-4 flex items-center justify-end text-xs font-black ${isActive ? "text-[var(--federation-secondary)]" : "text-[#60756E] group-hover:text-[var(--federation-secondary)]"}`}>
                {isActive ? "Compétition affichée" : "Préparer la sélection"} <span aria-hidden="true" className="ml-2">→</span>
              </span>
            </button>
          );
        })}
      </section>

      <section className="rounded-[1.65rem] border border-[#315B3E]/12 bg-white p-4 shadow-[0_14px_36px_rgba(19,60,46,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--federation-secondary)]">
              Sous-épreuves
            </p>
            <h2 className="mt-1 text-xl font-black text-[#183F37]">
              {activeCompetition.name}
            </h2>
          </div>
          <nav
            aria-label={`Sous-épreuves ${activeCompetition.name}`}
            className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:justify-end"
          >
            {competitionSlots.map((candidate) => {
              const candidateSelection = selectionState?.selections[candidate.id];
              const confirmedCount = candidateSelection?.confirmedRiderIds?.length ?? 0;
              const isSelectedSlot = candidate.id === slot.id;

              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => changeSlot(candidate.id)}
                  aria-pressed={isSelectedSlot}
                  className={`min-h-12 shrink-0 rounded-xl px-4 py-2 text-left text-xs font-black transition ${
                    isSelectedSlot
                      ? "bg-[var(--federation-primary)] text-white shadow-sm"
                      : "bg-[#F2F8F5] text-[#315B3E] hover:bg-[#E5F4ED]"
                  }`}
                >
                  <span className="block">{candidate.subRaceLabel}</span>
                  <span className={`mt-1 block text-[9px] uppercase tracking-[0.1em] ${isSelectedSlot ? "text-[#D6DFD2]" : "text-[#70827B]"}`}>
                    {confirmedCount}/{candidate.limit} confirmé{candidate.limit > 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <section id="federation-selection-detail" className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.07)]">
        <div className="grid gap-4 bg-[var(--federation-primary)] p-5 text-white sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center gap-4">
            <span role="img" aria-label={`Pays hôte : ${slot.hostName}`} className={`fi fi-${slot.hostCode} text-4xl shadow-sm`} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--federation-accent)]">J{slot.day} · Pays hôte : {slot.hostName}</p>
              <h3 className="mt-1 text-xl font-black">{slot.label}</h3>
              <p className="mt-1 text-xs font-semibold text-[#D6DFD2]">
                {course ? <>Profil : {getFederationCourseProfileLabel(course)}</> : "Parcours en attente de publication"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch justify-end gap-3">
            <SelectionWeatherSummary
              forecast={forecast}
              gameYear={gameYear}
            />
            <div className="min-w-24 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">Liste</p>
              <p className="mt-1 text-2xl font-black text-[#F2C94C]">{selected.length}/{slot.limit}</p>
            </div>
          </div>
        </div>

        {course ? <FederationSelectionCoursePreview course={course} /> : null}

        <p className="border-b border-[#315B3E]/10 bg-[#F2F8F5] px-5 py-4 text-xs font-bold leading-5 text-[#526B62]">
          {deadlineOpen ? `Modifications possibles jusqu’au ${formatFederationSelectionDeadline(schedule.closes_at)} (heure de Paris).` : schedule?.closes_at ? "Date limite dépassée : les convocations sont verrouillées." : "Les modifications seront disponibles lorsque le calendrier sera confirmé."}
          {" "}Un coureur confirmé par son DS reste sélectionné et ne peut plus être retiré.
        </p>

        <fieldset
          disabled={automaticSelection}
          className={`min-w-0 transition ${automaticSelection ? "opacity-55 grayscale-[35%]" : ""}`}
        >
        <div className="grid gap-3 border-b border-[#315B3E]/10 p-5 sm:grid-cols-2 lg:grid-cols-5">
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Nationalité verrouillée</span><span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-[#315B3E]/12 bg-[#EEF3F1] px-3 text-sm font-black text-[#183F37]"><span className={`fi fi-${countryCode.toLowerCase()}`} />{countryName}</span></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Recherche</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Coureur ou équipe" className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[var(--federation-secondary)]" /></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Équipe</span><select value={team} onChange={(event) => setTeam(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37]"><option value="all">Toutes</option>{availableTeams.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Profil</span><select value={profile} onChange={(event) => setProfile(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37]"><option value="all">Tous</option>{["Montagne", "Vallons", "Sprint", "Pavés", "Chrono", "Polyvalent"].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">Trier par</span>
            <span className="mt-2 flex gap-2">
              <select value={sortKey} onChange={(event) => updateSort(event.target.value as FederationSelectionSortKey)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#315B3E]/15 px-3 text-sm font-bold text-[#183F37]">
                {FEDERATION_SELECTION_SORT_OPTIONS.map((option) => <option key={option.key} value={option.key} disabled={option.key === "weatherAffinity" && !publishedWeather}>{option.label}</option>)}
              </select>
              <button type="button" onClick={() => setSortDirection((current) => current === "descending" ? "ascending" : "descending")} aria-label={sortDirection === "descending" ? "Trier par ordre croissant" : "Trier par ordre décroissant"} title={sortDirection === "descending" ? "Ordre décroissant" : "Ordre croissant"} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#315B3E]/15 bg-[#F8FBF9] text-base font-black text-[#315B3E]">
                {sortDirection === "descending" ? "↓" : "↑"}
              </button>
            </span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-collapse text-left">
            <thead className="bg-[#F2F8F5] text-[9px] font-black uppercase tracking-[0.11em] text-[#60756E]"><tr><th className="px-5 py-3">Choix</th><th className="px-3 py-3">Coureur</th><th className="px-3 py-3">Équipe</th><th className="px-3 py-3">Profil</th>{PRIMARY_RATING_COLUMNS.map((column) => <SortableRatingHeader key={column.key} label={column.label} sortKey={column.key} activeSortKey={sortKey} direction={sortDirection} onSort={updateSort} />)}<SortableRatingHeader label="Moy." sortKey="overall" activeSortKey={sortKey} direction={sortDirection} onSort={updateSort} /><SortableRatingHeader label="Affinités météo" sortKey="weatherAffinity" activeSortKey={sortKey} direction={sortDirection} onSort={updateSort} disabled={!publishedWeather} wide /><th className="px-5 py-3">Accord</th></tr></thead>
            <tbody className="divide-y divide-[#315B3E]/10">
              {filteredRiders.map((rider) => {
                const isSelected = selected.includes(rider.id);
                const isConfirmed = confirmedRiderIds.includes(rider.id);
                const response = storedSelection?.responses?.[rider.id];
                const confirmedElsewhere = Boolean(slot.nationsCupProfile && Object.entries(selectionState?.selections ?? {}).some(
                  ([key, selection]) => key !== slot.id && key.startsWith("nc-") && selection.confirmedRiderIds?.includes(rider.id),
                ));
                const limitReached = !isSelected && selected.length >= slot.limit;
                const climateProfile = getRiderClimateProfile({ riderId: rider.id, countryCode });
                const weatherAdjustment = publishedWeather ? getRaceClimatePerformanceAdjustment(climateProfile, publishedWeather) : 0;
                const selectedSortValue = getFederationSelectionSortValue(rider, { key: sortKey, countryCode, weather: publishedWeather });
                const showSecondarySortValue = !["overall", "weatherAffinity", ...PRIMARY_RATING_COLUMNS.map((column) => column.key)].includes(sortKey);
                return <tr key={rider.id} className={isConfirmed ? "bg-[#EEF3F1] text-[#60756E]" : isSelected ? "bg-[#E8F7F1]" : "bg-white"}><td className="px-5 py-4"><input type="checkbox" checked={isSelected} disabled={!canManage || !deadlineOpen || isConfirmed || confirmedElsewhere || limitReached} onChange={() => toggleRider(rider.id)} aria-label={`Sélectionner ${rider.name}`} className="h-5 w-5 accent-[var(--federation-secondary)]" /></td><td className="px-3 py-4"><p className="font-black text-[#183F37]">{rider.name}</p><p className="mt-1 text-xs font-semibold text-[#60756E]">{rider.age} ans · {rider.category === "junior" ? "Junior" : "Pro"}</p>{showSecondarySortValue ? <p className="mt-2 inline-flex rounded-full bg-[#FFF5C8] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#745B00]">{getFederationSelectionSortLabel(sortKey)} · {formatRating(selectedSortValue)}</p> : null}</td><td className="max-w-56 px-3 py-4 text-sm font-bold text-[#526B62]"><p>{rider.teamName}</p>{rider.juniorAffiliation ? <span className="mt-1 inline-flex rounded-full bg-[#EEF3F1] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#315B3E]">{rider.juniorAffiliation === "development_team" ? "DevTeam" : "École de cyclisme"}</span> : null}</td><td className="px-3 py-4"><span className="rounded-full bg-[#EEF3F1] px-3 py-1 text-xs font-black text-[#315B3E]">{rider.profile}</span></td>{PRIMARY_RATING_COLUMNS.map((column) => <td key={column.key} className={`px-2 py-4 text-center font-black ${sortKey === column.key ? "bg-[#FFF9DE] text-[#745B00]" : "text-[#183F37]"}`}>{formatRating(rider.ratings[column.key])}</td>)}<td className={`px-3 py-4 text-center text-base font-black ${sortKey === "overall" ? "bg-[#FFF9DE] text-[#745B00]" : "text-[var(--federation-secondary)]"}`}>{formatRating(rider.overall)}</td><td className={`min-w-48 px-3 py-4 ${sortKey === "weatherAffinity" ? "bg-[#FFF9DE]" : ""}`}><RiderClimateAffinities profile={climateProfile} adjustment={publishedWeather && rider.category === "professional" && forecast?.isOfficialCourse ? weatherAdjustment : null} /></td><td className="px-5 py-4 text-xs font-bold text-[#806300]">{isConfirmed ? "Participation confirmée · verrouillée" : confirmedElsewhere ? "Confirmé sur un autre profil" : response === "pending" ? "Réponse du DS attendue" : response === "declined" ? "Refusé par le DS" : isSelected ? "Brouillon · non envoyé" : "—"}</td></tr>;
              })}
            </tbody>
          </table>
          {filteredRiders.length === 0 ? <p className="px-5 py-10 text-center text-sm font-semibold text-[#60756E]">Aucun coureur ne correspond aux filtres.</p> : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-[#315B3E]/10 bg-[#F8FBF9] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-xs font-semibold leading-5 text-[#60756E]">
            Les juniors sont gérés ici : les DS n’auront plus d’inscription
            directe depuis leur DevTeam. Un coureur {slot.competition === "Jeux quadriennaux" ? "des Jeux quadriennaux" : "Nations Cup"} ne peut
            être retenu que sur un seul profil.
          </p>
          {canManage ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <form action={saveAction}>
                <input type="hidden" name="countryCode" value={countryCode} />
                <input type="hidden" name="slotKey" value={slot.id} />
                <input type="hidden" name="riderIds" value={JSON.stringify(selected)} />
                <button type="submit" disabled={savePending || !deadlineOpen} className="min-h-11 rounded-xl border border-[var(--federation-secondary)]/25 bg-white px-5 text-sm font-black text-[var(--federation-secondary)] disabled:cursor-wait disabled:opacity-60">
                  {savePending ? "Enregistrement…" : "Enregistrer le brouillon"}
                </button>
              </form>
              <form action={publishAction}>
                <input type="hidden" name="countryCode" value={countryCode} />
                <input type="hidden" name="slotKey" value={slot.id} />
                <button type="submit" disabled={publishPending || !storedSelection || !deadlineOpen} className="min-h-11 rounded-xl bg-[var(--federation-primary)] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#9AA9A3]">
                  {publishPending ? "Envoi…" : "Soumettre aux DS"}
                </button>
              </form>
            </div>
          ) : (
            <button type="button" disabled className="min-h-11 shrink-0 cursor-not-allowed rounded-xl bg-[#9AA9A3] px-5 text-sm font-black text-white">
              {gameYear < 3 ? "Enregistrer en S3" : "Réservé au président"}
            </button>
          )}
        </div>
        {canManage && (saveState.message || publishState.message) ? (
          <p role="status" className={`border-t border-[#315B3E]/10 px-5 py-3 text-xs font-black ${saveState.status === "error" || publishState.status === "error" ? "bg-[#FBE3DE] text-[#9D3E37]" : "bg-[#E8F7F1] text-[var(--federation-secondary)]"}`}>
            {publishState.message || saveState.message}
          </p>
        ) : null}
        </fieldset>
      </section>
      {automaticSelection ? (
        <p className="rounded-2xl border border-[#315B3E]/12 bg-white px-5 py-4 text-sm font-bold text-[#526B62]">
          La composition des listes est verrouillée en mode automatique. Les parcours restent consultables.
        </p>
      ) : null}
    </div>
  );
}

function SelectionMaturityMetric({
  value,
  label,
  tone = "neutral",
}: {
  value: number;
  label: string;
  tone?: "neutral" | "confirmed" | "pending";
}) {
  const toneClass =
    tone === "confirmed"
      ? "text-[#176951]"
      : tone === "pending"
        ? "text-[#9A6A00]"
        : "text-[#183F37]";

  return (
    <span className="min-w-0">
      <span className={`block text-xl font-black ${toneClass}`}>{value}</span>
      <span className="mt-0.5 block text-[9px] font-black uppercase leading-4 tracking-[0.08em] text-[#70827B]">
        {label}
      </span>
    </span>
  );
}

function getSlotHostingEventType(
  slotId: string,
  gameYear: number,
): FederationHostingEventType | null {
  if (slotId.startsWith("cc-pro-")) return "continental_championship_pro";
  if (slotId.startsWith("cc-junior-"))
    return "continental_championship_junior";
  if (slotId.startsWith("world-pro-")) return "world_championship_pro";
  if (slotId.startsWith("world-junior-"))
    return "world_championship_junior";
  if (slotId === "nc-junior-road") return "nations_cup_junior";
  if (slotId.startsWith("nc-"))
    return gameYear % 4 === 0
      ? "quadrennial_games_pro"
      : "nations_cup_pro";
  return null;
}

function SelectionWeatherSummary({
  forecast,
  gameYear,
}: {
  forecast: FederationSelectionForecast | null;
  gameYear: number;
}) {
  if (!forecast) {
    return (
      <div className="min-w-52 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
          Météo fédérale
        </p>
        <p className="mt-1 text-xs font-bold text-white">
          Prévision en attente du calendrier
        </p>
      </div>
    );
  }

  if (!forecast.weather) {
    return (
      <div className="min-w-52 rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#BFD1C6]">
          Météo fédérale · sans centre météo
        </p>
        <p className="mt-1 text-sm font-black text-white">
          Disponible {forecast.gameYear > gameYear ? `en S${forecast.gameYear} · ` : ""}J{forecast.revealDayNumber}
        </p>
        <p className="mt-1 text-[10px] font-semibold text-[#D6DFD2]">
          À l’ouverture de la fenêtre de convocation
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-56 rounded-2xl border border-[#F2C94C]/35 bg-white/10 px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#F2C94C]">
        Prévision fédérale · {forecast.isOfficialCourse ? "parcours officiel" : "créneau officiel"}
      </p>
      <p className="mt-1 text-sm font-black text-white">
        {getRaceWeatherLabel(forecast.weather)} · {forecast.weather.temperatureC} °C
      </p>
      <p className="mt-1 text-[10px] font-semibold text-[#D6DFD2]">
        {getRaceWindLabel(forecast.weather.windDirection)} · {forecast.weather.windSpeedKph} km/h
      </p>
    </div>
  );
}

function SortableRatingHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  disabled = false,
  wide = false,
}: {
  label: string;
  sortKey: FederationSelectionSortKey;
  activeSortKey: FederationSelectionSortKey;
  direction: FederationSelectionSortDirection;
  onSort: (key: FederationSelectionSortKey) => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th className={`${wide ? "min-w-48" : ""} px-2 py-2 text-center`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(sortKey)}
        title={
          disabled
            ? "Disponible lorsque la prévision est publiée"
            : `Trier par ${label}`
        }
        className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-lg px-2 transition ${
          isActive
            ? "bg-[#DCEFE7] text-[#176951]"
            : disabled
              ? "cursor-not-allowed text-[#A3AEA9]"
              : "hover:bg-[#E5F4ED] hover:text-[#176951]"
        }`}
      >
        {label}
        {isActive ? (
          <span aria-hidden="true">
            {direction === "descending" ? "↓" : "↑"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function RiderClimateAffinities({
  profile,
  adjustment,
}: {
  profile: RiderClimateProfile;
  adjustment: number | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        title="Condition favorite"
        className="inline-flex items-center gap-1 rounded-full bg-[#E5F4ED] px-2 py-1 text-[9px] font-black text-[#176951]"
      >
        <RiderClimateIcon preference={profile.strength} className="h-3.5 w-3.5" />
        + {RIDER_CLIMATE_LABELS[profile.strength]}
      </span>
      <span
        title="Condition difficile"
        className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EE] px-2 py-1 text-[9px] font-black text-[#8A2F2F]"
      >
        <RiderClimateIcon preference={profile.weakness} className="h-3.5 w-3.5" />
        − {RIDER_CLIMATE_LABELS[profile.weakness]}
      </span>
      {adjustment !== null ? (
        <span
          className={`rounded-full px-2 py-1 text-[9px] font-black ${
            adjustment > 0
              ? "bg-[#176951] text-white"
              : adjustment < 0
                ? "bg-[#8A2F2F] text-white"
                : "bg-[#EEF3F1] text-[#526B62]"
          }`}
        >
          Impact {adjustment > 0 ? "+" : ""}{formatRating(adjustment)}
        </span>
      ) : null}
    </div>
  );
}

function SelectionAutomaticModeControl({
  countryCode,
  canManage,
  checked,
  onChange,
}: {
  countryCode: string;
  canManage: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const control = (
    <label className="flex cursor-pointer items-start gap-4">
      <input
        type="checkbox"
        name="automatic"
        checked={checked}
        disabled={!canManage}
        onChange={(event) => {
          onChange(event.target.checked);
          event.currentTarget.form?.requestSubmit();
        }}
        className="mt-1 h-6 w-6 shrink-0 accent-[var(--federation-secondary)]"
      />
      <span>
        <span className="block text-base font-black text-[#183F37]">
          Sélection automatique
        </span>
        <span className="mt-1 block text-sm font-semibold leading-6 text-[#526B62]">
          Activée par défaut pour éviter tout oubli. Le président doit la
          décocher pour composer et publier lui-même les listes.
        </span>
      </span>
    </label>
  );

  return canManage ? (
    <form action={setFederationAutomaticSelectionAction}>
      <input type="hidden" name="countryCode" value={countryCode} />
      {control}
    </form>
  ) : (
    control
  );
}

function PendingConfirmationPanel({
  countryCode,
  confirmations,
  riders,
  gameYear,
}: {
  countryCode: string;
  confirmations: FederationSelectionState["pendingConfirmations"];
  riders: FederationSelectionRider[];
  gameYear: number;
}) {
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const slotById = new Map(
    getFederationSelectionSlots(gameYear).map((slot) => [slot.id, slot]),
  );

  return (
    <section className="rounded-[2rem] border border-[#D5AC18]/35 bg-[#FFF9DE] p-6 shadow-[0_14px_36px_rgba(100,75,0,0.08)] sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#806300]">
        Confirmation de votre équipe
      </p>
      <h2 className="mt-2 text-2xl font-black text-[#4A3A00]">
        {confirmations.length} disponibilité{confirmations.length > 1 ? "s" : ""} à confirmer
      </h2>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {confirmations.map((confirmation) => {
          const rider = riderById.get(confirmation.riderId);
          const slot = slotById.get(confirmation.slotKey);
          return (
            <article key={confirmation.memberId} className="rounded-2xl border border-[#D5AC18]/25 bg-white p-5">
              <p className="font-black text-[#183F37]">{rider?.name ?? "Coureur sélectionné"}</p>
              <p className="mt-1 text-xs font-bold text-[#60756E]">{slot?.label ?? confirmation.slotKey}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={respondFederationPreselectionAction}>
                  <input type="hidden" name="countryCode" value={countryCode} />
                  <input type="hidden" name="memberId" value={confirmation.memberId} />
                  <input type="hidden" name="decision" value="confirm" />
                  <button type="submit" className="min-h-10 rounded-xl bg-[var(--federation-secondary)] px-4 text-xs font-black text-white">Confirmer</button>
                </form>
                <form action={respondFederationPreselectionAction}>
                  <input type="hidden" name="countryCode" value={countryCode} />
                  <input type="hidden" name="memberId" value={confirmation.memberId} />
                  <input type="hidden" name="decision" value="decline" />
                  <button type="submit" className="min-h-10 rounded-xl border border-[#B94848]/25 bg-[#FFF1EF] px-4 text-xs font-black text-[#9A3434]">Refuser</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}
