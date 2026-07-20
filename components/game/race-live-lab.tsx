"use client";

import { useEffect, useMemo, useState } from "react";

import { RaceStageProfile } from "@/components/game/race-stage-profile";
import type { RaceCalendarEdition, RaceCalendarStage } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import { createCalendarSimulationInput } from "@/lib/game/race-simulation-demo";
import {
  RACE_ROLE_LABELS,
  simulateRaceStage,
  type RaceGroupSnapshot,
  type RiderSimulationInput,
} from "@/lib/game/race-simulation";

type LabTab = "live" | "classification" | "rules";

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
  const seed = `${edition.id}:${stage.id}:official`;
  const input = useMemo(
    () => createCalendarSimulationInput({ edition, stage, seed }),
    [edition, seed, stage]
  );
  const simulation = useMemo(() => simulateRaceStage(input), [input]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(mode === "live");
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
    if (mode === "live") return;
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= simulation.timeline.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1_050);

    return () => window.clearInterval(timer);
  }, [isPlaying, mode, simulation.timeline.length]);

  const distance = input.segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0
  );
  const isFinal = displayedIndex === simulation.timeline.length - 1;
  const isRoad = input.stageType === "road";
  const activeSegment = input.segments[displayedIndex];
  const finalSegment = input.segments.at(-1)!;
  const breakawayStillAhead = simulation.timeline.at(-1)?.groups.some((group) => group.type === "breakaway") ?? false;
  const isMassSprint =
    finalSegment.terrain === "flat" &&
    input.segments.slice(-3).filter((segment) => segment.terrain === "flat").length >= 2 &&
    !breakawayStillAhead;

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
                    setIsPlaying(false);
                  }
                : undefined
            }
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {mode === "replay" ? <button
                type="button"
                onClick={() => {
                  if (isFinal && !isPlaying) {
                    setActiveIndex(0);
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
            />
          ) : isFinal && isRoad ? (
            <FinishBattleView
              simulation={simulation}
              riderById={riderById}
              segment={finalSegment}
              breakawayStillAhead={breakawayStillAhead}
            />
          ) : (
            <RoadScene snapshot={snapshot} riderById={riderById} segment={activeSegment} isMoving={isPlaying} />
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
          <Classification simulation={simulation} riderById={riderById} />
        )
      ) : (
        <ActiveRules stageType={input.stageType} />
      )}
    </section>
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
  const sky =
    segment.terrain === "climb"
      ? "bg-[linear-gradient(#83C0D0_0_40%,#7FAE72_40%_57%,#35453F_57%_100%)]"
      : segment.terrain === "descent"
        ? "bg-[linear-gradient(#9ACFDA_0_47%,#A7C585_47%_63%,#35453F_63%_100%)]"
        : "bg-[linear-gradient(#8FD1DC_0_46%,#A7C585_46%_64%,#35453F_64%_100%)]";

  return (
    <div className={`relative mt-6 h-72 overflow-hidden rounded-3xl border border-white/10 shadow-inner shadow-black/25 ${sky}`}>
      <div aria-hidden="true" className="absolute left-8 top-7 h-16 w-16 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <div aria-hidden="true" className={`absolute inset-x-0 bottom-[35%] flex gap-20 opacity-35 ${isMoving ? "cm-race-scenery" : ""}`}>
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className="block h-12 w-4 shrink-0 rounded-t-full bg-[#244C38] shadow-[0_18px_0_8px_#244C38]" />
        ))}
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[22%] h-[2px] bg-white/35" />
      <div aria-hidden="true" className={`absolute inset-x-[-12%] bottom-[11%] border-t-2 border-dashed border-white/25 ${isMoving ? "cm-race-road-flow" : ""}`} />
      <p className="absolute right-4 top-4 rounded-full bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
        {terrainLabel(segment.terrain)} {segment.averageGradientPct ? `${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %` : ""} · {formatDistance(snapshot.completedDistanceKm)} km
      </p>

      {groups.map((group, groupIndex) => {
        const left = getGroupScreenPosition(group, groupIndex, groups.length);
        return (
          <div
            key={group.id}
            className="absolute bottom-[23%] -translate-x-1/2 transition-[left] duration-700 ease-out"
            style={{ left: `${left}%`, zIndex: 20 - groupIndex }}
            title={group.riderIds.map((id) => riderById.get(id)?.name).filter(Boolean).join(", ")}
          >
            <div className="mb-2 whitespace-nowrap rounded-full bg-[#071A17]/85 px-2.5 py-1 text-center text-[10px] font-black text-white shadow-lg backdrop-blur">
              {group.label} {group.gapToLeaderSeconds > 0 ? `+${formatGap(group.gapToLeaderSeconds)}` : ""}
            </div>
            <div className="flex -space-x-3">
              {group.riderIds.slice(0, 5).map((riderId) => {
                const rider = riderById.get(riderId)!;
                return <SideCyclist key={riderId} rider={rider} isMoving={isMoving} />;
              })}
              {group.riderIds.length > 5 ? (
                <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-[#071A17] text-[9px] font-black">
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

function SprintLaneView({
  simulation,
  riderById,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
}) {
  const finalists = simulation.results.slice(0, 12);

  return (
    <div className="relative mt-6 h-80 overflow-hidden rounded-3xl border border-white/10 bg-[#2F3B37] shadow-inner shadow-black/40">
      <div aria-hidden="true" className="absolute inset-y-0 left-[91%] w-3 bg-[repeating-linear-gradient(0deg,#fff_0_8px,#17261E_8px_16px)] shadow-2xl" />
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-white/20"
          style={{ top: `${18 + index * 16}%` }}
        />
      ))}
      <div className="absolute left-4 top-4 z-20 rounded-xl bg-[#071A17]/80 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          Sprint final · 200 mètres
        </p>
      </div>
      <div aria-hidden="true" className="absolute inset-y-0 left-[16%] w-40 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] cm-sprint-wind" />

      {finalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const lane = (index * 3 + Math.floor(index / 5)) % 6;
        const wave = index >= 6 ? 7 : 0;
        const left = 88 - result.rank * 2.35 - wave;
        return (
          <div
            key={result.riderId}
            className="absolute z-10 cm-sprint-surge"
            style={{
              left: `${left}%`,
              top: `${10 + lane * 13.2}%`,
              animationDelay: `${Math.min(0.7, index * 0.055)}s`,
            }}
            title={`${result.rank}. ${rider.name} · ${rider.teamName}`}
          >
            <TopCyclist rider={rider} />
            {result.rank <= 3 ? (
              <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/90 px-2 py-1 text-[9px] font-black text-white shadow-lg">
                {result.rank}. {rider.name.split(" ").at(-1)}
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
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
  segment: RaceCalendarStage["segments"][number];
  breakawayStillAhead: boolean;
}) {
  const finalists = simulation.results.slice(0, 8);
  const isClimb = segment.terrain === "climb";

  return (
    <div className="relative mt-6 h-80 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(#8BCAD7_0_45%,#91B879_45%_100%)] shadow-inner shadow-black/30">
      <div aria-hidden="true" className="absolute left-8 top-7 h-14 w-14 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <svg aria-hidden="true" viewBox="0 0 1000 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path
          d={isClimb ? "M -30 305 L 1030 125 L 1030 320 L -30 320 Z" : "M -30 250 L 1030 225 L 1030 320 L -30 320 Z"}
          fill="#35453F"
        />
        <path
          d={isClimb ? "M -30 279 L 1030 99" : "M -30 224 L 1030 199"}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="4"
          strokeDasharray="28 24"
          className="cm-finish-road-line"
        />
      </svg>
      <div className="absolute left-4 top-4 z-20 rounded-xl bg-[#071A17]/82 px-3 py-2 text-white backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          {isClimb ? `Final en côte · ${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %` : "Bataille pour la victoire"}
        </p>
        {breakawayStillAhead ? <p className="mt-1 text-xs font-semibold text-[#C1D3CA]">L’échappée joue la gagne.</p> : null}
      </div>

      {finalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const left = 76 - index * 5.8;
        const bottom = isClimb ? 25 + left * 0.18 : 23 + left * 0.025;
        return (
          <div
            key={result.riderId}
            className="absolute z-10 cm-climb-surge"
            style={{ left: `${left}%`, bottom: `${bottom}%`, animationDelay: `${index * 0.09}s` }}
            title={`${result.rank}. ${rider.name} · ${rider.teamName}`}
          >
            <SideCyclist rider={rider} className="h-12 w-[4.5rem]" />
            {index < 3 ? (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#071A17]/88 px-2 py-1 text-[9px] font-black text-white shadow-lg">
                {result.rank}. {rider.name.split(" ").at(-1)}
              </span>
            ) : null}
          </div>
        );
      })}
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
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.slice(0, 6).map((group) => (
        <article key={group.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-white">{group.label}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#759286]">
                {group.riderIds.length} coureur{group.riderIds.length > 1 ? "s" : ""} · énergie {Math.round(group.averageEnergy)} %
              </p>
            </div>
            <span className="rounded-full bg-[#F2C94C]/10 px-2.5 py-1 text-[10px] font-black text-[#F2C94C]">
              {group.gapToLeaderSeconds ? `+${formatGap(group.gapToLeaderSeconds)}` : "Tête"}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs font-semibold text-[#B7CAC1]">
            {group.riderIds.slice(0, 5).map((id) => {
              const rider = riderById.get(id)!;
              return (
                <li key={id} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full border"
                    style={{ backgroundColor: rider.teamPrimaryColor, borderColor: rider.teamSecondaryColor }}
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
      ))}
    </div>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Classification({
  simulation,
  riderById,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
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
            {simulation.results.slice(0, 15).map((result) => {
              const rider = riderById.get(result.riderId)!;
              return (
                <tr key={result.riderId} className="bg-white/[0.025] text-sm font-semibold">
                  <td className="px-4 py-3 font-black text-[#F2C94C]">{result.rank}</td>
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
                    {result.rank === 1
                      ? formatTime(winnerTime)
                      : result.gapToWinnerSeconds === 0
                        ? "m.t."
                        : `+${formatGap(result.gapToWinnerSeconds)}`}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-[#94ADA2] sm:table-cell">
                    {Math.round(result.energyAfter)} %
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActiveRules({ stageType }: { stageType: string }) {
  const rules = [
    ["Résolution", "Un calcul par tronçon de 10 km, avec un dernier tronçon ajusté à la distance exacte."],
    ["Aspiration", "Le coût énergétique diminue avec la taille du groupe ; une petite échappée paie davantage qu’un peloton."],
    ["Terrain", "PLA, MON, VAL, PAV et DES sont pondérées par le profil, la pente et le revêtement."],
    ["Énergie", "La forme constitue le capital initial ; END et RES déterminent la capacité à tenir le rythme et les efforts."],
    ["Tactique", "Les rôles orientent les attaques, la poursuite, les trains de sprint et les classements annexes."],
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
