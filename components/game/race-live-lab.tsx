"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SideRaceCyclist, TopRaceCyclist } from "@/components/game/race-cyclist-detailed";
import {
  RaceDepartureFormation,
  RaceGroupFormation,
  RaceSupportConvoy,
} from "@/components/game/race-group-formation";
import { RaceFavoritesPanel } from "@/components/game/race-favorites-panel";
import { RaceRoadsideCrowd } from "@/components/game/race-roadside-crowd";
import { FinishRoadsideInfrastructure } from "@/components/game/race-scenery";
import { RaceSceneryBackdrop } from "@/components/game/race-scenery-detailed";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import {
  RaceWeatherBadge,
  RaceWeatherOverlay,
} from "@/components/game/race-weather-overlay";
import type { RaceCalendarEdition, RaceCalendarStage } from "@/lib/game/race-calendar";
import {
  buildSprintVisualBattle,
  buildSprintVisualTeams,
  getFinalReplayMeters,
  getFinishTargetPosition,
  getSmallGroupFinishPosition,
  getVisibleFinalBattleRiderIds,
  shouldWinnerCelebrate,
} from "@/lib/game/race-finish-visual";
import { getFrozenRaceFavoriteRiders } from "@/lib/game/race-favorites";
import { buildRaceGapLine } from "@/lib/game/race-gap-line";
import {
  getIntermediateSprintVisualProgress,
  getRaceGroupDisplayLabel,
  getRaceRoadFormationTop,
  getRaceRoadSlopeOffset,
  shouldShowRaceRoadMarkings,
  shouldShowRaceSupportCars,
} from "@/lib/game/race-visual-layout";
import {
  getRaceGroupLayoutDensity,
  getStageLiveState,
  shouldHideRaceGaps,
} from "@/lib/game/race-live";
import {
  getOfficialStageSimulationContext,
  type LockedOfficialStageSimulation,
} from "@/lib/game/official-race-simulation";
import { useSynchronizedRaceClock } from "@/lib/game/use-synchronized-race-clock";
import {
  getFinalBattleScenario,
  getLeadingFinishGroupRiderIds,
  isMassGroupFinish,
  RACE_ROLE_LABELS,
  type RaceGroupSnapshot,
  type RaceIncident,
  type RacePrimeResult,
  type RiderSimulationInput,
  type StageRaceStandings,
  type StageSimulationResult,
} from "@/lib/game/race-simulation";
import {
  getRaceSceneryKind,
  shouldShowRaceSpectators,
} from "@/lib/game/race-visuals";
import {
  getRaceWeather,
  type RaceWeather,
} from "@/lib/game/race-weather";

type LabTab = "live" | "classification" | "rules";
type PlaybackSpeed = 1 | 2 | 4;

const REPLAY_STEP_DURATION_MS = 6_000;
const FINISH_LINE_REVEAL_METERS = 750;

export function RaceLiveLab({
  edition,
  stage,
  mode,
  nowIso,
  lockedSimulations = [],
}: {
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  mode: "live" | "replay";
  nowIso: string;
  lockedSimulations?: LockedOfficialStageSimulation[];
}) {
  const { input, simulation, standings: tourStandings } = useMemo(
    () =>
      getOfficialStageSimulationContext({
        edition,
        stageId: stage.id,
        lockedSimulations,
      }),
    [edition, lockedSimulations, stage.id]
  );
  const favoriteRiders = useMemo(
    () =>
      getFrozenRaceFavoriteRiders(
        edition,
        lockedSimulations,
        stage.id,
      ),
    [edition, lockedSimulations, stage.id]
  );
  const raceWeather =
    input.weather ?? getRaceWeather(`${edition.id}:${stage.id}:weather`);
  const [activeIndex, setActiveIndex] = useState(0);
  const [replaySegmentProgress, setReplaySegmentProgress] = useState(0);
  const replaySegmentProgressRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(mode === "live");
  const [playbackSpeed, setPlaybackSpeed] =
    useState<PlaybackSpeed>(1);
  const [finalMetersRemaining, setFinalMetersRemaining] = useState(
    () => Math.round((stage.segments.at(-1)?.distanceKm ?? 0) * 1_000)
  );
  const finalMetersRemainingRef = useRef(finalMetersRemaining);
  const [tab, setTab] = useState<LabTab>("live");
  const clock = useSynchronizedRaceClock(nowIso, 1_000);
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
    finalMetersRemainingRef.current = finalMetersRemaining;
  }, [finalMetersRemaining]);

  useEffect(() => {
    replaySegmentProgressRef.current = replaySegmentProgress;
  }, [replaySegmentProgress]);

  useEffect(() => {
    if (mode !== "replay" || !isPlaying) return;
    if (activeIndex >= simulation.timeline.length - 1) return;

    const startedAt = Date.now();
    const startedProgress = replaySegmentProgressRef.current;
    const fullDurationMs = REPLAY_STEP_DURATION_MS / playbackSpeed;
    const timer = window.setInterval(() => {
      const progress = Math.min(
        1,
        startedProgress + (Date.now() - startedAt) / fullDurationMs
      );
      replaySegmentProgressRef.current = progress;
      setReplaySegmentProgress(progress);

      if (progress >= 1) {
        window.clearInterval(timer);
        replaySegmentProgressRef.current = 0;
        setReplaySegmentProgress(0);
        setActiveIndex((current) =>
          Math.min(current + 1, simulation.timeline.length - 1)
        );
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    activeIndex,
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
  const winnerResult = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 1
  );
  const breakawayStillAhead = winnerResult
    ? simulation.timeline.at(-1)?.groups.some(
        (group) =>
          group.type === "breakaway" &&
          group.riderIds.includes(winnerResult.riderId)
      ) ?? false
    : false;
  const finalBattleScenario = getFinalBattleScenario(simulation);
  const isMassSprint = isMassGroupFinish(simulation);
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
  const liveSegmentProgress = Math.max(
    0,
    Math.min(
      1,
      liveState.progress * simulation.timeline.length - displayedIndex
    )
  );
  const displayedSegmentProgress =
    mode === "live" ? liveSegmentProgress : replaySegmentProgress;
  const activePrimeResult =
    edition.raceFormat === "stage_race" && !isFinal
      ? simulation.primes.find(
          (prime) => prime.segmentNumber === activeSegment.segmentNumber
        ) ?? null
      : null;
  const previousPrimeResult =
    edition.raceFormat === "stage_race" && !isFinal
      ? simulation.primes.find(
          (prime) => prime.segmentNumber === activeSegment.segmentNumber - 1
        ) ?? null
      : null;

  useEffect(() => {
    if (mode !== "replay" || !isFinal || !isPlaying) return;

    const startedAt = Date.now();
    const startedWithMeters = finalMetersRemainingRef.current;
    const timer = window.setInterval(() => {
      const metersRemaining = getFinalReplayMeters({
        startedWithMeters,
        finalSegmentMeters,
        elapsedMs: Date.now() - startedAt,
        playbackSpeed,
        approachDurationMs: REPLAY_STEP_DURATION_MS,
      });
      setFinalMetersRemaining(metersRemaining);
      if (metersRemaining <= 0) setIsPlaying(false);
    }, 100);

    return () => window.clearInterval(timer);
  }, [finalSegmentMeters, isFinal, isPlaying, mode, playbackSpeed]);

  return (
    <section
      data-tutorial-id="race-live-lab"
      className="overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-[#071A17] text-[#FFFDF4] shadow-[0_30px_80px_rgba(7,26,23,0.22)]"
    >
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
              Startlist officielle · {input.riders.length} engagés · {new Set(input.riders.map((rider) => rider.teamId)).size} équipe{new Set(input.riders.map((rider) => rider.teamId)).size > 1 ? "s" : ""}
            </span>
            <RaceWeatherBadge weather={raceWeather} />
            {mode === "replay" ? (
            <button
              type="button"
              onClick={() => {
                setActiveIndex(0);
                setReplaySegmentProgress(0);
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

      <div className="border-b border-white/10 px-3 py-4 sm:px-6">
        <RaceFavoritesPanel
          edition={edition}
          stage={stage}
          riders={favoriteRiders}
          frozen
          tone="dark"
        />
      </div>

      <nav
        data-tutorial-id="race-live-tabs"
        className="flex gap-1 overflow-x-auto border-b border-white/10 px-5 pt-3 sm:px-8"
        aria-label="Vues du moteur de course"
      >
        <TabButton active={tab === "live"} onClick={() => setTab("live")}>Live</TabButton>
        <TabButton active={tab === "classification"} onClick={() => setTab("classification")}>
          Classement
        </TabButton>
        <TabButton active={tab === "rules"} onClick={() => setTab("rules")}>
          Règles actives
        </TabButton>
      </nav>

      {tab === "live" ? (
        <div className="p-3 sm:p-6 xl:p-8">
          <RaceStageProfile
            segments={input.segments}
            activeSegmentNumber={activeSegment.segmentNumber}
            tone="dark"
            showLegend
            onSelectSegment={
              mode === "replay"
                ? (segmentNumber) => {
                    setActiveIndex(segmentNumber - 1);
                    setReplaySegmentProgress(0);
                    setFinalMetersRemaining(finalSegmentMeters);
                    setIsPlaying(false);
                  }
                : undefined
            }
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div
              data-tutorial-id="race-replay-controls"
              className="flex flex-wrap items-center gap-2"
            >
              {mode === "replay" ? <button
                type="button"
                onClick={() => {
                  if (isFinal && !isPlaying && finalMetersRemaining <= 0) {
                    setActiveIndex(0);
                    setReplaySegmentProgress(0);
                    setFinalMetersRemaining(finalSegmentMeters);
                    setIsPlaying(true);
                    return;
                  }
                  setIsPlaying((current) => !current);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#72D4B7]/45 bg-[#72D4B7]/10 px-4 text-xs font-black uppercase tracking-wide text-[#9BE0CA] transition hover:bg-[#72D4B7]/20"
              >
                <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
                {isPlaying
                  ? "Pause"
                  : isFinal && finalMetersRemaining <= 0
                    ? "Revoir"
                    : "Lire la course"}
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
              segment={finalSegment}
              metersRemaining={displayedFinalMeters}
              finalSegmentMeters={finalSegmentMeters}
              scenario={finalBattleScenario}
              weather={raceWeather}
            />
          ) : isFinal && isRoad ? (
            <FinishBattleView
              simulation={simulation}
              riderById={riderById}
              segment={finalSegment}
              breakawayStillAhead={breakawayStillAhead}
              metersRemaining={displayedFinalMeters}
              finalSegmentMeters={finalSegmentMeters}
              scenario={finalBattleScenario}
              weather={raceWeather}
            />
          ) : (
            <RoadScene
              snapshot={snapshot}
              riderById={riderById}
              segment={activeSegment}
              isMoving={mode === "live" || isPlaying}
              segmentProgress={displayedSegmentProgress}
              primeResult={activePrimeResult}
              previousPrimeResult={previousPrimeResult}
              visualSeed={simulation.seed}
              weather={raceWeather}
            />
          )}

          <div className="mt-5 space-y-5">
            {!shouldHideRaceGaps(
              displayedIndex + 1,
              simulation.timeline.length
            ) ? (
              <RaceGapLine
                groups={snapshot.groups}
                riderById={riderById}
              />
            ) : null}
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

function RaceVisualViewport({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div className="mt-6">
      <p className="mb-2 text-right text-[10px] font-bold text-[#8FA99D] lg:hidden">
        Glissez horizontalement pour suivre la course
      </p>
      <div
        dir="rtl"
        role="region"
        aria-label="Visualisation de la course, défilement horizontal sur téléphone"
        className="-mx-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0"
      >
        <div dir="ltr" className={`relative min-w-[58rem] overflow-hidden lg:min-w-0 ${className}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function RoadScene({
  snapshot,
  riderById,
  segment,
  isMoving,
  segmentProgress,
  primeResult,
  previousPrimeResult,
  visualSeed,
  weather,
}: {
  snapshot: StageSimulationResult["timeline"][number];
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  isMoving: boolean;
  segmentProgress: number;
  primeResult: RacePrimeResult | null;
  previousPrimeResult: RacePrimeResult | null;
  visualSeed: string | number;
  weather: RaceWeather;
}) {
  const groups = snapshot.groups.slice(0, 6);
  const primeWinnerId =
    segmentProgress >= 0.5
      ? primeResult?.classification[0]?.riderId ?? null
      : null;
  const primeSprintProgress = getIntermediateSprintVisualProgress({
    primeType: primeResult?.prime.type ?? null,
    segmentProgress,
  });
  const primeSprintContenderIds =
    primeSprintProgress === null
      ? []
      : primeResult?.classification
          .slice(0, 3)
          .map((classified) => classified.riderId) ?? [];
  const roadSlopeOffset = getRaceRoadSlopeOffset(
    segment.averageGradientPct,
  );
  const roadTopCenterPct = 54;
  const roadDepthPct = 32;
  const roadLeftPct = roadTopCenterPct + roadSlopeOffset;
  const roadRightPct = roadTopCenterPct - roadSlopeOffset;
  const roadBottomLeftPct = roadLeftPct + roadDepthPct;
  const roadBottomRightPct = roadRightPct + roadDepthPct;
  const roadMarkingLeftPct = roadLeftPct + roadDepthPct * 0.52;
  const roadMarkingRightPct = roadRightPct + roadDepthPct * 0.52;
  const scenery = getRaceSceneryKind({
    seed: visualSeed,
    segment,
    isStart: segment.segmentNumber === 1,
  });
  const showSpectators = shouldShowRaceSpectators({
    seed: visualSeed,
    segmentNumber: segment.segmentNumber,
    scenery,
    terrain: segment.terrain,
  });
  const spectatorPalette = getRaceSpectatorPalette(riderById);
  const roadPatternId = `road-surface-${segment.segmentNumber}`;
  const departureProgress =
    snapshot.segmentNumber === 1 && segmentProgress < 0.46
      ? Math.max(0, Math.min(1, segmentProgress / 0.46))
      : null;
  const departureGroup =
    snapshot.groups.find((group) => group.type === "peloton") ??
    snapshot.groups[0] ??
    null;
  const sky =
    segment.terrain === "climb"
      ? "bg-[linear-gradient(#83C0D0_0_40%,#7FAE72_40%_100%)]"
      : segment.terrain === "descent"
        ? "bg-[linear-gradient(#9ACFDA_0_47%,#A7C585_47%_100%)]"
        : "bg-[linear-gradient(#8FD1DC_0_46%,#A7C585_46%_100%)]";
  const trailingGroup = groups.at(-1) ?? null;
  const trailingGroupIndex = Math.max(0, groups.length - 1);
  const trailingGroupLeft = trailingGroup
    ? getGroupScreenPosition(trailingGroup, trailingGroupIndex, groups.length)
    : 18;
  const convoyLeft = Math.max(6, trailingGroupLeft - 12);
  const convoyTop =
    roadLeftPct +
    (roadRightPct - roadLeftPct) * (convoyLeft / 100) +
    roadDepthPct * 0.58;
  const convoyRider = trailingGroup
    ? riderById.get(trailingGroup.riderIds[0] ?? "") ?? null
    : null;

  return (
    <RaceVisualViewport className={`h-72 rounded-3xl border border-white/10 shadow-inner shadow-black/25 ${sky}`}>
      <div aria-hidden="true" className="absolute left-8 top-7 h-16 w-16 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <RaceSceneryBackdrop kind={scenery} isMoving={isMoving} showSpectators={false} />
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <RoadSurfaceDefinition
          id={roadPatternId}
          surface={segment.surface}
          compact
          isMoving={isMoving}
        />
        <path
          d={`M 0 ${roadBottomLeftPct} L 100 ${roadBottomRightPct} L 100 100 L 0 100 Z`}
          fill="#5F8658"
          data-road-foreground="sloped"
        />
        <path
          d={`M -2 ${roadLeftPct} L 102 ${roadRightPct}`}
          fill="none"
          stroke="#557450"
          strokeWidth="8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M -2 ${roadBottomLeftPct} L 102 ${roadBottomRightPct}`}
          fill="none"
          stroke="#557450"
          strokeWidth="8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M -2 ${roadLeftPct} L 102 ${roadRightPct}`}
          fill="none"
          stroke="#C8B889"
          strokeWidth="5.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M -2 ${roadBottomLeftPct} L 102 ${roadBottomRightPct}`}
          fill="none"
          stroke="#C8B889"
          strokeWidth="5.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M 0 ${roadLeftPct} L 100 ${roadRightPct} L 100 ${roadBottomRightPct} L 0 ${roadBottomLeftPct} Z`}
          fill={segment.surface === "cobbles" ? `url(#${roadPatternId})` : `url(#${roadPatternId}-asphalt)`}
          data-road-bounds="parallel"
          data-road-slope-offset={roadSlopeOffset}
        />
        {shouldShowRaceRoadMarkings(segment.surface) ? (
          <path
            d={`M -8 ${roadMarkingLeftPct} L 108 ${roadMarkingRightPct}`}
            fill="none"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="0.85"
            strokeDasharray="8 6"
            vectorEffect="non-scaling-stroke"
            data-road-flow-direction="right-to-left"
            className={isMoving ? "cm-race-road-marking-svg" : ""}
          />
        ) : null}
        {[0, roadDepthPct].map((depth) => (
          <path
            key={depth}
            d={`M 0 ${roadLeftPct + depth} L 100 ${roadRightPct + depth}`}
            fill="none"
            stroke="rgba(16,32,27,0.58)"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <RaceRoadsideCrowd
        show={showSpectators}
        isMoving={isMoving}
        roadLeftY={roadLeftPct * 3.2}
        roadRightY={roadRightPct * 3.2}
        roadDepthY={roadDepthPct * 3.2}
        terrain={segment.terrain}
        palette={spectatorPalette}
      />
      <RaceWeatherOverlay weather={weather} />
      <p className="absolute right-4 top-4 rounded-full bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
        {terrainLabel(segment.terrain)} {segment.averageGradientPct ? `${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %` : ""} · {segment.surface === "cobbles" ? "secteur pavé · " : ""}{formatDistance(snapshot.completedDistanceKm)} km
      </p>

      {departureProgress !== null && departureGroup ? (
        <RaceDepartureSequence
          riderIds={departureGroup.riderIds}
          riderById={riderById}
          roadLeftPct={roadLeftPct}
          roadRightPct={roadRightPct}
          roadDepthPct={roadDepthPct}
          progress={departureProgress}
          isMoving={isMoving}
        />
      ) : (
        <>
          <PrimePassageOverlay
            primeResult={primeResult}
            previousPrimeResult={previousPrimeResult}
            segmentProgress={segmentProgress}
            riderById={riderById}
            roadLeftPct={roadLeftPct}
            roadRightPct={roadRightPct}
          />

          <RaceIncidentOverlay
            incidents={snapshot.incidents}
            riderById={riderById}
          />

          {groups.map((group, groupIndex) => {
        const left = getGroupScreenPosition(group, groupIndex, groups.length);
        const roadFormationTopPct = getRaceRoadFormationTop({
          roadLeft: roadLeftPct,
          roadRight: roadRightPct,
          roadDepth: roadDepthPct,
          horizontalPosition: left,
        });
        const visibleRiderIds = getVisibleRiderIds({
          group,
          incidents: snapshot.incidents,
          riderById,
          priorityRiderIds: primeSprintContenderIds.length > 0
            ? primeSprintContenderIds
            : primeWinnerId
              ? [primeWinnerId]
              : [],
          maximumVisibleRiders: groups.length <= 3 ? 8 : 5,
        });
        const displayLabel = getRaceGroupDisplayLabel({
          type: group.type,
          riderCount: group.riderIds.length,
          gapToLeaderSeconds: group.gapToLeaderSeconds,
          fallbackLabel: group.label,
        });
        return (
          <div
            key={group.id}
            className="absolute -translate-x-1/2 transition-[left,top] duration-700 ease-out"
            style={{
              left: `${left}%`,
              top: `${roadFormationTopPct}%`,
              zIndex: 20 - groupIndex,
            }}
            title={group.riderIds.map((id) => riderById.get(id)?.name).filter(Boolean).join(", ")}
          >
            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/85 px-2.5 py-1 text-center text-[10px] font-black text-white shadow-lg backdrop-blur">
              {displayLabel} {group.gapToLeaderSeconds > 0 ? `+${formatGap(group.gapToLeaderSeconds)}` : ""}
            </div>
            <RaceGroupFormation
              group={group}
              riderIds={visibleRiderIds}
              riderById={riderById}
              incidents={snapshot.incidents}
              primeWinnerId={primeWinnerId}
              primeResult={primeResult}
              isMoving={isMoving}
              compact={groups.length >= 4}
              primeSprintContenderIds={primeSprintContenderIds}
              primeSprintProgress={primeSprintProgress}
            />
          </div>
        );
          })}
          {
            trailingGroup &&
            convoyRider &&
            shouldShowRaceSupportCars(groups.length) ? (
              <RaceSupportConvoy
                left={convoyLeft}
                top={convoyTop}
                primaryColor={
                  convoyRider.teamJersey?.primaryColor ??
                  convoyRider.teamPrimaryColor
                }
                secondaryColor={
                  convoyRider.teamJersey?.secondaryColor ??
                  convoyRider.teamSecondaryColor
                }
                isMoving={isMoving}
                showSecondCar={groups.length <= 2}
              />
            ) : null
          }
        </>
      )}
    </RaceVisualViewport>
  );
}

export function RoadSurfaceDefinition({
  id,
  surface,
  compact = false,
  isMoving = false,
}: {
  id: string;
  surface: RaceCalendarStage["segments"][number]["surface"];
  compact?: boolean;
  isMoving?: boolean;
}) {
  const width = compact ? 3.6 : 18;
  const height = compact ? 2.4 : 11;
  const strokeWidth = compact ? 0.14 : 0.72;

  return (
    <defs>
      <pattern
        id={`${id}-asphalt`}
        width={compact ? 4.2 : 19}
        height={compact ? 3.2 : 14}
        patternUnits="userSpaceOnUse"
        data-road-asphalt-texture="uniform"
      >
        <rect
          width={compact ? 4.2 : 19}
          height={compact ? 3.2 : 14}
          fill="#35453F"
        />
        <circle
          cx={compact ? 0.8 : 4}
          cy={compact ? 0.7 : 3}
          r={compact ? 0.09 : 0.42}
          fill="#D9E0DC"
          opacity="0.17"
        />
        <circle
          cx={compact ? 3.1 : 14}
          cy={compact ? 2.2 : 10}
          r={compact ? 0.07 : 0.3}
          fill="#111B17"
          opacity="0.2"
        />

      </pattern>
      {surface === "cobbles" ? (
        <>
          <linearGradient id={`${id}-cobble-base`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7B756A" />
            <stop offset="0.46" stopColor="#68635A" />
            <stop offset="1" stopColor="#4E4B45" />
          </linearGradient>
          <pattern
            id={id}
            width={width}
            height={height}
            patternUnits="userSpaceOnUse"
            data-road-cobble-texture="volumetric-grid"
            data-road-cobble-flow={isMoving ? "right-to-left" : "paused"}
          >
            {isMoving ? (
              <animate
                attributeName="x"
                from="0"
                to={compact ? -28.8 : -36}
                dur="0.62s"
                repeatCount="indefinite"
              />
            ) : null}
            <rect width={width} height={height} fill={`url(#${id}-cobble-base)`} />
            <path
              d={`M0 ${height / 2}H${width}M${width / 2} 0v${height / 2}M${width * 0.24} ${height / 2}V${height}M${width * 0.74} ${height / 2}V${height}`}
              fill="none"
              stroke="#34322E"
              strokeWidth={strokeWidth * 1.2}
              opacity="0.9"
            />
            <path
              d={`M0 ${height / 2 - strokeWidth}H${width}M${width / 2 - strokeWidth} 0v${height / 2}M${width * 0.24 - strokeWidth} ${height / 2}V${height}M${width * 0.74 - strokeWidth} ${height / 2}V${height}`}
              fill="none"
              stroke="#AAA08F"
              strokeWidth={strokeWidth * 0.58}
              opacity="0.78"
            />
            <path d={`M0 0H${width}M0 ${height}H${width}`} stroke="#393732" strokeWidth={strokeWidth} opacity="0.86" />
            <path d={`M${width * 0.08} ${height * 0.2}h${width * 0.15}M${width * 0.58} ${height * 0.72}h${width * 0.11}`} stroke="#C2B9A8" strokeWidth={strokeWidth * 0.34} strokeLinecap="round" opacity="0.44" />
          </pattern>
        </>
      ) : null}
    </defs>
  );
}

export function RoadTextureOverlay({
  surface,
  isMoving,
}: {
  surface: RaceCalendarStage["segments"][number]["surface"];
  isMoving: boolean;
}) {
  const backgroundImage =
    surface === "cobbles"
      ? "linear-gradient(90deg,rgba(44,41,36,.78) 1px,transparent 1px),linear-gradient(0deg,rgba(48,45,40,.72) 1px,transparent 1px),linear-gradient(90deg,transparent 1px,rgba(198,187,167,.34) 2px,transparent 3px),linear-gradient(0deg,transparent 1px,rgba(190,181,163,.3) 2px,transparent 3px),linear-gradient(145deg,#777168,#514E48)"
      : "radial-gradient(circle at 20% 30%,rgba(255,255,255,.08) 0 1px,transparent 1.5px),linear-gradient(90deg,transparent,rgba(255,255,255,.025),transparent)";

  return (
    <div
      aria-hidden="true"
      data-road-surface={surface}
      data-road-flow-direction={
        surface === "cobbles" ? "right-to-left" : undefined
      }
      className={`pointer-events-none absolute inset-0 opacity-75 ${
        surface === "cobbles" && isMoving
          ? "cm-race-cobble-flow-strip"
          : ""
      }`}
      style={{
        backgroundImage,
        backgroundSize:
          surface === "cobbles"
            ? "18px 11px, 18px 11px, 18px 11px, 18px 11px, 100% 100%"
            : "34px 34px, 100% 100%",
      }}
    />
  );
}

function RaceDepartureSequence({
  riderIds,
  riderById,
  roadLeftPct,
  roadRightPct,
  roadDepthPct,
  progress,
  isMoving,
}: {
  riderIds: string[];
  riderById: Map<string, RiderSimulationInput>;
  roadLeftPct: number;
  roadRightPct: number;
  roadDepthPct: number;
  progress: number;
  isMoving: boolean;
}) {
  const startLinePosition = 40;
  const pelotonPosition = 12 + progress * 72;
  const carPosition = 34 + progress * 70;
  const pelotonRoadTop = getRaceRoadFormationTop({
    roadLeft: roadLeftPct,
    roadRight: roadRightPct,
    roadDepth: roadDepthPct,
    horizontalPosition: pelotonPosition,
  });
  const carRoadTop =
    roadLeftPct +
    (roadRightPct - roadLeftPct) *
      (Math.min(100, carPosition) / 100) +
    roadDepthPct * 0.62;
  const startLineRoadTop =
    roadLeftPct +
    (roadRightPct - roadLeftPct) * (startLinePosition / 100);
  const hasCrossedStartLine = pelotonPosition >= startLinePosition;

  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      >
        <line
          x1={startLinePosition}
          y1={startLineRoadTop}
          x2={startLinePosition}
          y2={startLineRoadTop + roadDepthPct}
          stroke="#FFFDF4"
          strokeWidth="1.4"
          strokeDasharray="2.4 1.7"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        className="absolute z-30 -translate-x-1/2 -translate-y-full rounded-t-lg bg-[#FFFDF4] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.17em] text-[#17261E] shadow-lg"
        style={{
          left: `${startLinePosition}%`,
          top: `${Math.max(23, startLineRoadTop - 2)}%`,
        }}
      >
        Départ
      </div>

      <div className="absolute left-4 top-4 z-30 max-w-[62%] rounded-xl bg-[#071A17]/88 px-3 py-2 text-white shadow-xl backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          {hasCrossedStartLine
            ? "La course est lancée"
            : "Départ fictif · drapeau du directeur de course"}
        </p>
        <p className="mt-1 text-[9px] font-bold text-[#C1D3CA]">
          Le peloton franchit ensemble la ligne de départ.
        </p>
      </div>

      <div
        className="absolute z-20 -translate-x-1/2 -translate-y-full transition-[left,top] duration-100 ease-linear"
        style={{
          left: `${carPosition}%`,
          top: `${carRoadTop + 3}%`,
        }}
      >
        <RaceDirectorCar isMoving={isMoving} />
      </div>

      <div
        className="absolute z-20 -translate-x-1/2 transition-[left,top] duration-100 ease-linear"
        style={{
          left: `${pelotonPosition}%`,
          top: `${pelotonRoadTop}%`,
        }}
        title={riderIds
          .map((riderId) => riderById.get(riderId)?.name)
          .filter(Boolean)
          .join(", ")}
      >
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/88 px-3 py-1 text-center text-[9px] font-black text-white shadow-lg backdrop-blur">
          Peloton · {riderIds.length} coureurs
        </div>
        <RaceDepartureFormation
          riderIds={riderIds}
          riderById={riderById}
          isMoving={isMoving}
        />
      </div>
    </>
  );
}

export function RaceDirectorCar({ isMoving }: { isMoving: boolean }) {
  return (
    <svg
      viewBox="0 0 154 82"
      role="img"
      aria-label="Voiture du directeur de course agitant le drapeau de départ"
      data-race-director-car="detailed"
      data-race-car-direction="right"
      data-race-car-front="right"
      className={`h-16 w-28 overflow-visible drop-shadow-xl ${
        isMoving ? "cm-support-car" : ""
      }`}
    >
      <defs>
        <linearGradient id="director-car-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F05A62" />
          <stop offset="0.35" stopColor="#C92F3C" />
          <stop offset="1" stopColor="#8F1F2A" />
        </linearGradient>
        <linearGradient id="director-car-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4FAF8" />
          <stop offset="1" stopColor="#66827D" />
        </linearGradient>
      </defs>
      <ellipse cx="76" cy="70" rx="66" ry="4.5" fill="rgba(5,17,14,0.22)" />
      <path
        d="M8 58 15 43q2-5 8-6l28-5 12-13q3-4 9-4h31q6 0 10 5l17 18 13 4q6 2 7 8l1 9-7 5h-14a14 14 0 0 0-27 0H52a14 14 0 0 0-27 0H12q-5-1-4-6Z"
        fill="url(#director-car-body)"
        stroke="#F7E9E7"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <path
        d="m56 32 11-13q2-2 6-2h11v16Zm31-15h14q4 0 7 4l13 13H87Z"
        fill="url(#director-car-glass)"
        stroke="#E3ECE8"
        strokeWidth="0.85"
      />
      <path d="M86 17v17M112 24l9 10" stroke="#435E59" strokeWidth="0.72" />
      <path d="M18 43h119" stroke="#FFFDF4" strokeWidth="1.2" opacity="0.8" />
      <path d="M56 33 51 60m36-26v26m39-26 5 20" fill="none" stroke="#57141B" strokeWidth="0.65" opacity="0.7" />
      <path d="M68 40h8m23 0h8" stroke="#5C1720" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M120 31h8l6 4h-12" fill="#B52632" stroke="#E3ECE8" strokeWidth="0.7" />
      <path d="M12 45h9v5h-8" fill="#7A101B" stroke="#F9B7BC" strokeWidth="0.5" />
      <rect x="136" y="44" width="10" height="5" rx="2.2" fill="#FFF2B5" stroke="#FFFDF4" strokeWidth="0.5" />
      <path d="M146 52h5v7h-8" fill="none" stroke="#F7E9E7" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M149 43h12" stroke="#FFF2B5" strokeWidth="1.1" strokeLinecap="round" opacity="0.42" />
      <path d="M149 44.5h5m-5 3h6" stroke="#FFF2B5" strokeWidth="0.7" strokeLinecap="round" opacity="0.8" />
      <path d="M12 56h9m115 0h13M65 59h27" stroke="#411015" strokeWidth="1" strokeLinecap="round" />

      {[38, 116].map((wheelX) => (
        <g
          key={wheelX}
          data-race-car-wheel="fine"
          data-race-car-wheel-animation={isMoving ? "running" : "paused"}
        >
          <circle cx={wheelX} cy="63" r="10.5" fill="#101714" stroke="#26352F" strokeWidth="1.1" />
          <circle cx={wheelX} cy="63" r="6.3" fill="#8B9A93" stroke="#E2EBE6" strokeWidth="0.72" />
          <g
            data-race-car-wheel-rotor="centered"
            className={isMoving ? "cm-race-car-wheel" : ""}
          >
            <path
              d={`M${wheelX - 5} 63h10M${wheelX} 58v10`}
              stroke="#D8E2DD"
              strokeWidth="0.52"
            />
            <path
              d={`M${wheelX - 3.55} 59.45l7.1 7.1M${wheelX + 3.55} 59.45l-7.1 7.1`}
              stroke="#D8E2DD"
              strokeWidth="0.52"
            />
          </g>
          <circle cx={wheelX} cy="63" r="2" fill="#24342E" />
        </g>
      ))}

      <g transform="translate(94 16)">
        <circle cx="0" cy="-7" r="4" fill="#D8A17C" stroke="#9D6D50" strokeWidth="0.55" />
        <path d="M-3-3 4 7" stroke="#D8A17C" strokeWidth="3" strokeLinecap="round" />
        <path d="M3 4 14 12" stroke="#D8A17C" strokeWidth="2.4" strokeLinecap="round" />
        <g transform="translate(14 12)">
          <g className={isMoving ? "cm-start-flag" : ""}>
            <path d="M0 0V-31" stroke="#FFFDF4" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M1-31h28l-7 9H1Z" fill="#F2C94C" stroke="#17261E" strokeWidth="0.9" strokeLinejoin="round" />
          </g>
        </g>
      </g>
      <text x="78" y="52" textAnchor="middle" fill="#FFFDF4" fontSize="6" fontWeight="900" letterSpacing="1">
        COURSE
      </text>
    </svg>
  );
}

function PrimePassageOverlay({
  primeResult,
  previousPrimeResult,
  segmentProgress,
  riderById,
  roadLeftPct,
  roadRightPct,
}: {
  primeResult: RacePrimeResult | null;
  previousPrimeResult: RacePrimeResult | null;
  segmentProgress: number;
  riderById: Map<string, RiderSimulationInput>;
  roadLeftPct: number;
  roadRightPct: number;
}) {
  const normalizedProgress = Math.max(0, Math.min(1, segmentProgress));
  const classificationPrime =
    primeResult && normalizedProgress >= 0.64
      ? primeResult
      : previousPrimeResult && normalizedProgress <= 0.46
        ? previousPrimeResult
        : null;
  const isMountain = primeResult?.prime.type === "mountain";
  const gateLeftPct = 108 - normalizedProgress * 38;
  const gateRoadTopPct =
    roadLeftPct +
    (roadRightPct - roadLeftPct) *
      (Math.max(0, Math.min(100, gateLeftPct)) / 100);

  return (
    <>
      {primeResult ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 z-[15] w-3 -translate-x-1/2 transition-[left,top] duration-100 ease-linear"
          style={{
            left: `${gateLeftPct}%`,
            top: `${Math.max(30, gateRoadTopPct - 3)}%`,
          }}
        >
          <div
            className={`absolute left-1/2 top-0 min-w-max -translate-x-1/2 -translate-y-full rounded-t-lg border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-xl ${
              isMountain
                ? "border-[#FF9EA6] bg-[#A92E3B]"
                : "border-[#9BE0CA] bg-[#176951]"
            }`}
          >
            {formatPrimeLabel(primeResult)}
          </div>
          <div
            className={`h-full min-h-28 w-3 border-x border-white/70 shadow-[0_0_18px_rgba(255,255,255,0.35)] ${
              isMountain
                ? "bg-[repeating-linear-gradient(0deg,#FFFDF4_0_7px,#EF5B65_7px_14px)]"
                : "bg-[repeating-linear-gradient(0deg,#FFFDF4_0_7px,#43C892_7px_14px)]"
            }`}
          />
          <div
            className={`absolute -left-8 bottom-0 h-2 w-16 -skew-y-6 border-y border-white/65 ${
              isMountain
                ? "bg-[repeating-linear-gradient(90deg,#FFFDF4_0_8px,#EF5B65_8px_16px)]"
                : "bg-[repeating-linear-gradient(90deg,#FFFDF4_0_8px,#43C892_8px_16px)]"
            }`}
          />
        </div>
      ) : null}

      {classificationPrime ? (
        <PrimeClassificationPopup
          key={`${classificationPrime.segmentNumber}-${classificationPrime.prime.type}`}
          primeResult={classificationPrime}
          riderById={riderById}
        />
      ) : null}
    </>
  );
}

export function PrimeClassificationPopup({
  primeResult,
  riderById,
}: {
  primeResult: RacePrimeResult;
  riderById: ReadonlyMap<
    string,
    Pick<RiderSimulationInput, "name" | "teamName">
  >;
}) {
  const isMountain = primeResult.prime.type === "mountain";
  const [expandedOnMobile, setExpandedOnMobile] = useState(false);

  return (
    <aside
      role="status"
      aria-live="polite"
      data-mobile-prime-classification="compact"
      className={`absolute bottom-2 right-2 z-[60] max-h-[calc(100%-1rem)] w-[min(17rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border bg-[#071A17]/95 p-2.5 text-white shadow-2xl backdrop-blur cm-prime-classification lg:bottom-4 lg:left-4 lg:right-auto lg:w-80 lg:rounded-2xl lg:p-4 ${
        isMountain ? "border-[#EF5B65]/55" : "border-[#43C892]/55"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`hidden text-[9px] font-black uppercase tracking-[0.2em] lg:block ${
              isMountain ? "text-[#FF9EA6]" : "text-[#9BE0CA]"
            }`}
          >
            Ligne franchie · la course continue
          </p>
          <h3 className="truncate text-[11px] font-black text-[#FFFDF4] lg:mt-1 lg:text-sm">
            {formatPrimeLabel(primeResult)} · classement
          </h3>
        </div>
        <span
          className={`hidden rounded-full px-2.5 py-1 text-[9px] font-black uppercase lg:inline-flex ${
            isMountain
              ? "bg-[#EF5B65]/15 text-[#FF9EA6]"
              : "bg-[#43C892]/15 text-[#9BE0CA]"
          }`}
        >
          Points
        </span>
        <button
          type="button"
          aria-expanded={expandedOnMobile}
          aria-label={
            expandedOnMobile
              ? "Réduire le classement"
              : "Afficher le top 5"
          }
          onClick={() => setExpandedOnMobile((current) => !current)}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-black lg:hidden ${
            isMountain
              ? "border-[#EF5B65]/35 bg-[#EF5B65]/15 text-[#FF9EA6]"
              : "border-[#43C892]/35 bg-[#43C892]/15 text-[#9BE0CA]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`transition-transform ${
              expandedOnMobile ? "rotate-180" : ""
            }`}
          >
            ⌄
          </span>
        </button>
      </div>
      <ol className="mt-2 space-y-1 lg:mt-3 lg:space-y-1.5">
        {primeResult.classification.slice(0, 5).map((classified, index) => {
          const rider = riderById.get(classified.riderId);
          if (!rider) return null;
          return (
            <li
              key={classified.riderId}
              data-mobile-visibility={
                index >= 3 ? "expandable" : "always"
              }
              className={`grid grid-cols-[1.1rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg bg-white/[0.055] px-2 py-1.5 text-[9px] lg:grid-cols-[1.25rem_minmax(0,1fr)_auto] lg:gap-2 lg:px-2.5 lg:py-2 lg:text-[10px] ${
                index >= 3 && !expandedOnMobile ? "hidden lg:grid" : ""
              }`}
            >
              <span className="font-black text-[#F2C94C]">
                {classified.rank}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black text-white">
                  {rider.name}
                </span>
                <span className="hidden truncate font-semibold text-[#8FA99D] lg:block">
                  {rider.teamName}
                </span>
              </span>
              <span className="font-black text-[#FFF4C4]">
                +{classified.points} pts
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function formatPrimeLabel(primeResult: RacePrimeResult) {
  if (primeResult.prime.type === "intermediate_sprint") {
    return "Sprint intermédiaire";
  }
  return `GPM${primeResult.prime.category ? ` · Cat. ${primeResult.prime.category}` : ""}`;
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
  priorityRiderIds,
  maximumVisibleRiders,
}: {
  group: RaceGroupSnapshot;
  incidents: RaceIncident[];
  riderById: Map<string, RiderSimulationInput>;
  priorityRiderIds: string[];
  maximumVisibleRiders: number;
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

  const orderedRiderIds = [...group.riderIds]
    .sort((firstId, secondId) => {
      const first = riderById.get(firstId);
      const second = riderById.get(secondId);
      const firstScore =
        (incidentRiderIds.has(firstId) ? 100 : 0) +
        (first ? rolePriority[first.role] : 0);
      const secondScore =
        (incidentRiderIds.has(secondId) ? 100 : 0) +
        (second ? rolePriority[second.role] : 0);
      return secondScore - firstScore || firstId.localeCompare(secondId);
    });
  const visiblePriorityRiderIds = priorityRiderIds.filter((riderId) =>
    orderedRiderIds.includes(riderId),
  );
  return [
    ...visiblePriorityRiderIds,
    ...orderedRiderIds.filter(
      (riderId) => !visiblePriorityRiderIds.includes(riderId),
    ),
  ].slice(0, maximumVisibleRiders);
}

function getFinishRiderName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0].charAt(0)}. ${parts.at(-1)}`;
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
  if (metersRemaining > 1_000) return "Approche de la flamme rouge";
  if (metersRemaining > 500) return "Dernier kilomètre · la sélection se fait";
  if (metersRemaining > 200) return "Les accélérations se succèdent";

  if (metersRemaining > 50) return "Sprint pour la victoire";
  if (metersRemaining > 0) return "Roue contre roue jusqu’à la ligne";
  return "Victoire arrachée";
}

function getVisualSeedNumber(seed: string) {
  return [...seed].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    7
  );
}

function getRaceSpectatorPalette(riderById: Map<string, RiderSimulationInput>) {
  const colors: string[] = [];
  for (const rider of riderById.values()) {
    for (const color of [
      rider.teamJersey?.primaryColor ?? rider.teamPrimaryColor,
      rider.teamJersey?.secondaryColor ?? rider.teamSecondaryColor,
    ]) {
      const normalized = color.toUpperCase();
      if (!colors.some((candidate) => candidate.toUpperCase() === normalized)) colors.push(color);
      if (colors.length >= 12) return colors;
    }
  }
  return colors;
}

function SprintLaneView({
  simulation,
  riderById,
  segment,
  metersRemaining,
  finalSegmentMeters,
  scenario,
  weather,
}: {
  simulation: StageSimulationResult;
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  metersRemaining: number;
  finalSegmentMeters: number;
  scenario: ReturnType<typeof getFinalBattleScenario>;
  weather: RaceWeather;
}) {
  const leadingFinishGroupRiderIds =
    getLeadingFinishGroupRiderIds(simulation);
  const battleRiderIds =
    leadingFinishGroupRiderIds.length > 0
      ? leadingFinishGroupRiderIds
      : scenario.contenderIds;
  const battleRiderSet = new Set(battleRiderIds);
  const finalists = simulation.results
    .filter(
      (result) =>
        result.status === "finished" &&
        battleRiderSet.has(result.riderId)
    )
    .sort(
      (first, second) =>
        (first.rank ?? 999) - (second.rank ?? 999)
    );
  const visibleFinalists = finalists;
  const sprintTeams = buildSprintVisualTeams(
    visibleFinalists.map((result) => {
      const rider = riderById.get(result.riderId)!;
      return {
        id: rider.id,
        teamId: rider.teamId,
        role: rider.role,
      };
    })
  );
  const trainRiderSet = new Set(
    sprintTeams.flatMap((team) => team.trainRiderIds)
  );
  const looseRiderIds = visibleFinalists
    .map((result) => result.riderId)
    .filter((riderId) => !trainRiderSet.has(riderId));
  const sprintBattle = buildSprintVisualBattle({
    riders: visibleFinalists.map((result) => riderById.get(result.riderId)!),
    results: visibleFinalists,
    seed: simulation.seed,
  });
  const favoriteRiderSet = new Set(sprintBattle.favoriteRiderIds);
  const favoriteNames = sprintBattle.favoriteRiderIds
    .map((riderId) => riderById.get(riderId)?.name.split(" ").at(-1))
    .filter((name): name is string => Boolean(name));
  const finalProgress = Math.max(
    0,
    Math.min(1, 1 - metersRemaining / Math.max(1, finalSegmentMeters))
  );
  const revealDistance = sprintBattle.dominantWinnerId ? 650 : 180;
  const sprintProgress = Math.max(
    0,
    Math.min(1, (revealDistance - metersRemaining) / revealDistance)
  );
  const decisiveProgress =
    sprintProgress * sprintProgress * (3 - 2 * sprintProgress);
  const showFinishLine = metersRemaining <= FINISH_LINE_REVEAL_METERS;
  const hasFinished = metersRemaining <= 0;
  const phaseLabel = getMassSprintPhase(metersRemaining);
  const isPhotoFinish =
    sprintBattle.dominantWinnerId === null &&
    getVisualSeedNumber(simulation.seed) % 3 === 0;
  const winnerResult = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 1
  );
  const winner = winnerResult
    ? riderById.get(winnerResult.riderId)
    : null;

  return (
    <RaceVisualViewport className="h-80 rounded-3xl border border-white/10 bg-[#2F3B37] shadow-inner shadow-black/40">
      <RoadTextureOverlay
        surface={segment.surface}
        isMoving={!hasFinished}
      />
      <FinishRoadsideInfrastructure mode="top" />
      <RaceWeatherOverlay weather={weather} />
      <div
        aria-hidden="true"
        className={`absolute inset-y-0 left-[84%] z-10 w-3 bg-[repeating-linear-gradient(0deg,#fff_0_8px,#17261E_8px_16px)] shadow-[0_0_24px_rgba(255,255,255,0.45)] transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute left-[84%] top-0 z-30 -translate-x-[42%] rounded-b-lg bg-[#FFFDF4] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#17261E] shadow-lg transition-opacity duration-300 ${showFinishLine ? "opacity-100" : "opacity-0"}`}>
        Arrivée
      </div>
      <FinishDistanceCounter metersRemaining={metersRemaining} />
      {shouldShowRaceRoadMarkings(segment.surface) ? (
        <div
          aria-hidden="true"
          data-road-center-marking="classic"
          data-road-flow-direction="right-to-left"
          className={`absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.78)_0_42px,transparent_42px_78px)] [background-size:78px_3px] ${
            !hasFinished ? "cm-race-road-marking-strip" : ""
          }`}
        />
      ) : null}
      <div className="absolute left-4 top-4 z-20 max-w-[55%] rounded-xl bg-[#071A17]/86 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          {phaseLabel}
        </p>
        <p className="mt-1 text-[10px] font-bold text-[#C1D3CA]">
          {favoriteNames.length > 0
            ? `Favoris : ${favoriteNames.join(" · ")}`
            : `${battleRiderIds.length} coureurs dans le groupe de tête`}
        </p>
        {!hasFinished && sprintBattle.dominantWinnerId ? (
          <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#FFF4C4]">
            Un favori creuse nettement l’écart
          </p>
        ) : null}
        {hasFinished && isPhotoFinish ? (
          <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#FFF4C4]">
            Photo-finish · victoire au coude-à-coude
          </p>
        ) : null}
      </div>
      <div aria-hidden="true" className="absolute inset-y-0 left-[16%] w-40 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] cm-sprint-wind" />

      {visibleFinalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const sprintTeam = sprintTeams.find(
          (team) => team.teamId === rider.teamId
        )!;
        const teamIndex = sprintTeams.indexOf(sprintTeam);
        const trainMemberIndex = sprintTeam.trainRiderIds.indexOf(
          result.riderId
        );
        const looseRiderIndex = looseRiderIds.indexOf(result.riderId);
        const isTrainMember = trainMemberIndex >= 0;
        const wheelTargetRiderId =
          sprintBattle.wheelTargetByRiderId[result.riderId] ?? null;
        const wheelTarget = wheelTargetRiderId
          ? riderById.get(wheelTargetRiderId)
          : null;
        const wheelTargetTeamIndex = wheelTarget
          ? sprintTeams.findIndex(
              (team) => team.teamId === wheelTarget.teamId
            )
          : -1;
        const favoriteIndex = sprintBattle.favoriteRiderIds.indexOf(
          result.riderId
        );
        const lane =
          wheelTargetTeamIndex >= 0
            ? wheelTargetTeamIndex % 6
            : isTrainMember
              ? teamIndex % 6
              : (sprintTeams.length + looseRiderIndex) % 6;
        const roleOffset =
          rider.role === "leadout"
            ? 5
            : rider.role === "sprinter"
              ? 1.5
              : 0;
        const trainPosition = Math.min(
          78,
          wheelTargetTeamIndex >= 0
            ? 27 +
                wheelTargetTeamIndex * 3.8 +
                finalProgress * 31 +
                0.5
            : isTrainMember
              ? 27 + teamIndex * 3.8 + finalProgress * 31 + roleOffset
              : 22 +
                  ((looseRiderIndex * 13 +
                    getVisualSeedNumber(result.riderId)) %
                    24) +
                  finalProgress * 31
        );
        const finishPosition = getFinishTargetPosition({
          rank: index + 1,
          hasFinished,
          finishLinePosition: 84,
        });
        const dominanceProgress = Math.max(
          0,
          Math.min(1, (650 - metersRemaining) / 650)
        );
        const dominanceOffset =
          result.riderId === sprintBattle.dominantWinnerId
            ? dominanceProgress * 7
            : sprintBattle.dominantWinnerId &&
                favoriteRiderSet.has(result.riderId)
              ? -dominanceProgress * Math.max(0.5, favoriteIndex * 0.45)
              : 0;
        const left = Math.max(
          14,
          Math.min(
            90,
            trainPosition * (1 - decisiveProgress) +
              finishPosition * decisiveProgress +
              dominanceOffset
          )
        );
        return (
          <div
            key={result.riderId}
            data-finish-rider-id={result.riderId}
            data-finish-rank={result.rank}
            className="absolute z-20 transition-[left,top] duration-300 ease-out"
            style={{
              left: `${left}%`,
              top: `${
                11 +
                lane * 13.4 +
                (wheelTargetRiderId
                  ? 1.2
                  : isTrainMember
                    ? trainMemberIndex * 1.1
                    : 0)
              }%`,
            }}
            title={`${hasFinished ? `${result.rank}. ` : ""}${rider.name} · ${rider.teamName}`}
          >
            <TopRaceCyclist
              rider={rider}
              celebrating={
                result.riderId === winnerResult?.riderId &&
                shouldWinnerCelebrate({
                  metersRemaining,
                  isPhotoFinish,
                })
              }
            />
            {hasFinished && result.rank !== null && result.rank <= 3 ? (
              <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/90 px-2 py-1 text-[9px] font-black text-white shadow-lg">
                {result.rank}. {rider.name.split(" ").at(-1)}
              </span>
            ) : null}
            {!hasFinished && favoriteIndex >= 0 ? (
              <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/88 px-2 py-1 text-[8px] font-black text-white/90 shadow-lg">
                {rider.name.split(" ").at(-1)}
                {wheelTarget
                  ? ` · roue de ${wheelTarget.name.split(" ").at(-1)}`
                  : favoriteIndex === 0
                    ? " · favori"
                    : ""}
              </span>
            ) : null}
          </div>
        );
      })}
      {hasFinished && winner ? (
        <FinishVictoryBanner winner={winner} />
      ) : null}
    </RaceVisualViewport>
  );
}

function FinishBattleView({
  simulation,
  riderById,
  segment,
  breakawayStillAhead,
  metersRemaining,
  finalSegmentMeters,
  scenario,
  weather,
}: {
  simulation: StageSimulationResult;
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  breakawayStillAhead: boolean;
  metersRemaining: number;
  finalSegmentMeters: number;
  scenario: ReturnType<typeof getFinalBattleScenario>;
  weather: RaceWeather;
}) {
  const battleRiderIds = scenario.contenderIds;
  const battleRiderSet = new Set(battleRiderIds);
  const roadSlopeOffset = getRaceRoadSlopeOffset(
    segment.averageGradientPct,
  );
  const roadTopCenterY = 174;
  const roadDepthY = 70;
  const roadSlopeY = roadSlopeOffset * 5.2;
  const roadLeftY = roadTopCenterY + roadSlopeY;
  const roadRightY = roadTopCenterY - roadSlopeY;
  const roadBottomLeftY = roadLeftY + roadDepthY;
  const roadBottomRightY = roadRightY + roadDepthY;
  const roadMarkingLeftY = roadLeftY + roadDepthY * 0.52;
  const roadMarkingRightY = roadRightY + roadDepthY * 0.52;
  const finishScenery = getRaceSceneryKind({
    seed: simulation.seed,
    segment,
    isFinish: true,
  });
  const finishRoadPatternId = "finish-road-surface";
  const battleDistance = Math.min(2_400, finalSegmentMeters);
  const battleProgress = Math.max(
    0,
    Math.min(1, (battleDistance - metersRemaining) / battleDistance)
  );
  const decisiveProgress =
    battleProgress * battleProgress * (3 - 2 * battleProgress);
  const finalProgress = Math.max(
    0,
    Math.min(1, 1 - metersRemaining / Math.max(1, finalSegmentMeters))
  );
  const visibleBattleRiderIds = new Set(
    getVisibleFinalBattleRiderIds(scenario, battleProgress)
  );
  const allFinalists = simulation.results
    .filter(
      (result) =>
        result.status === "finished" &&
        battleRiderSet.has(result.riderId)
    )
    .sort(
      (first, second) =>
        (first.rank ?? 999) - (second.rank ?? 999)
    );
  const finalists = allFinalists.filter((result) =>
    visibleBattleRiderIds.has(result.riderId)
  );
  const showFinishLine = metersRemaining <= FINISH_LINE_REVEAL_METERS;
  const hasFinished = metersRemaining <= 0;
  const lateJoinerById = new Map(
    scenario.lateJoiners.map((lateJoiner) => [lateJoiner.riderId, lateJoiner])
  );
  const decisiveRiderSet = new Set(scenario.decisiveContenderIds);
  const droppedRiderSet = new Set(scenario.droppedRiderIds);
  const decisiveRiderIds = allFinalists
    .filter((result) => decisiveRiderSet.has(result.riderId))
    .map((result) => result.riderId);
  const droppedRiderIds = allFinalists
    .filter((result) => droppedRiderSet.has(result.riderId))
    .map((result) => result.riderId);
  const finishVisualSeed = getVisualSeedNumber(simulation.seed);
  const entryLeaderNames = scenario.entryLeaderIds
    .map((riderId) => riderById.get(riderId)?.name)
    .filter((name): name is string => Boolean(name));
  const lateJoinerNames = scenario.lateJoiners
    .map((lateJoiner) => riderById.get(lateJoiner.riderId)?.name)
    .filter((name): name is string => Boolean(name));
  const droppedRiderNames = scenario.droppedRiderIds
    .map((riderId) => riderById.get(riderId)?.name)
    .filter((name): name is string => Boolean(name));
  const decisiveMovementText = [
    lateJoinerNames.length > 0
      ? `${formatRiderNames(lateJoinerNames)} revien${lateJoinerNames.length > 1 ? "nent" : "t"} depuis la chasse.`
      : null,
    droppedRiderNames.length > 0
      ? `${formatRiderNames(droppedRiderNames)} décroche${droppedRiderNames.length > 1 ? "nt" : ""} derrière les coureurs encore en lutte.`
      : null,
  ]
    .filter((detail): detail is string => Boolean(detail))
    .join(" ");
  const spectatorPalette = getRaceSpectatorPalette(riderById);
  const winnerResult = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 1
  );
  const runnerUpResult = simulation.results.find(
    (result) => result.status === "finished" && result.rank === 2
  );
  const winner = winnerResult
    ? riderById.get(winnerResult.riderId)
    : null;
  const runnerUp = runnerUpResult
    ? riderById.get(runnerUpResult.riderId)
    : null;
  const isPhotoFinish =
    runnerUpResult?.gapToWinnerSeconds === 0 &&
    getVisualSeedNumber(simulation.seed) % 3 === 0;

  return (
    <div>
    <RaceVisualViewport className="h-80 rounded-3xl border border-white/10 bg-[linear-gradient(#8BCAD7_0_45%,#91B879_45%_100%)] shadow-inner shadow-black/30">
      <div aria-hidden="true" className="absolute left-8 top-7 h-14 w-14 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <RaceSceneryBackdrop kind={finishScenery} isMoving={!hasFinished} showSpectators={false} />
      <svg aria-hidden="true" viewBox="0 0 1000 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <RoadSurfaceDefinition
          id={finishRoadPatternId}
          surface={segment.surface}
          isMoving={!hasFinished}
        />
        <path
          d={`M -30 ${roadBottomLeftY} L 1030 ${roadBottomRightY} L 1030 320 L -30 320 Z`}
          fill="#5F8658"
          data-road-foreground="sloped"
        />
        {[0, roadDepthY].map((depth) => (
          <g key={depth}>
            <path
              d={`M -30 ${roadLeftY + depth} L 1030 ${roadRightY + depth}`}
              fill="none"
              stroke="#557450"
              strokeWidth="26"
            />
            <path
              d={`M -30 ${roadLeftY + depth} L 1030 ${roadRightY + depth}`}
              fill="none"
              stroke="#C8B889"
              strokeWidth="16"
            />
          </g>
        ))}
        <path
          d={`M -30 ${roadLeftY} L 1030 ${roadRightY} L 1030 ${roadBottomRightY} L -30 ${roadBottomLeftY} Z`}
          fill={segment.surface === "cobbles" ? `url(#${finishRoadPatternId})` : `url(#${finishRoadPatternId}-asphalt)`}
          data-road-bounds="parallel"
          data-road-slope-offset={roadSlopeOffset}
        />
        {shouldShowRaceRoadMarkings(segment.surface) ? (
          <path
            d={`M -30 ${roadMarkingLeftY} L 1030 ${roadMarkingRightY}`}
            fill="none"
            stroke="rgba(255,255,255,0.72)"
            strokeWidth="4"
            strokeDasharray="42 34"
            data-road-flow-direction="right-to-left"
            className={!hasFinished ? "cm-race-road-marking-svg" : ""}
          />
        ) : null}
        {[0, roadDepthY].map((depth) => (
          <path
            key={`edge-${depth}`}
            d={`M -30 ${roadLeftY + depth} L 1030 ${roadRightY + depth}`}
            fill="none"
            stroke="rgba(16,32,27,0.58)"
            strokeWidth="5"
          />
        ))}
      </svg>
      <RaceRoadsideCrowd
        show
        isMoving={!hasFinished}
        roadLeftY={roadLeftY}
        roadRightY={roadRightY}
        roadDepthY={roadDepthY}
        terrain={segment.terrain}
        palette={spectatorPalette}
      />
      <RaceWeatherOverlay weather={weather} />
      <FinishRoadsideInfrastructure mode="side" roadLeftY={roadLeftY} roadRightY={roadRightY} />
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
          {scenario.entryLeaderIds.length} à l’entrée · {decisiveRiderIds.length} encore en lutte · {terrainLabel(segment.terrain)} {segment.averageGradientPct > 0 ? "+" : ""}{segment.averageGradientPct} %{segment.surface === "cobbles" ? " · pavés" : ""}
        </p>
        {breakawayStillAhead ? (
          <p className="mt-1 text-[9px] font-bold text-[#FFF4C4]">
            L’échappée joue la gagne.
          </p>
        ) : null}
      </div>

      {finalists.map((result) => {
        const rider = riderById.get(result.riderId)!;
        const lateJoiner = lateJoinerById.get(result.riderId);
        const finalIndex = allFinalists.findIndex(
          (candidate) => candidate.riderId === result.riderId
        );
        const decisiveIndex = decisiveRiderIds.indexOf(result.riderId);
        const droppedIndex = droppedRiderIds.indexOf(result.riderId);
        const left = getSmallGroupFinishPosition({
          riderIndex: finalIndex,
          riderCount: allFinalists.length,
          decisiveIndex,
          decisiveCount: decisiveRiderIds.length,
          droppedIndex,
          droppedCount: droppedRiderIds.length,
          lateJoinerGapSeconds: lateJoiner?.gapToLeaderSeconds ?? null,
          finalProgress,
          battleProgress: decisiveProgress,
          visualSeed: finishVisualSeed,
          hasFinished,
          finishLinePosition: 86,
        });
        const roadY =
          roadLeftY +
          (roadRightY - roadLeftY) * (left / 100) +
          roadDepthY * 0.55;
        const riderStatus = hasFinished
          ? result.rank === 1
            ? "Vainqueur"
            : result.gapToWinnerSeconds === 0
              ? `${result.rank}. · MT`
              : `${result.rank}. · +${formatGap(result.gapToWinnerSeconds)}`
          : lateJoiner && battleProgress < 0.58
            ? `Revient · +${formatGap(lateJoiner.gapToLeaderSeconds)}`
            : droppedRiderSet.has(result.riderId) && battleProgress >= 0.42
              ? "Décroché"
              : decisiveRiderSet.has(result.riderId) && battleProgress >= 0.35
                ? "Joue la victoire"
                : "Groupe de tête";
        return (
          <div
            key={result.riderId}
            data-finish-rider-id={result.riderId}
            data-finish-rank={result.rank}
            data-finish-status={result.rank === 1 ? "winner" : droppedRiderSet.has(result.riderId) ? "dropped" : "contender"}
            className="absolute z-20 -translate-x-1/2 -translate-y-full transition-[left,top] duration-300 ease-out"
            style={{
              left: `${left}%`,
              top: `${(roadY / 320) * 100}%`,
            }}
            title={`${hasFinished ? `${result.rank}. ` : ""}${rider.name} · ${rider.teamName}`}
          >
            <SideRaceCyclist
              rider={rider}
              isMoving
              celebrating={
                result.riderId === winnerResult?.riderId &&
                shouldWinnerCelebrate({
                  metersRemaining,
                  isPhotoFinish,
                })
              }
              className="h-12 w-[4.5rem]"
            />
            <div className={`absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg border px-1.5 py-1 text-center shadow-lg backdrop-blur-sm ${finalIndex % 2 === 0 ? "-top-8" : "top-10"} ${result.rank === 1 && hasFinished ? "border-[#F2C94C] bg-[#071A17]/96" : droppedRiderSet.has(result.riderId) && battleProgress >= 0.42 ? "border-[#B85A32]/65 bg-[#301A15]/92" : "border-white/20 bg-[#071A17]/90"}`}>
              <span className="flex items-center gap-1 text-[9px] font-black text-white">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/50"
                  style={{
                    background: `linear-gradient(135deg, ${rider.teamPrimaryColor} 0 55%, ${rider.teamSecondaryColor} 55% 100%)`,
                  }}
                />
                {getFinishRiderName(rider.name)}
              </span>
              <span className="mt-0.5 block text-[7px] font-black uppercase tracking-wide text-[#C1D3CA]">
                {riderStatus}
              </span>
            </div>
          </div>
        );
      })}
      {hasFinished && winner ? (
        <FinishVictoryBanner winner={winner} />
      ) : null}
    </RaceVisualViewport>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <FinishScenarioStep
        label="Entrée du tronçon"
        text={`${scenario.entryGroupLabel} : ${formatRiderNames(entryLeaderNames)} ouvre${entryLeaderNames.length > 1 ? "nt" : ""} la route.`}
        active={battleProgress === 0}
      />
      <FinishScenarioStep
        label="Mouvement décisif"
        text={decisiveMovementText || `Les attaques se font uniquement entre les ${battleRiderIds.length} coureurs déjà présents en tête.`}
        active={battleProgress > 0 && !hasFinished}
      />
      <FinishScenarioStep
        label="Verdict sur la ligne"
        text={hasFinished && winner
          ? `Victoire de ${winner.name} pour ${winner.teamName}${runnerUp ? ` devant ${runnerUp.name}` : ""}.`
          : "Le classement reste masqué jusqu’au franchissement de la ligne."}
        active={hasFinished}
      />
    </div>
    </div>
  );
}

function FinishVictoryBanner({
  winner,
}: {
  winner: RiderSimulationInput;
}) {
  return (
    <div data-finish-winner-id={winner.id} className="absolute bottom-4 left-1/2 z-40 w-[min(92%,34rem)] -translate-x-1/2 rounded-2xl border border-[#F2C94C]/70 bg-[#071A17]/95 px-5 py-3 text-center text-white shadow-2xl backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F2C94C]">
        Résultat officiel
      </p>
      <p className="mt-1 flex items-center justify-center gap-2 text-base font-black sm:text-lg">
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-full border border-white/60"
          style={{
            background: `linear-gradient(135deg, ${winner.teamPrimaryColor} 0 55%, ${winner.teamSecondaryColor} 55% 100%)`,
          }}
        />
        <span>Victoire de {winner.name} pour {winner.teamName}</span>
      </p>
    </div>
  );
}

function FinishScenarioStep({
  label,
  text,
  active,
}: {
  label: string;
  text: string;
  active: boolean;
}) {
  return (
    <article className={`rounded-xl border px-3 py-2.5 transition ${active ? "border-[#F2C94C]/55 bg-[#F2C94C]/12" : "border-white/10 bg-white/[0.045]"}`}>
      <p className={`text-[9px] font-black uppercase tracking-widest ${active ? "text-[#F2C94C]" : "text-[#7E9B8F]"}`}>
        {label}
      </p>
      <p className="mt-1 text-[10px] font-bold leading-4 text-[#C8D7D0]">
        {text}
      </p>
    </article>
  );
}

function formatRiderNames(names: string[]) {
  if (names.length === 0) return "Le groupe de tête";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, 2).join(", ")} et ${names.length - 2} autre${names.length > 3 ? "s" : ""}`;
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

export function RaceGapLine({
  groups,
  riderById,
}: {
  groups: RaceGroupSnapshot[];
  riderById: Map<string, RiderSimulationInput>;
}) {
  const entries = buildRaceGapLine(groups);
  const compact =
    getRaceGroupLayoutDensity(entries.length) === "compact";

  return (
    <section
      aria-labelledby="race-gap-line-title"
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p
            id="race-gap-line-title"
            className="text-xs font-black uppercase tracking-[0.16em] text-[#72D4B7]"
          >
            Ordre et écarts en course
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#91A99E]">
            De gauche à droite · tous les écarts sont mesurés depuis la tête
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#B7CAC1]">
            {entries.length} groupe
            {entries.length > 1 ? "s" : ""}
          </span>
          {entries.length > 1 ? (
            <span className="text-[10px] font-black uppercase tracking-wide text-[#F2C94C]">
              Défiler →
            </span>
          ) : null}
        </div>
      </header>
      <div
        role="region"
        aria-label="Groupes classés de la tête vers l’arrière de la course"
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain px-5 pb-5 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#72D4B7]"
      >
        <ol className="flex min-w-max snap-x snap-mandatory items-stretch">
          {entries.map((entry, index) => (
            <li
              key={entry.group.id}
              className={`flex shrink-0 snap-start flex-col ${
                compact
                  ? "w-[13rem] pr-3 sm:w-[14rem]"
                  : "w-[17rem] pr-4 sm:w-[19rem]"
              }`}
            >
              <div className="mb-3 flex h-10 items-center">
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-black ${
                    entry.position === 1
                      ? "border-[#F2C94C] bg-[#F2C94C] text-[#071A17]"
                      : "border-[#72D4B7]/55 bg-[#102B25] text-[#9BE0CA]"
                  }`}
                >
                  {entry.position}
                </span>
                <span
                  className={`ml-2 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black tabular-nums ${
                    entry.gapToLeaderSeconds === 0
                      ? "bg-[#F2C94C]/15 text-[#F7DA73]"
                      : "bg-[#72D4B7]/10 text-[#9BE0CA]"
                  }`}
                >
                  {entry.gapToLeaderSeconds === 0
                    ? "TÊTE"
                    : `+${formatGap(entry.gapToLeaderSeconds)}`}
                </span>
                {index < entries.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="relative ml-2 h-px flex-1 bg-[#72D4B7]/35"
                  >
                    <span
                      data-race-gap-arrow="on-line"
                      className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-0.5 rotate-45 border-r-2 border-t-2 border-[#72D4B7]/70"
                    />
                  </span>
                ) : null}
              </div>
              <RaceGroupCard
                group={entry.group}
                riderById={riderById}
                gapToLeaderSeconds={
                  entry.gapToLeaderSeconds
                }
                compact={compact}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RaceGroupCard({
  group,
  riderById,
  gapToLeaderSeconds,
  compact,
}: {
  group: RaceGroupSnapshot;
  riderById: Map<string, RiderSimulationInput>;
  gapToLeaderSeconds: number;
  compact: boolean;
}) {
  const isRaceLeader =
    gapToLeaderSeconds === 0;
  const displayLabel = getRaceGroupDisplayLabel({
    type: group.type,
    riderCount: group.riderIds.length,
    gapToLeaderSeconds,
    fallbackLabel: group.label,
  });

  return (
    <article
      aria-label={`${displayLabel}, ${
        isRaceLeader
          ? "en tête"
          : `à ${formatGap(gapToLeaderSeconds)} de la tête`
      }`}
      className={`flex flex-1 flex-col rounded-2xl border ${
        compact ? "min-h-[10.5rem] p-3" : "min-h-[15rem] p-4"
      } ${
        isRaceLeader
          ? "border-[#F2C94C]/35 bg-[#F2C94C]/[0.065]"
          : "border-white/10 bg-white/[0.045]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-white">
            {displayLabel}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#759286]">
            {group.riderIds.length} coureur
            {group.riderIds.length > 1 ? "s" : ""} · énergie moy. {Math.round(group.averageEnergy)} %
          </p>
        </div>
        <span className="rounded-full bg-white/[0.065] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#AFC6BB]">
          {groupTypeLabel(group)}
        </span>
      </div>
      <ul
        className={`flex-1 overflow-y-auto pr-1 font-semibold text-[#B7CAC1] ${
          compact
            ? "mt-2 max-h-28 space-y-1 text-[11px]"
            : "mt-3 max-h-44 space-y-1.5 text-xs"
        }`}
      >
        {group.riderIds.map((id) => {
          const rider = riderById.get(id);

          if (!rider) {
            return null;
          }

          return (
            <li key={id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full border"
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

function groupTypeLabel(group: RaceGroupSnapshot) {
  if (group.type === "peloton" && group.riderIds.length < 12) {
    return "Groupe";
  }

  switch (group.type) {
    case "breakaway":
      return "Échappée";
    case "chase":
      return "Poursuite";
    case "peloton":
      return "Peloton";
    case "dropped":
      return "Attardés";
    case "time_trial":
      return "Chrono";
  }
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
  snapshot: StageSimulationResult["timeline"][number];
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
                  <td className="px-4 py-3 text-[#94ADA2]">
                    {getRaceGroupDisplayLabel({
                      type: group.type,
                      riderCount: group.riderIds.length,
                      gapToLeaderSeconds: group.gapToLeaderSeconds,
                      fallbackLabel: group.label,
                    })}
                  </td>
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
  simulation: StageSimulationResult;
  riderById: Map<string, RiderSimulationInput>;
  tourStandings: StageRaceStandings | null;
}) {
  const [classificationView, setClassificationView] = useState<
    "stage" | "general"
  >("stage");
  const winnerTime = simulation.results[0].elapsedTimeSeconds;
  const resolvedView = tourStandings ? classificationView : "stage";

  return (
    <div className="p-5 sm:p-8">
      {tourStandings ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#72D4B7]">
              Course par étapes
            </p>
            <p className="mt-1 text-sm font-semibold text-[#91A99E]">
              Le résultat du jour et le cumul des étapes sont séparés.
            </p>
          </div>
          <div className="flex rounded-xl border border-white/15 bg-white/[0.055] p-1">
            <ClassificationViewButton
              active={resolvedView === "stage"}
              onClick={() => setClassificationView("stage")}
            >
              Résultat de l’étape
            </ClassificationViewButton>
            <ClassificationViewButton
              active={resolvedView === "general"}
              onClick={() => setClassificationView("general")}
            >
              Classement général
            </ClassificationViewButton>
          </div>
        </div>
      ) : null}

      {resolvedView === "stage" ? (
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
            {simulation.results.map((result, index) => {
              const rider = riderById.get(result.riderId)!;
              const abandoned = result.status === "did_not_finish";
              const outsideTimeLimit =
                result.status === "outside_time_limit";
              const previousResult = simulation.results[index - 1];
              const hasSameTimeAsPrevious =
                result.status === "finished" &&
                previousResult?.status === "finished" &&
                result.elapsedTimeSeconds === previousResult.elapsedTimeSeconds;
              return (
                <tr key={result.riderId} className={`${
                    abandoned
                      ? "bg-[#EF5B65]/[0.07]"
                      : outsideTimeLimit
                        ? "bg-[#F2C94C]/[0.07]"
                        : "bg-white/[0.025]"
                  } text-sm font-semibold`}>
                  <td className={`px-4 py-3 font-black ${
                      abandoned
                        ? "text-[#FF9EA6]"
                        : "text-[#F2C94C]"
                    }`}>
                    {outsideTimeLimit ? "HT" : result.rank ?? "—"}
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
                      : outsideTimeLimit
                        ? "Hors délais"
                      : result.rank === 1
                      ? formatTime(winnerTime)
                      : hasSameTimeAsPrevious
                        ? "MT"
                        : `+${formatGap(result.gapToWinnerSeconds)}`}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-[#94ADA2] sm:table-cell">
                    {outsideTimeLimit
                      ? "Éliminé"
                      : result.injury
                      ? `${result.injury.label} · ${result.injury.recoveryDays} j`
                      : `${Math.round(result.energyAfter)} %`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : tourStandings ? (
        <GeneralClassificationTable
          standings={tourStandings}
          riderById={riderById}
        />
      ) : null}
      {tourStandings ? (
        <TourSecondaryStandings
          standings={tourStandings}
          riderById={riderById}
        />
      ) : null}
    </div>
  );
}

function ClassificationViewButton({
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
      aria-pressed={active}
      className={`min-h-9 rounded-lg px-3 text-[10px] font-black uppercase tracking-wide transition ${
        active
          ? "bg-[#F2C94C] text-[#17261E]"
          : "text-[#AFC6BB] hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function GeneralClassificationTable({
  standings,
  riderById,
}: {
  standings: StageRaceStandings;
  riderById: Map<string, RiderSimulationInput>;
}) {
  const leaderTime = standings.general[0]?.elapsedTimeSeconds ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#F2C94C]/25">
      <table className="w-full border-collapse text-left">
        <thead className="bg-[#F2C94C]/10 text-[10px] font-black uppercase tracking-widest text-[#DCCF9B]">
          <tr>
            <th className="px-4 py-3">Gén.</th>
            <th className="px-4 py-3">Coureur</th>
            <th className="hidden px-4 py-3 md:table-cell">Équipe</th>
            <th className="px-4 py-3 text-right">Temps cumulé / écart</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {standings.general.map((result, index) => {
            const rider = riderById.get(result.riderId)!;
            return (
              <tr key={result.riderId} className="bg-white/[0.025] text-sm font-semibold">
                <td className="px-4 py-3 font-black text-[#F2C94C]">
                  {index + 1}
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
                <td className="hidden px-4 py-3 text-[#94ADA2] md:table-cell">
                  {rider.teamName}
                </td>
                <td className="px-4 py-3 text-right font-black">
                  {index === 0
                    ? formatTime(result.elapsedTimeSeconds)
                    : `+${formatGap(result.elapsedTimeSeconds - leaderTime)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TourSecondaryStandings({
  standings,
  riderById,
}: {
  standings: StageRaceStandings;
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
      title: "Meilleure équipe · temps moyen",
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
    ["Rejouabilité", "Une graine fixe tous les aléas : un résultat peut être reproduit, expliqué et testé."],
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
        Mode actif : {stageType === "road" ? "course en ligne" : "contre-la-montre"}. Les paramètres sont volontairement centralisés dans le moteur pour pouvoir les rééquilibrer sans refaire l’interface.
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
