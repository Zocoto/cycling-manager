"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import type { RaceCalendarEdition, RaceCalendarStage } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import { createCalendarSimulationInput } from "@/lib/game/race-simulation-demo";
import {
  buildStageRaceStandings,
  getFinalBattleRiderIds,
  RACE_ROLE_LABELS,
  simulateRaceStage,
  type RaceGroupSnapshot,
  type RaceIncident,
  type RiderSimulationInput,
} from "@/lib/game/race-simulation";

type LabTab = "live" | "classification" | "rules";
type PlaybackSpeed = 1 | 2 | 4;

const REPLAY_STEP_DURATION_MS = 6_000;
const FINISH_LINE_REVEAL_METERS = 750;

export function RaceLiveLab({
  edition,
  stage,
  mode,
  nowIso,
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  mode: "live" | "replay";
  nowIso: string;
}) {
  const { input, simulation, tourStandings } = useMemo(() => {
    const currentInput = createCalendarSimulationInput({
      edition,
      stage,
      seed: `${edition.id}:${stage.id}:official`,
    });

    if (edition.raceFormat !== "stage_race") {
      return {
        input: currentInput,
        simulation: simulateRaceStage(currentInput),
        tourStandings: null,
      };
    }

    const unavailableRiderIds = new Set<string>();
    const stageResults = [];
    let selectedInput = currentInput;
    let selectedSimulation = simulateRaceStage(currentInput);

    for (const candidateStage of edition.stages) {
      const candidateInput = createCalendarSimulationInput({
        edition,
        stage: candidateStage,
        seed: `${edition.id}:${candidateStage.id}:official`,
      });
      const candidateSimulation = simulateRaceStage({
        ...candidateInput,
        unavailableRiderIds: [...unavailableRiderIds],
      });
      stageResults.push(candidateSimulation);

      for (const result of candidateSimulation.results) {
        if (result.status === "did_not_finish") {
          unavailableRiderIds.add(result.riderId);
        }
      }

      if (candidateStage.id === stage.id) {
        selectedInput = candidateInput;
        selectedSimulation = candidateSimulation;
        break;
      }
    }

    return {
      input: selectedInput,
      simulation: selectedSimulation,
      tourStandings: buildStageRaceStandings(stageResults),
    };
  }, [edition, stage]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(mode === "live");
  const [playbackSpeed, setPlaybackSpeed] =
    useState<PlaybackSpeed>(1);
  const [finalMetersRemaining, setFinalMetersRemaining] = useState(
    () => Math.round((stage.segments.at(-1)?.distanceKm ?? 0) * 1_000)
  );
  const finalMetersRemainingRef = useRef(finalMetersRemaining);
  const [tab, setTab] = useState<LabTab>("live");
  const [clock, setClock] = useState(() => new Date(nowIso));
  const riderById = useMemo(
    () => new Map(simulation.resolvedRiders.map((rider) => [rider.id, rider])),
    [simulation.resolvedRiders]
  );
  const liveState = getStageLiveState(stage, clock);
  const liveIndex =
    liveState.status === "live"
      ? Math.min(
          simulation.timeline.length - 1,
          Math.floor(liveState.progress * simulation.timeline.length)
        )
      : simulation.timeline.length - 1;
  const displayedIndex = mode === "live" ? liveIndex : activeIndex;
  const snapshot = simulation.timeline[displayedIndex];

  useEffect(() => {
    if (mode !== "live") return;

    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, [mode]);

  useEffect(() => {
    finalMetersRemainingRef.current = finalMetersRemaining;
  }, [finalMetersRemaining]);

  useEffect(() => {
    if (mode === "live") return;
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= simulation.timeline.length - 1) {
          setFinalMetersRemaining(0);
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, REPLAY_STEP_DURATION_MS / playbackSpeed);

    return () => window.clearInterval(timer);
  }, [
    isPlaying,
    mode,
    playbackSpeed,
    simulation.timeline.length,
  ]);

  const distance = input.segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0
  );
  const isFinal = displayedIndex === simulation.timeline.length - 1;
  const isRoad = input.stageType === "road";
  const activeSegment = input.segments[displayedIndex];
  const finalSegment = input.segments.at(-1)!;
  const breakawayStillAhead = simulation.timeline.at(-1)?.groups.some((group) => group.type === "breakaway") ?? false;
  const finalBattleRiderIds = getFinalBattleRiderIds(simulation);
  const isMassSprint = finalBattleRiderIds.length > 10;
  const finalSegmentMeters = Math.round(finalSegment.distanceKm * 1_000);
  const liveFinalProgress = Math.max(
    0,
    Math.min(
      1,
      liveState.progress * simulation.timeline.length -
        (simulation.timeline.length - 1)
    )
  );
  const displayedFinalMeters =
    mode === "live"
      ? Math.round(finalSegmentMeters * (1 - liveFinalProgress))
      : finalMetersRemaining;

  useEffect(() => {
    if (mode !== "replay" || !isFinal || !isPlaying) return;

    const startedAt = Date.now();
    const startedWithMeters = finalMetersRemainingRef.current;
    const durationMs =
      (REPLAY_STEP_DURATION_MS / playbackSpeed) *
      (startedWithMeters / Math.max(1, finalSegmentMeters));
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      setFinalMetersRemaining(
        Math.max(0, Math.round(startedWithMeters * (1 - progress)))
      );
    }, 100);

    return () => window.clearInterval(timer);
  }, [finalSegmentMeters, isFinal, isPlaying, mode, playbackSpeed]);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-[#071A17] text-[#FFFDF4] shadow-[0_30px_80px_rgba(7,26,23,0.22)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(66,185,154,0.2),transparent_38%)] px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
              {mode === "live" ? "● Direct · diffusion synchronisée" : "Replay · résultat simulé"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {input.name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {formatDistance(distance)} km · {input.segments.length} tronçons · environ {getStageLiveState(stage, clock).durationMinutes} min de direct
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#C1D3CA]">
              Profil officiel du calendrier
            </span>
            <span className="rounded-full border border-[#F2C94C]/25 bg-[#F2C94C]/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#E9D98B]">
              Peloton de calibration
            </span>
            {mode === "replay" ? (
            <button
              type="button"
              onClick={() => {
                setActiveIndex(0);
                setFinalMetersRemaining(finalSegmentMeters);
                setIsPlaying(true);
                setTab("live");
              }}
              className="min-h-11 rounded-xl bg-[#F2C94C] px-4 text-xs font-black uppercase tracking-wide text-[#17261E] transition hover:bg-[#F7DA73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              ▶ Revoir depuis le départ
            </button>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-white/10 px-5 pt-3 sm:px-8" aria-label="Vues du moteur de course">
        <TabButton active={tab === "live"} onClick={() => setTab("live")}>Live</TabButton>
        <TabButton active={tab === "classification"} onClick={() => setTab("classification")}>
          Classement
        </TabButton>
        <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
          Règles actives
        </TabButton>
      </nav>

      {tab === "live" ? (
        <div className="p-5 sm:p-8">
          <RaceStageProfile
            segments={input.segments}
            activeSegmentNumber={activeSegment.segmentNumber}
            tone="dark"
            showLegend
            onSelectSegment={
              mode === "replay"
                ? (segmentNumber) => {
                    setActiveIndex(segmentNumber - 1);
                    setFinalMetersRemaining(finalSegmentMeters);
                    setIsPlaying(false);
                  }
                : undefined
            }
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {mode === "replay" ? <button
                type="button"
                onClick={() => {
                  if (isFinal && !isPlaying) {
                    setActiveIndex(0);
                    setFinalMetersRemaining(finalSegmentMeters);
                    setIsPlaying(true);
                    return;
                  }
                  setIsPlaying((current) => !current);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#72D4B7]/45 bg-[#72D4B7]/10 px-4 text-xs font-black uppercase tracking-wide text-[#9BE0CA] transition hover:bg-[#72D4B7]/20"
              >
                <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
                {isPlaying ? "Pause" : isFinal ? "Revoir" : "Lire la course"}
              </button> : (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#EF5B65]/45 bg-[#EF5B65]/10 px-4 text-xs font-black uppercase tracking-wide text-[#FF9EA6]">
                  <span className="animate-pulse">●</span> En direct
                </span>
              )}
              {mode === "replay" ? (
                <PlaybackSpeedControl
                  value={playbackSpeed}
                  onChange={setPlaybackSpeed}
                />
              ) : null}
              <span className="text-xs font-bold text-[#AFC6BB]">
                Tronçon {snapshot.segmentNumber}/{input.segments.length} · {formatDistance(snapshot.completedDistanceKm)} km
              </span>
            </div>
            <p className="text-[11px] font-semibold text-[#7E9B8F]">
              Survolez un groupe ou un coureur pour l’identifier.
            </p>
          </div>

          {isFinal && isRoad && isMassSprint ? (
            <SprintLaneView
              simulation={simulation}
              riderById={riderById}
              metersRemaining={displayedFinalMeters}
              finalSegmentMeters={finalSegmentMeters}
              battleRiderIds={finalBattleRiderIds}
            />
          ) : isFinal && isRoad ? (
            <FinishBattleView
              simulation={simulation}
              riderById={riderById}
              segment={finalSegment}
              breakawayStillAhead={breakawayStillAhead}
              metersRemaining={displayedFinalMeters}
              finalSegmentMeters={finalSegmentMeters}
              battleRiderIds={finalBattleRiderIds}
            />
          ) : (
            <RoadScene
              snapshot={snapshot}
              riderById={riderById}
              segment={activeSegment}
              isMoving={mode === "live" || isPlaying}
            />
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
            <GroupDetails groups={snapshot.groups} riderById={riderById} />
            <RaceCommentary commentary={snapshot.commentary} />
          </div>
        </div>
      ) : tab === "classification" ? (
        mode === "live" ? (
          <LiveClassification snapshot={snapshot} riderById={riderById} />
        ) : (
          <Classification
            simulation={simulation}
            riderById={riderById}
            tourStandings={tourStandings}
          />
        )
      ) : (
        <ActiveRules stageType={input.stageType} />
      )}
    </section>
  );
}

function PlaybackSpeedControl({
  value,
  onChange,
}: {
  value: PlaybackSpeed;
  onChange: (speed: PlaybackSpeed) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-white/15 bg-white/[0.055] p-1"
      aria-label="Vitesse du replay"
    >
      {([1, 2, 4] as const).map((speed) => (
        <button
          key={speed}
          type="button"
          onClick={() => onChange(speed)}
          aria-pressed={value === speed}
          className={`min-h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition ${
            value === speed
              ? "bg-[#F2C94C] text-[#17261E]"
              : "text-[#AFC6BB] hover:bg-white/10 hover:text-white"
          }`}
        >
          ×{speed}
        </button>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
        active
          ? "border-[#F2C94C] text-[#F2C94C]"
          : "border-transparent text-[#8FA99D] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function RoadScene({
  snapshot,
  riderById,
  segment,
  isMoving,
}: {
  snapshot: ReturnType<typeof simulateRaceStage>["timeline"][number];
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  isMoving: boolean;
}) {
  const groups = snapshot.groups.slice(0, 6);
  const visualGradient = Math.max(
    -9,
    Math.min(9, segment.averageGradientPct)
  );
  const roadLeftPct = 64 + visualGradient * 1.25;
  const roadRightPct = 64 - visualGradient * 1.25;
  const sky =
    segment.terrain === "climb"
      ? "bg-[linear-gradient(#83C0D0_0_40%,#7FAE72_40%_100%)]"
      : segment.terrain === "descent"
        ? "bg-[linear-gradient(#9ACFDA_0_47%,#A7C585_47%_100%)]"
        : "bg-[linear-gradient(#8FD1DC_0_46%,#A7C585_46%_100%)]";

  return (
    <div className={`relative mt-6 h-72 overflow-hidden rounded-3xl border border-white/10 shadow-inner shadow-black/25 ${sky}`}>
      <div aria-hidden="true" className="absolute left-8 top-7 h-16 w-16 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <div aria-hidden="true" className={`absolute inset-x-0 bottom-[35%] flex gap-20 opacity-35 ${isMoving ? "cm-race-scenery" : ""}`}>
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className="block h-12 w-4 shrink-0 rounded-t-full bg-[#244C38] shadow-[0_18px_0_8px_#244C38]" />
        ))}
      </div>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={`M 0 ${roadLeftPct} L 100 ${roadRightPct} L 100 100 L 0 100 Z`}
          fill="#35453F"
        />
        <path
          d={`M -5 ${roadLeftPct + 12} L 105 ${roadRightPct + 12}`}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="0.7"
          strokeDasharray="3 2"
          vectorEffect="non-scaling-stroke"
          className={isMoving ? "cm-race-road-flow" : ""}
        />
        <path
          d={`M 0 ${roadLeftPct} L 100 ${roadRightPct}`}
          fill="none"
          stroke="rgba(255,255,255,0.38)"
          strokeWidth="0.55"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="absolute right-4 top-4 rounded-full bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
        {terrainLabel(segment.terrain)} {segment.averageGradientPct ? `${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %` : ""} · {formatDistance(snapshot.completedDistanceKm)} km
      </p>

      <RaceIncidentOverlay
        incidents={snapshot.incidents}
        riderById={riderById}
      />

      {groups.map((group, groupIndex) => {
        const left = getGroupScreenPosition(group, groupIndex, groups.length);
        const roadTopPct =
          roadLeftPct + (roadRightPct - roadLeftPct) * (left / 100);
        const visibleRiderIds = getVisibleRiderIds({
          group,
          incidents: snapshot.incidents,
          riderById,
        });
        return (
          <div
            key={group.id}
            className="absolute -translate-x-1/2 -translate-y-full transition-[left,top] duration-700 ease-out"
            style={{
              left: `${left}%`,
              top: `${roadTopPct + 2}%`,
              zIndex: 20 - groupIndex,
            }}
            title={group.riderIds.map((id) => riderById.get(id)?.name).filter(Boolean).join(", ")}
          >
            <div className="mb-2 whitespace-nowrap rounded-full bg-[#071A17]/85 px-2.5 py-1 text-center text-[10px] font-black text-white shadow-lg backdrop-blur">
              {group.label} {group.gapToLeaderSeconds > 0 ? `+${formatGap(group.gapToLeaderSeconds)}` : ""}
            </div>
            <div className="flex -space-x-3">
              {visibleRiderIds.map((riderId, riderIndex) => {
                const rider = riderById.get(riderId)!;
                const incidentRider = snapshot.incidents.some(
                  (incident) => incident.riderIds.includes(riderId)
                );
                const showName =
                  incidentRider ||
                  group.riderIds.length <= 3 ||
                  riderIndex < 2;

                return (
                  <span key={riderId} className="relative">
                    <SideCyclist rider={rider} isMoving={isMoving} />
                    {showName ? (
                      <span
                        className={`absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[8px] font-black shadow ${
                          incidentRider
                            ? "bg-[#EF5B65] text-white"
                            : "bg-[#071A17]/88 text-white"
                        }`}
                      >
                        {getRiderShortName(rider.name)}
                      </span>
                    ) : null}
                  </span>
                );
              })}
              {group.riderIds.length > 5 ? (
                <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-[#071A17] text-[9px] font-black shadow-[-6px_0_0_rgba(7,26,23,0.72),-12px_0_0_rgba(7,26,23,0.45)]">
                  +{group.riderIds.length - 5}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RaceIncidentOverlay({
  incidents,
  riderById,
}: {
  incidents: RaceIncident[];
  riderById: Map<string, RiderSimulationInput>;
}) {
  const incident = incidents[0];
  if (!incident) return null;

  const affectedNames = incident.riderIds
    .slice(0, 3)
    .map((riderId) => riderById.get(riderId)?.name)
    .filter(Boolean)
    .join(", ");
  const icon = {
    puncture: "◉",
    crosswind: "≋",
    crash_individual: "⚠",
    crash_mass: "⚠",
  }[incident.type];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute left-1/2 top-[28%] z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-white shadow-2xl backdrop-blur cm-race-incident ${
        incident.type === "crosswind"
          ? "border-[#72D4B7]/45 bg-[#0B4A3B]/90"
          : "border-[#FF9EA6]/50 bg-[#531F27]/90"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mx-auto block text-2xl leading-none ${
          incident.type === "puncture"
            ? "cm-incident-wheel"
            : incident.type === "crosswind"
              ? "cm-incident-wind"
              : "cm-incident-crash"
        }`}
      >
        {icon}
      </span>
      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#FFF4C4]">
        {incident.label}
      </p>
      {affectedNames ? (
        <p className="mt-1 max-w-64 truncate text-[9px] font-bold text-white/75">
          {affectedNames}
        </p>
      ) : null}
    </div>
  );
}

function getVisibleRiderIds({
  group,
  incidents,
  riderById,
}: {
  group: RaceGroupSnapshot;
  incidents: RaceIncident[];
  riderById: Map<string, RiderSimulationInput>;
}) {
  const incidentRiderIds = new Set(
    incidents.flatMap((incident) => incident.riderIds)
  );
  const rolePriority: Record<RiderSimulationInput["role"], number> = {
    leader: 5,
    sprinter: 4,
    free_agent: 3,
    mountain_classification: 3,
    leadout: 2,
    domestique: 1,
    auto: 0,
  };

  return [...group.riderIds]
    .sort((firstId, secondId) => {
      const first = riderById.get(firstId);
      const second = riderById.get(secondId);
      const firstScore =
        (incidentRiderIds.has(firstId) ? 100 : 0) +
        (first ? rolePriority[first.role] : 0);
      const secondScore =
        (incidentRiderIds.has(secondId) ? 100 : 0) +
        (second ? rolePriority[second.role] : 0);
      return secondScore - firstScore;
    })
    .slice(0, 5);
}

function getRiderShortName(name: string) {
  return name.split(" ").at(-1) ?? name;
}

function SideCyclist({
  rider,
  isMoving = true,
  className = "h-10 w-14",
}: {
  rider: RiderSimulationInput;
  isMoving?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 54 38"
      role="img"
      aria-label={rider.name}
      className={`${className} drop-shadow-md ${isMoving ? "cm-bike-bob" : ""}`}
    >
      <circle className={isMoving ? "cm-bike-wheel" : ""} cx="12" cy="29" r="8" fill="none" stroke="#E7EEE9" strokeWidth="2" strokeDasharray="3 2" />
      <circle className={isMoving ? "cm-bike-wheel" : ""} cx="42" cy="29" r="8" fill="none" stroke="#E7EEE9" strokeWidth="2" strokeDasharray="3 2" />
      <path d="M12 29 23 18l8 11H12l9-14 11 2 10 12" fill="none" stroke="#D8E3DD" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="29" cy="7" r="4" fill="#E6B18B" />
      <path d="m27 11-7 8 11 2 5-8Z" fill={rider.teamPrimaryColor} stroke={rider.teamSecondaryColor} strokeWidth="1.5" />
      <path d="m32 13 8 2" stroke="#E6B18B" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function getGroupScreenPosition(
  group: RaceGroupSnapshot,
  groupIndex: number,
  groupCount: number
) {
  if (groupIndex === 0) return 84;

  const evenlySpaced = 84 - groupIndex * (groupCount <= 3 ? 28 : 18);
  const gapDetail = Math.min(10, Math.log2(group.gapToLeaderSeconds + 1) * 1.3);
  return Math.max(10, evenlySpaced - gapDetail);
}

function selectVisibleSprintFinalists(
  finalists: ReturnType<typeof simulateRaceStage>["results"],
  riderById: Map<string, RiderSimulationInput>
) {
  const teams = new Map<string, typeof finalists>();

  for (const result of finalists) {
    const teamId = riderById.get(result.riderId)?.teamId;
    if (!teamId) continue;
    teams.set(teamId, [...(teams.get(teamId) ?? []), result]);
  }

  const leadingTeams = [...teams.values()]
    .sort(
      (first, second) =>
        (first[0]?.rank ?? 999) - (second[0]?.rank ?? 999)
    )
    .slice(0, 6);
  const rolePriority: Record<RiderSimulationInput["role"], number> = {
    sprinter: 6,
    leadout: 5,
    leader: 4,
    free_agent: 3,
    mountain_classification: 2,
    domestique: 1,
    auto: 0,
  };
  const selected = leadingTeams.flatMap((teamResults) =>
    [...teamResults]
      .sort((first, second) => {
        const firstRider = riderById.get(first.riderId)!;
        const secondRider = riderById.get(second.riderId)!;
        return (
          rolePriority[secondRider.role] - rolePriority[firstRider.role] ||
          (first.rank ?? 999) - (second.rank ?? 999)
        );
      })
      .slice(0, 3)
  );

  return [
    ...new Map(
      [...finalists.slice(0, 6), ...selected].map((result) => [
        result.riderId,
        result,
      ])
    ).values(),
  ]
    .sort(
      (first, second) =>
        (first.rank ?? 999) - (second.rank ?? 999)
    )
    .slice(0, 18);
}

function getMassSprintPhase(metersRemaining: number) {
  if (metersRemaining > 5_000) return "Placement dans les derniers kilomètres";
  if (metersRemaining > 2_000) return "Les trains remontent le peloton";
  if (metersRemaining > 1_000) return "Approche de la flamme rouge";
  if (metersRemaining > 300) return "Poissons-pilotes en action";
  if (metersRemaining > 0) return "Sprint lancé";
  return "Ligne franchie";
}

function getSmallGroupFinishPhase(metersRemaining: number) {
  if (metersRemaining > 3_000) return "Observation dans le groupe de tête";
  if (metersRemaining > 1_500) return "Premières attaques pour la victoire";
  if (metersRemaining > 500) return "Les accélérations se succèdent";
  if (metersRemaining > 0) return "Duel jusqu’à la ligne";
  return "Victoire arrachée";
}

function getVisualSeedNumber(seed: string) {
  return [...seed].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7
  );
}

function SprintLaneView({
  simulation,
  riderById,
  metersRemaining,
  finalSegmentMeters,
  battleRiderIds,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
  metersRemaining: number;
  finalSegmentMeters: number;
  battleRiderIds: string[];
}) {
  const battleRiderSet = new Set(battleRiderIds);
  const finalists = simulation.results
    .filter(
      (result) =>
        result.status === "finished" &&
        battleRiderSet.has(result.riderId)
    );
  const visibleFinalists = selectVisibleSprintFinalists(
    finalists,
    riderById
  );
  const teamIds = [
    ...new Set(
      visibleFinalists.map(
        (result) => riderById.get(result.riderId)!.teamId
      )
    ),
  ];
  const finalProgress = Math.max(
    0,
    Math.min(1, 1 - metersRemaining / Math.max(1, finalSegmentMeters))
  );
  const sprintProgress = Math.max(
    0,
    Math.min(1, (1_200 - metersRemaining) / 1_200)
  );
  const showFinishLine = metersRemaining <= FINISH_LINE_REVEAL_METERS;
  const hasFinished = metersRemaining <= 0;
  const phaseLabel = getMassSprintPhase(metersRemaining);
  const isPhotoFinish = getVisualSeedNumber(simulation.seed) % 3 === 0;

  return (
    <div className="relative mt-6 h-80 overflow-hidden rounded-3xl border border-white/10 bg-[#2F3B37] shadow-inner shadow-black/40">
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-[84%] z-10 w-3 bg-[repeating-linear-gradient(0deg,#fff_0_8px,#17261E_8px_16px)] shadow-[0_0_24px_rgba(255,255,255,0.45)] transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute left-[84%] top-0 z-30 -translate-x-[42%] rounded-b-lg bg-[#FFFDF4] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#17261E] shadow-lg transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}>
        Arrivée
      </div>
      <FinishDistanceCounter metersRemaining={metersRemaining} />
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-white/20"
          style={{ top: `${18 + index * 16}%` }}
        />
      ))}
      <div className="absolute left-4 top-4 z-20 max-w-[55%] rounded-xl bg-[#071A17]/86 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          {phaseLabel}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#C1D3CA]">
          {teamIds.length} trains en place · {battleRiderIds.length} coureurs dans le groupe de tête
        </p>
        {hasFinished && isPhotoFinish ? (
          <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#FFF4C4]">
            Photo-finish · victoire au coude-à-coude
          </p>
        ) : null}
      </div>
      <div aria-hidden="true" className="absolute inset-y-0 left-[16%] w-40 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] cm-sprint-wind" />

      {visibleFinalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const teamIndex = teamIds.indexOf(rider.teamId);
        const teamMembers = visibleFinalists.filter(
          (candidate) =>
            riderById.get(candidate.riderId)?.teamId === rider.teamId
        );
        const teamMemberIndex = teamMembers.findIndex(
          (candidate) => candidate.riderId === result.riderId
        );
        const lane = teamIndex % 6;
        const roleOffset =
          rider.role === "leadout"
            ? 5
            : rider.role === "sprinter"
              ? 1.5
              : -teamMemberIndex * 2.1;
        const trainPosition =
          27 + teamIndex * 3.8 + finalProgress * 31 + roleOffset;
        const finishPosition =
          88 -
          (index === 1 && isPhotoFinish ? 0.24 : index * 0.7) -
          (index >= 8 ? 2.2 : 0);
        const battleMovement =
          Math.sin(finalProgress * 18 + index * 1.7) *
          2.4 *
          (1 - sprintProgress);
        const left = Math.max(
          14,
          Math.min(
            90,
            trainPosition * (1 - sprintProgress) +
              finishPosition * sprintProgress +
              battleMovement
          )
        );
        return (
          <div
            key={result.riderId}
            className="absolute z-20 transition-[left,top] duration-300 ease-out"
            style={{
              left: `${left}%`,
              top: `${11 + lane * 13.4 + teamMemberIndex * 1.1}%`,
            }}
            title={`${hasFinished ? `${result.rank}. ` : ""}${rider.name} · ${rider.teamName}`}
          >
            <TopCyclist rider={rider} />
            {hasFinished && result.rank !== null && result.rank <= 3 ? (
              <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/90 px-2 py-1 text-[9px] font-black text-white shadow-lg">
                {result.rank}. {rider.name.split(" ").at(-1)}
              </span>
            ) : null}
            {!hasFinished && teamMemberIndex === 0 ? (
              <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/88 px-2 py-1 text-[8px] font-black text-white/85 shadow-lg">
                Train {rider.teamName}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TopCyclist({ rider }: { rider: RiderSimulationInput }) {
  return (
    <svg viewBox="0 0 66 30" role="img" aria-label={rider.name} className="h-8 w-16 drop-shadow-lg">
      <ellipse cx="11" cy="15" rx="8" ry="3.5" fill="none" stroke="#E7EEE9" strokeWidth="1.5" />
      <ellipse cx="55" cy="15" rx="8" ry="3.5" fill="none" stroke="#E7EEE9" strokeWidth="1.5" />
      <path d="M11 15 28 8l12 7H11l15 7 14-7 15 0" fill="none" stroke="#D8E3DD" strokeWidth="1.5" />
      <ellipse cx="34" cy="15" rx="12" ry="8" fill={rider.teamPrimaryColor} stroke={rider.teamSecondaryColor} strokeWidth="2" />
      <circle cx="45" cy="15" r="4" fill="#E6B18B" />
      <path d="M20 8h9M20 22h9" stroke={rider.teamSecondaryColor} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FinishBattleView({
  simulation,
  riderById,
  segment,
  breakawayStillAhead,
  metersRemaining,
  finalSegmentMeters,
  battleRiderIds,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  breakawayStillAhead: boolean;
  metersRemaining: number;
  finalSegmentMeters: number;
  battleRiderIds: string[];
}) {
  const battleRiderSet = new Set(battleRiderIds);
  const finalists = simulation.results
    .filter(
      (result) =>
        result.status === "finished" &&
        battleRiderSet.has(result.riderId)
    )
    .slice(0, 9);
  const visualGradient = Math.max(
    -9,
    Math.min(9, segment.averageGradientPct)
  );
  const roadLeftY = 224 + visualGradient * 8;
  const roadRightY = 224 - visualGradient * 8;
  const finalProgress = Math.max(
    0,
    Math.min(1, 1 - metersRemaining / Math.max(1, finalSegmentMeters))
  );
  const battleDistance = Math.min(2_400, finalSegmentMeters);
  const battleProgress = Math.max(
    0,
    Math.min(1, (battleDistance - metersRemaining) / battleDistance)
  );
  const showFinishLine = metersRemaining <= FINISH_LINE_REVEAL_METERS;
  const hasFinished = metersRemaining <= 0;

  return (
    <div className="relative mt-6 h-80 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(#8BCAD7_0_45%,#91B879_45%_100%)] shadow-inner shadow-black/30">
      <div aria-hidden="true" className="absolute left-8 top-7 h-14 w-14 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <svg aria-hidden="true" viewBox="0 0 1000 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path
          d={`M -30 ${roadLeftY} L 1030 ${roadRightY} L 1030 320 L -30 320 Z`}
          fill="#35453F"
        />
        <path
          d={`M -30 ${roadLeftY - 26} L 1030 ${roadRightY - 26}`}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="4"
          strokeDasharray="28 24"
          className="cm-finish-road-line"
        />
      </svg>
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-[86%] z-10 w-2 bg-[repeating-linear-gradient(0deg,#FFFDF4_0_7px,#17261E_7px_14px)] shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute left-[86%] top-0 z-30 -translate-x-[42%] rounded-b-lg bg-[#FFFDF4] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#17261E] shadow-lg transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}>
        Arrivée
      </div>
      <FinishDistanceCounter metersRemaining={metersRemaining} />
      <div className="absolute left-4 top-4 z-20 max-w-[55%] rounded-xl bg-[#071A17]/86 px-3 py-2 text-white backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          {getSmallGroupFinishPhase(metersRemaining)}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#C1D3CA]">
          {battleRiderIds.length} coureur{battleRiderIds.length > 1 ? "s" : ""} pour la victoire · {terrainLabel(segment.terrain)} {segment.averageGradientPct > 0 ? "+" : ""}{segment.averageGradientPct} %
        </p>
        {breakawayStillAhead ? (
          <p className="mt-1 text-[9px] font-bold text-[#FFF4C4]">
            L’échappée joue la gagne.
          </p>
        ) : null}
      </div>

      {finalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const earlyOrder =
          finalists.length > 1
            ? (index * 3 + 2) % finalists.length
            : 0;
        const earlyPosition =
          34 + (finalists.length - earlyOrder) * 4.2;
        const finishPosition =
          88 - index * 1.65 - (index >= 4 ? (index - 3) * 1.4 : 0);
        const attackMovement =
          Math.sin(finalProgress * 22 + index * 2.1) *
          4.6 *
          (1 - battleProgress);
        const left = Math.max(
          18,
          Math.min(
            90,
            earlyPosition * (1 - battleProgress) +
              finishPosition * battleProgress +
              attackMovement
          )
        );
        const roadY =
          roadLeftY + (roadRightY - roadLeftY) * (left / 100);
        return (
          <div
            key={result.riderId}
            className="absolute z-20 -translate-x-1/2 -translate-y-full transition-[left,top] duration-300 ease-out"
            style={{
              left: `${left}%`,
              top: `${(roadY / 320) * 100 + 2}%`,
            }}
            title={`${hasFinished ? `${result.rank}. ` : ""}${rider.name} · ${rider.teamName}`}
          >
            <SideCyclist rider={rider} isMoving className="h-12 w-[4.5rem]" />
            {index < 3 ? (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/88 px-2 py-1 text-[9px] font-black text-white shadow-lg">
                {hasFinished ? `${result.rank}. ` : ""}{rider.name.split(" ").at(-1)}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FinishDistanceCounter({
  metersRemaining,
}: {
  metersRemaining: number;
}) {
  const display =
    metersRemaining >= 1_000
      ? `${(metersRemaining / 1_000).toFixed(1)} km`
      : `${metersRemaining} m`;

  return (
    <div className="absolute right-4 top-4 z-30 rounded-xl border border-white/20 bg-[#071A17]/90 px-4 py-2 text-right text-white shadow-xl backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#9BE0CA]">
        Jusqu’à la ligne
      </p>
      <p className="mt-0.5 text-lg font-black tabular-nums text-[#FFF4C4]">
        {display}
      </p>
    </div>
  );
}

function GroupDetails({
  groups,
  riderById,
}: {
  groups: RaceGroupSnapshot[];
  riderById: Map<string, RiderSimulationInput>;
}) {
  const leftGroups = groups
    .filter((group) =>
      ["peloton", "dropped", "time_trial"].includes(
        group.type
      )
    )
    .sort(
      (first, second) =>
        first.gapToLeaderSeconds -
        second.gapToLeaderSeconds
    );
  const rightGroups = groups
    .filter((group) =>
      ["breakaway", "chase"].includes(group.type)
    )
    .sort(
      (first, second) =>
        first.gapToLeaderSeconds -
        second.gapToLeaderSeconds
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-3">
        {leftGroups.slice(0, 3).map((group) => (
          <RaceGroupCard
            key={group.id}
            group={group}
            riderById={riderById}
          />
        ))}
      </div>
      <div className="space-y-3">
        {rightGroups.slice(0, 3).map((group) => (
          <RaceGroupCard
            key={group.id}
            group={group}
            riderById={riderById}
          />
        ))}
      </div>
    </div>
  );
}

function RaceGroupCard({
  group,
  riderById,
}: {
  group: RaceGroupSnapshot;
  riderById: Map<string, RiderSimulationInput>;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-white">
            {group.label}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#759286]">
            {group.riderIds.length} coureur
            {group.riderIds.length > 1 ? "s" : ""} · énergie {Math.round(group.averageEnergy)} %
          </p>
        </div>
        <span className="rounded-full bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#F2C94C]">
          {group.gapToLeaderSeconds
            ? `+${formatGap(group.gapToLeaderSeconds)}`
            : "Tête"}
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs font-semibold text-[#B7CAC1]">
        {group.riderIds.slice(0, 5).map((id) => {
          const rider = riderById.get(id)!;
          return (
            <li key={id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full border"
                style={{
                  backgroundColor: rider.teamPrimaryColor,
                  borderColor: rider.teamSecondaryColor,
                }}
              />
              <span className="truncate">{rider.name}</span>
              <span className="ml-auto text-[9px] font-black uppercase text-[#6F8C80]">
                {RACE_ROLE_LABELS[rider.role]}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function RaceCommentary({ commentary }: { commentary: string[] }) {
  return (
    <aside className="rounded-2xl border border-[#F2C94C]/20 bg-[#F2C94C]/[0.06] p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F2C94C]">
        Radio course
      </p>
      <ol className="mt-4 space-y-3">
        {commentary.map((message, index) => (
          <li key={`${index}-${message}`} className="flex gap-3 text-sm font-semibold leading-5 text-[#E1E9E4]">
            <span className="mt-0.5 text-[#F2C94C]">●</span>
            {message}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function LiveClassification({
  snapshot,
  riderById,
}: {
  snapshot: ReturnType<typeof simulateRaceStage>["timeline"][number];
  riderById: Map<string, RiderSimulationInput>;
}) {
  const rows = snapshot.groups.flatMap((group) =>
    group.riderIds.map((riderId) => ({ riderId, group }))
  );

  return (
    <div className="p-5 sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#72D4B7]">Situation en course</p>
          <p className="mt-1 text-sm font-semibold text-[#91A99E]">Ordre provisoire au km {formatDistance(snapshot.completedDistanceKm)}</p>
        </div>
        <span className="rounded-full bg-[#EF5B65]/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#FF9EA6]">● Live</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left">
          <thead className="bg-white/[0.06] text-[10px] font-black uppercase tracking-widest text-[#809D90]">
            <tr><th className="px-4 py-3">Position</th><th className="px-4 py-3">Coureur</th><th className="px-4 py-3">Groupe</th><th className="px-4 py-3 text-right">Écart</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.slice(0, 20).map(({ riderId, group }, index) => {
              const rider = riderById.get(riderId)!;
              return (
                <tr key={riderId} className="bg-white/[0.025] text-sm font-semibold">
                  <td className="px-4 py-3 font-black text-[#F2C94C]">{index + 1}</td>
                  <td className="px-4 py-3">{rider.name}</td>
                  <td className="px-4 py-3 text-[#94ADA2]">{group.label}</td>
                  <td className="px-4 py-3 text-right font-black">{group.gapToLeaderSeconds ? `+${formatGap(group.gapToLeaderSeconds)}` : "Tête"}</td>
                </tr>
              );
            })}
            {snapshot.abandonments.map((abandonment) => {
              const rider = riderById.get(abandonment.riderId)!;
              return (
                <tr key={abandonment.riderId} className="bg-[#EF5B65]/[0.07] text-sm font-semibold">
                  <td className="px-4 py-3 font-black text-[#FF9EA6]">—</td>
                  <td className="px-4 py-3">{rider.name}</td>
                  <td className="px-4 py-3 text-[#FF9EA6]">
                    Abandon · {abandonment.injury.label}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-[#FF9EA6]">DNF</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Classification({
  simulation,
  riderById,
  tourStandings,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
  tourStandings: ReturnType<typeof buildStageRaceStandings> | null;
}) {
  const winnerTime = simulation.results[0].elapsedTimeSeconds;

  return (
    <div className="p-5 sm:p-8">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-left">
          <thead className="bg-white/[0.06] text-[10px] font-black uppercase tracking-widest text-[#809D90]">
            <tr>
              <th className="px-4 py-3">Rang</th>
              <th className="px-4 py-3">Coureur</th>
              <th className="hidden px-4 py-3 md:table-cell">Équipe</th>
              <th className="px-4 py-3 text-right">Temps / écart</th>
              <th className="hidden px-4 py-3 text-right sm:table-cell">Énergie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {simulation.results.map((result) => {
              const rider = riderById.get(result.riderId)!;
              const abandoned = result.status === "did_not_finish";
              return (
                <tr key={result.riderId} className={`${abandoned ? "bg-[#EF5B65]/[0.07]" : "bg-white/[0.025]"} text-sm font-semibold`}>
                  <td className={`px-4 py-3 font-black ${abandoned ? "text-[#FF9EA6]" : "text-[#F2C94C]"}`}>
                    {result.rank ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full border"
                        style={{ backgroundColor: rider.teamPrimaryColor, borderColor: rider.teamSecondaryColor }}
                      />
                      {rider.name}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[#94ADA2] md:table-cell">{rider.teamName}</td>
                  <td className="px-4 py-3 text-right font-black">
                    {abandoned
                      ? "Abandon"
                      : result.rank === 1
                      ? formatTime(winnerTime)
                      : result.gapToWinnerSeconds === 0
                        ? "m.t."
                        : `+${formatGap(result.gapToWinnerSeconds)}`}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-[#94ADA2] sm:table-cell">
                    {abandoned && result.abandonment
                      ? `${result.abandonment.injury.label} · ${result.abandonment.injury.recoveryDays} j`
                      : `${Math.round(result.energyAfter)} %`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tourStandings ? (
        <TourSecondaryStandings
          standings={tourStandings}
          riderById={riderById}
        />
      ) : null}
    </div>
  );
}

function TourSecondaryStandings({
  standings,
  riderById,
}: {
  standings: ReturnType<typeof buildStageRaceStandings>;
  riderById: Map<string, RiderSimulationInput>;
}) {
  const youthLeaderTime = standings.youth[0]?.elapsedTimeSeconds ?? 0;
  const teamLeaderTime = standings.teams[0]?.elapsedTimeSeconds ?? 0;
  const cards = [
    {
      title: "Meilleur grimpeur",
      accent: "text-[#EF5B65]",
      rows: standings.mountain.slice(0, 5).map((row) => ({
        id: row.riderId,
        label: riderById.get(row.riderId)?.name ?? row.riderId,
        value: `${row.points} pts`,
      })),
    },
    {
      title: "Meilleur sprinteur",
      accent: "text-[#72D4B7]",
      rows: standings.sprint.slice(0, 5).map((row) => ({
        id: row.riderId,
        label: riderById.get(row.riderId)?.name ?? row.riderId,
        value: `${row.points} pts`,
      })),
    },
    {
      title: "Meilleur jeune · -25 ans",
      accent: "text-white",
      rows: standings.youth.slice(0, 5).map((row, index) => ({
        id: row.riderId,
        label: riderById.get(row.riderId)?.name ?? row.riderId,
        value:
          index === 0
            ? formatTime(row.elapsedTimeSeconds)
            : `+${formatGap(row.elapsedTimeSeconds - youthLeaderTime)}`,
      })),
    },
    {
      title: "Meilleure équipe",
      accent: "text-[#F2C94C]",
      rows: standings.teams.slice(0, 5).map((row, index) => ({
        id: row.teamId,
        label: row.teamName,
        value:
          index === 0
            ? formatTime(row.elapsedTimeSeconds)
            : `+${formatGap(row.elapsedTimeSeconds - teamLeaderTime)}`,
      })),
    },
  ];

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <h3 className={`text-xs font-black uppercase tracking-widest ${card.accent}`}>
            {card.title}
          </h3>
          <ol className="mt-4 space-y-2">
            {card.rows.length ? card.rows.map((row, index) => (
              <li key={row.id} className="flex items-center gap-2 text-xs font-semibold">
                <span className="w-4 font-black text-[#809D90]">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="font-black text-[#C1D3CA]">{row.value}</span>
              </li>
            )) : (
              <li className="text-xs font-semibold text-[#809D90]">Aucun point attribué.</li>
            )}
          </ol>
        </article>
      ))}
    </div>
  );
}

function ActiveRules({ stageType }: { stageType: string }) {
  const rules = [
    ["Résolution", "Un calcul par tronçon de 10 km, avec un dernier tronçon ajusté à la distance exacte."],
    ["Départ", "Le peloton démarre groupé ; les premières attaques et la formation de l’échappée deviennent visibles en course."],
    ["Aspiration", "Le coût énergétique diminue avec la taille du groupe ; une petite échappée paie davantage qu’un peloton."],
    ["Terrain", "PLA, MON, VAL, PAV et DES sont pondérées par le profil, la pente et le revêtement."],
    ["Énergie", "La forme constitue le capital initial ; END et RES déterminent la capacité à tenir le rythme et les efforts."],
    ["Tactique", "Les rôles orientent les attaques, la poursuite, les trains de sprint et les classements annexes."],
    ["Aléas", "Crevaisons, bordures et chutes individuelles ou massives peuvent isoler des coureurs et créer de nouveaux groupes."],
    ["Rejouabilité", "Une graine fixe tous les aléas : un résultat peut être reproduit, expliqué et testé."],
  ];

  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
      {rules.map(([title, description], index) => (
        <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#72D4B7]/10 text-xs font-black text-[#72D4B7]">
            {index + 1}
          </span>
          <h3 className="mt-4 font-black">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#99B0A5]">{description}</p>
        </article>
      ))}
      <p className="sm:col-span-2 lg:col-span-3 rounded-xl border border-[#F2C94C]/20 bg-[#F2C94C]/5 px-4 py-3 text-xs font-semibold leading-5 text-[#DCCF9B]">
        Mode actif : {stageType === "road" ? "course en ligne" : "contre-la-montre"}. Les paramètres sont volontairement centralisés dans le moteur pour pouvoir les rééquilibrer sans refaire l’interface.
      </p>
    </div>
  );
}

function terrainLabel(terrain: string) {
  if (terrain === "climb") return "montée";
  if (terrain === "descent") return "descente";
  return "plat";
}

function formatGap(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return minutes ? `${minutes}’${String(rest).padStart(2, "0")}”` : `${rest}”`;
}

function formatTime(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const rest = rounded % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}’ ${String(rest).padStart(2, "0")}”`;
}

function formatDistance(distance: number) {
  return Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
}
