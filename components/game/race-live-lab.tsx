"use client";

import { useEffect, useMemo, useState } from "react";

import {
  RACE_DEMO_SCENARIOS,
  createDemoSimulationInput,
  type RaceDemoScenarioId,
} from "@/lib/game/race-simulation-demo";
import {
  RACE_ROLE_LABELS,
  simulateRaceStage,
  type RaceGroupSnapshot,
  type RiderSimulationInput,
} from "@/lib/game/race-simulation";

type LabTab = "live" | "classification" | "rules";

export function RaceLiveLab() {
  const [scenarioId, setScenarioId] = useState<RaceDemoScenarioId>(
    RACE_DEMO_SCENARIOS[0].id
  );
  const [seed, setSeed] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tab, setTab] = useState<LabTab>("live");
  const input = useMemo(
    () => createDemoSimulationInput(scenarioId, seed),
    [scenarioId, seed]
  );
  const simulation = useMemo(() => simulateRaceStage(input), [input]);
  const riderById = useMemo(
    () => new Map(simulation.resolvedRiders.map((rider) => [rider.id, rider])),
    [simulation.resolvedRiders]
  );
  const snapshot = simulation.timeline[activeIndex];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        if (current >= simulation.timeline.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [isPlaying, simulation.timeline.length]);

  function changeScenario(value: string) {
    setScenarioId(value as RaceDemoScenarioId);
    setActiveIndex(0);
    setIsPlaying(false);
    setTab("live");
  }

  function replayWithNewSeed() {
    setSeed((current) => current + 1);
    setActiveIndex(0);
    setIsPlaying(false);
    setTab("live");
  }

  const distance = input.segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0
  );
  const isFinal = activeIndex === simulation.timeline.length - 1;
  const isRoad = input.stageType === "road";

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#1D5145]/20 bg-[#071A17] text-[#FFFDF4] shadow-[0_30px_80px_rgba(7,26,23,0.22)]">
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(66,185,154,0.2),transparent_38%)] px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#72D4B7]">
              Banc d’essai · moteur V1
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              {input.name}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#AFC6BB]">
              {formatDistance(distance)} km · {input.segments.length} tronçons · graine {seed}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-widest text-[#AFC6BB]">
              Scénario
              <select
                value={scenarioId}
                onChange={(event) => changeScenario(event.target.value)}
                className="min-h-11 rounded-xl border border-white/15 bg-[#102A25] px-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-[#72D4B7]"
              >
                {RACE_DEMO_SCENARIOS.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={replayWithNewSeed}
              className="self-end min-h-11 rounded-xl bg-[#F2C94C] px-4 text-xs font-black uppercase tracking-wide text-[#17261E] transition hover:bg-[#F7DA73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Nouvelle simulation
            </button>
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
          <StageProfile
            segments={input.segments}
            activeIndex={activeIndex}
            onSelect={(index) => {
              setActiveIndex(index);
              setIsPlaying(false);
            }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
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
              </button>
              <span className="text-xs font-bold text-[#AFC6BB]">
                Tronçon {snapshot.segmentNumber}/{input.segments.length} · {formatDistance(snapshot.completedDistanceKm)} km
              </span>
            </div>
            <p className="text-[11px] font-semibold text-[#7E9B8F]">
              Survolez un groupe ou un coureur pour l’identifier.
            </p>
          </div>

          {isFinal && isRoad ? (
            <SprintLaneView
              simulation={simulation}
              riderById={riderById}
              isMassSprint={input.segments.slice(-3).every((segment) => segment.terrain === "flat")}
            />
          ) : (
            <RoadScene snapshot={snapshot} riderById={riderById} />
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
            <GroupDetails groups={snapshot.groups} riderById={riderById} />
            <RaceCommentary commentary={snapshot.commentary} />
          </div>
        </div>
      ) : tab === "classification" ? (
        <Classification simulation={simulation} riderById={riderById} />
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

function StageProfile({
  segments,
  activeIndex,
  onSelect,
}: {
  segments: ReturnType<typeof createDemoSimulationInput>["segments"];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D2621] px-2 pt-5">
        {segments.map((segment, index) => {
          const height =
            segment.terrain === "climb"
              ? 34 + Math.abs(segment.averageGradientPct) * 5.4
              : segment.terrain === "descent"
                ? 29
                : 35;
          const background =
            segment.surface === "cobbles"
              ? "repeating-linear-gradient(135deg,#8F806B 0 5px,#B0A28E 5px 9px)"
              : segment.terrain === "climb"
                ? "linear-gradient(#8CC59C,#3D7A50)"
                : segment.terrain === "descent"
                  ? "linear-gradient(#B5D4AA,#5E9362)"
                  : "linear-gradient(#8FC7A0,#5C9A6C)";
          const prime = segment.prime;
          const title = `T${segment.segmentNumber} · ${formatDistance(segment.distanceKm)} km · ${terrainLabel(segment.terrain)}${
            segment.averageGradientPct ? ` ${segment.averageGradientPct > 0 ? "+" : ""}${segment.averageGradientPct} %` : ""
          } · ${segment.surface === "cobbles" ? "pavés" : "bitume"}`;

          return (
            <button
              key={segment.segmentNumber}
              type="button"
              title={title}
              aria-label={title}
              onClick={() => onSelect(index)}
              className={`group relative min-w-0 flex-1 rounded-t-sm outline-none transition ${
                index <= activeIndex ? "opacity-100" : "opacity-35"
              } ${index === activeIndex ? "ring-2 ring-[#F2C94C] ring-offset-2 ring-offset-[#0D2621]" : "hover:opacity-80"}`}
              style={{ height: `${Math.min(92, height)}px`, background }}
            >
              {prime ? (
                <span
                  aria-hidden="true"
                  className={`absolute -top-5 left-1/2 h-6 w-0.5 ${
                    prime.type === "mountain" ? "bg-red-400" : "bg-emerald-300"
                  }`}
                >
                  <span className="absolute left-0 top-0 h-2.5 w-3 rounded-sm bg-current" />
                </span>
              ) : null}
              <span className="sr-only">{title}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-[#78968A]">
        <span><span className="text-red-400">⚑</span> Grand Prix montagne</span>
        <span><span className="text-emerald-300">⚑</span> Sprint intermédiaire</span>
        <span>Chaque bloc = 10 km, sauf le dernier</span>
      </div>
    </div>
  );
}

function RoadScene({
  snapshot,
  riderById,
}: {
  snapshot: ReturnType<typeof simulateRaceStage>["timeline"][number];
  riderById: Map<string, RiderSimulationInput>;
}) {
  return (
    <div className="relative mt-6 h-72 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(#8FD1DC_0_46%,#A7C585_46%_64%,#35453F_64%_100%)] shadow-inner shadow-black/25">
      <div aria-hidden="true" className="absolute left-8 top-7 h-16 w-16 rounded-full bg-[#FFF2B5] opacity-80 blur-sm" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[22%] h-[2px] bg-white/35" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[11%] border-t-2 border-dashed border-white/25" />
      <p className="absolute right-4 top-4 rounded-full bg-[#071A17]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
        Vue latérale · {formatDistance(snapshot.completedDistanceKm)} km
      </p>

      {snapshot.groups.slice(0, 6).map((group, groupIndex) => {
        const left = 82 - Math.min(68, group.gapToLeaderSeconds * 0.09);
        return (
          <div
            key={group.id}
            className="absolute bottom-[23%] -translate-x-1/2 transition-all duration-700"
            style={{ left: `${left}%`, zIndex: 20 - groupIndex }}
            title={group.riderIds.map((id) => riderById.get(id)?.name).filter(Boolean).join(", ")}
          >
            <div className="mb-2 whitespace-nowrap rounded-full bg-[#071A17]/85 px-2.5 py-1 text-center text-[10px] font-black text-white shadow-lg backdrop-blur">
              {group.label} {group.gapToLeaderSeconds > 0 ? `+${formatGap(group.gapToLeaderSeconds)}` : ""}
            </div>
            <div className="flex -space-x-3">
              {group.riderIds.slice(0, 5).map((riderId) => {
                const rider = riderById.get(riderId)!;
                return <SideCyclist key={riderId} rider={rider} />;
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

function SideCyclist({ rider }: { rider: RiderSimulationInput }) {
  return (
    <svg
      viewBox="0 0 54 38"
      role="img"
      aria-label={rider.name}
      className="h-10 w-14 drop-shadow-md"
    >
      <circle cx="12" cy="29" r="8" fill="none" stroke="#E7EEE9" strokeWidth="2" />
      <circle cx="42" cy="29" r="8" fill="none" stroke="#E7EEE9" strokeWidth="2" />
      <path d="M12 29 23 18l8 11H12l9-14 11 2 10 12" fill="none" stroke="#D8E3DD" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="29" cy="7" r="4" fill="#E6B18B" />
      <path d="m27 11-7 8 11 2 5-8Z" fill={rider.teamPrimaryColor} stroke={rider.teamSecondaryColor} strokeWidth="1.5" />
      <path d="m32 13 8 2" stroke="#E6B18B" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function SprintLaneView({
  simulation,
  riderById,
  isMassSprint,
}: {
  simulation: ReturnType<typeof simulateRaceStage>;
  riderById: Map<string, RiderSimulationInput>;
  isMassSprint: boolean;
}) {
  const finalists = simulation.results.slice(0, 12);

  return (
    <div className="relative mt-6 h-72 overflow-hidden rounded-3xl border border-white/10 bg-[#263833] shadow-inner shadow-black/40">
      <div aria-hidden="true" className="absolute inset-y-0 left-[12%] w-1 bg-white/80" />
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="absolute inset-x-0 border-t border-dashed border-white/20"
          style={{ top: `${(index + 1) * 14.25}%` }}
        />
      ))}
      <div className="absolute left-4 top-4 z-20 rounded-xl bg-[#071A17]/80 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#F2C94C]">
          Dernier kilomètre · vue aérienne
        </p>
        <p className="mt-1 text-xs font-semibold text-[#C1D3CA]">
          {isMassSprint ? "Les trains occupent toute la largeur de la route." : "Les favoris se disputent la victoire."}
        </p>
      </div>
      <div className="absolute inset-y-0 left-[10%] border-l-2 border-dashed border-white/70" />

      {finalists.map((result, index) => {
        const rider = riderById.get(result.riderId)!;
        const lane = index % 6;
        const column = Math.floor(index / 6);
        const left = 18 + Math.max(0, 68 - result.rank * 4.2 - column * 4);
        return (
          <div
            key={result.riderId}
            className="absolute z-10 transition-all duration-700"
            style={{ left: `${left}%`, top: `${10 + lane * 14}%` }}
            title={`${result.rank}. ${rider.name} · ${rider.teamName}`}
          >
            <div
              className="h-8 w-4 rounded-[50%_50%_38%_38%] border-2 shadow-lg"
              style={{
                backgroundColor: rider.teamPrimaryColor,
                borderColor: rider.teamSecondaryColor,
              }}
            />
            <span className="absolute -right-5 top-1 text-[9px] font-black text-white">
              {result.rank}
            </span>
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
