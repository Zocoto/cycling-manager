"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeYouthManualTrainingAction,
  startYouthManualTrainingAction,
} from "@/app/jeu/centre-de-formation/actions";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import {
  YOUTH_TRAINING_GAME_LABELS,
  calculateYouthMiniGameScore,
  type YouthManualTrainingSlot,
  type YouthTrainingGameType,
  type YouthTrainingMode,
} from "@/lib/game/youth-training";

type CompletedReport = {
  score: number;
  slot: YouthManualTrainingSlot;
  trainingPriority: string;
  ratingChanges: Record<string, number>;
};

type GamePhase =
  | "idle"
  | "starting"
  | "playing"
  | "submitting"
  | "completed"
  | "error";

export function YouthTrainingMiniGame({
  academyRiderId,
  riderName,
  trainingMode,
  gameType,

  currentSlotLabel,
  currentSlotCompleted,
  currentSlotScore,
  completedSlotCount,
}: {
  academyRiderId: string;
  riderName: string;
  trainingMode: YouthTrainingMode;
  gameType: YouthTrainingGameType;

  currentSlotLabel: string;
  currentSlotCompleted: boolean;
  currentSlotScore: number | null;
  completedSlotCount: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [activeGameType, setActiveGameType] =
    useState<YouthTrainingGameType>(gameType);
  const [durationSeconds, setDurationSeconds] = useState(35);
  const [secondsLeft, setSecondsLeft] = useState(35);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CompletedReport | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0.5);
  const [reflexTarget, setReflexTarget] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [speedExpected, setSpeedExpected] =
    useState<"left" | "right">("left");

  const gameStartedAtRef = useRef(0);
  const cursorPositionRef = useRef(0.5);
  const rhythmPointsRef = useRef(0);
  const rhythmTapsRef = useRef(0);
  const lastRhythmTapRef = useRef(0);
  const reflexHitsRef = useRef(0);
  const reflexOpportunitiesRef = useRef(0);
  const speedTapsRef = useRef(0);
  const speedExpectedRef = useRef<"left" | "right">("left");
  const finishingRef = useRef(false);

  const finishGame = useCallback(async () => {
    if (!attemptId || finishingRef.current) return;
    finishingRef.current = true;
    setPhase("submitting");

    const score = calculateYouthMiniGameScore({
      gameType: activeGameType,
      rhythmPoints: rhythmPointsRef.current,
      rhythmTaps: rhythmTapsRef.current,
      reflexHits: reflexHitsRef.current,
      reflexOpportunities: reflexOpportunitiesRef.current,
      speedTaps: speedTapsRef.current,
    });

    try {
      const result = await completeYouthManualTrainingAction({
        attemptId,
        score,
      });
      if (!result.ok) {
        setError(result.error);
        setPhase("error");
        return;
      }
      setReport(result.report);
      setPhase("completed");
      router.refresh();
    } catch {
      setError("Le résultat ne peut pas être enregistré pour le moment.");
      setPhase("error");
    } finally {
      finishingRef.current = false;
    }
  }, [activeGameType, attemptId, router]);

  useEffect(() => {
    if (phase !== "playing") return;

    gameStartedAtRef.current = performance.now();
    const finishTimer = window.setTimeout(
      () => void finishGame(),
      durationSeconds * 1_000,
    );
    const countdownTimer = window.setInterval(() => {
      const elapsedSeconds =
        (performance.now() - gameStartedAtRef.current) / 1_000;
      setSecondsLeft(Math.max(0, Math.ceil(durationSeconds - elapsedSeconds)));
    }, 100);

    let animationFrame = 0;
    let reflexTimer = 0;

    if (activeGameType === "rhythm") {
      const animate = (timestamp: number) => {
        const elapsed = timestamp - gameStartedAtRef.current;
        const phase = elapsed / 350 + Math.sin(elapsed / 2_300) * 2;
        const position = (Math.sin(phase) + 1) / 2;
        cursorPositionRef.current = position;
        setCursorPosition(position);
        animationFrame = window.requestAnimationFrame(animate);
      };
      animationFrame = window.requestAnimationFrame(animate);
    }

    if (activeGameType === "reflex") {
      const spawnTarget = () => {
        reflexOpportunitiesRef.current += 1;
        setReflexTarget(Math.floor(Math.random() * 9));
      };
      spawnTarget();
      reflexTimer = window.setInterval(spawnTarget, 820);
    }

    return () => {
      window.clearTimeout(finishTimer);
      window.clearInterval(countdownTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (reflexTimer) window.clearInterval(reflexTimer);
    };
  }, [activeGameType, durationSeconds, finishGame, phase]);

  async function startGame() {
    setPhase("starting");
    setError(null);
    setReport(null);
    resetCounters();

    try {
      const result = await startYouthManualTrainingAction({
        academyRiderId,
      });
      if (!result.ok) {
        setError(result.error);
        setPhase("error");
        return;
      }

      setAttemptId(result.attempt.attemptId);
      setActiveGameType(result.attempt.gameType);
      setDurationSeconds(result.attempt.durationSeconds);
      setSecondsLeft(result.attempt.durationSeconds);
      setPhase("playing");
    } catch {
      setError("Le minijeu ne peut pas être lancé pour le moment.");
      setPhase("error");
    }
  }

  function resetCounters() {
    rhythmPointsRef.current = 0;
    rhythmTapsRef.current = 0;
    lastRhythmTapRef.current = 0;
    reflexHitsRef.current = 0;
    reflexOpportunitiesRef.current = 0;
    speedTapsRef.current = 0;
    speedExpectedRef.current = "left";
    setSpeedExpected("left");
    finishingRef.current = false;
    setLiveCount(0);
    setReflexTarget(null);
  }

  function registerRhythmTap() {
    const now = performance.now();
    if (now - lastRhythmTapRef.current < 240) return;
    lastRhythmTapRef.current = now;
    const distanceFromTarget = Math.abs(cursorPositionRef.current - 0.5);
    const accuracy = Math.max(0, 1 - distanceFromTarget / 0.28);
    rhythmPointsRef.current += accuracy * 1_000;
    rhythmTapsRef.current += 1;
    setLiveCount(rhythmTapsRef.current);
  }

  function registerReflexHit(index: number) {
    if (index !== reflexTarget) return;
    reflexHitsRef.current += 1;
    setLiveCount(reflexHitsRef.current);
    setReflexTarget(null);
  }

  function registerSpeedTap(side: "left" | "right") {
    if (speedExpectedRef.current !== side) return;
    speedTapsRef.current += 1;
    const nextSide = side === "left" ? "right" : "left";
    speedExpectedRef.current = nextSide;
    setSpeedExpected(nextSide);
    setLiveCount(speedTapsRef.current);
  }

  if (trainingMode === "automatic") {
    return (
      <div className="rounded-2xl border border-[#176951]/15 bg-[#EAF5F3] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#278B70]">
              Entraînement automatique
            </p>
            <p className="mt-1 text-xs font-bold text-[#315B3E]">
              Séance quotidienne à 8 h · efficacité junior ×2
            </p>
          </div>
          <span className="rounded-full bg-[#176951] px-3 py-1.5 text-[9px] font-black uppercase text-white">
            Auto
          </span>
        </div>
      </div>
    );
  }

  if (currentSlotCompleted && phase !== "completed") {
    return (
      <div className="rounded-2xl border border-[#72D4B7]/35 bg-[#EAF5F3] p-4">
        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#278B70]">
          {currentSlotLabel} · séance terminée
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-[#315B3E]">
            {completedSlotCount}/2 créneaux réalisés aujourd’hui
          </p>
          <strong className="text-xl text-[#176951]">
            {currentSlotScore ?? 0}/1000
          </strong>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-[#F2C94C]/40 bg-[#FFF9E7] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#8A6B16]">
              Créneau manuel · {currentSlotLabel}
            </p>
            <p className="mt-1 text-xs font-bold text-[#4F4A32]">
              {YOUTH_TRAINING_GAME_LABELS[gameType]} · 35 secondes
            </p>
          </div>
          <button
            type="button"
            onClick={() => void startGame()}
            disabled={phase === "starting" || phase === "submitting"}
            className="min-h-10 rounded-xl bg-[#F2C94C] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[#071A17] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {phase === "starting" ? "Préparation…" : "Lancer le minijeu"}
          </button>
        </div>
        <p className="mt-2 text-[10px] font-semibold text-[#756B48]">
          {completedSlotCount}/2 créneaux réalisés aujourd’hui. Un créneau
          manqué ne sera pas remplacé automatiquement.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        ) : null}
        {report ? <TrainingResult report={report} /> : null}
      </div>

      {phase === "playing" || phase === "submitting" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Entraînement de ${riderName}`}
          className="fixed inset-0 z-[100] grid place-items-center bg-[#071A17]/90 p-3 backdrop-blur-sm sm:p-6"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#F8FBF9] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <header className="flex items-center justify-between gap-4 bg-[#0B302B] px-5 py-4 text-white sm:px-7">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0CA]">
                  {YOUTH_TRAINING_GAME_LABELS[activeGameType]}
                </p>
                <h2 className="mt-1 text-lg font-black">{riderName}</h2>
              </div>
              <span className="rounded-full bg-white/10 px-4 py-2 text-2xl font-black tabular-nums">
                {secondsLeft}s
              </span>
            </header>

            <div className="p-5 sm:p-8">
              {phase === "submitting" ? (
                <div className="grid min-h-72 place-items-center text-center">
                  <div>
                    <span className="mx-auto block h-12 w-12 animate-spin rounded-full border-4 border-[#176951]/20 border-t-[#176951]" />
                    <p className="mt-5 font-black text-[#0B302B]">
                      Validation du score…
                    </p>
                  </div>
                </div>
              ) : (
                <GameSurface
                  gameType={activeGameType}
                  cursorPosition={cursorPosition}
                  reflexTarget={reflexTarget}
                  liveCount={liveCount}
                  speedExpected={speedExpected}
                  onRhythmTap={registerRhythmTap}
                  onReflexHit={registerReflexHit}
                  onSpeedTap={registerSpeedTap}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GameSurface({
  gameType,
  cursorPosition,
  reflexTarget,
  liveCount,
  speedExpected,
  onRhythmTap,
  onReflexHit,
  onSpeedTap,
}: {
  gameType: YouthTrainingGameType;
  cursorPosition: number;
  reflexTarget: number | null;
  liveCount: number;
  speedExpected: "left" | "right";
  onRhythmTap: () => void;
  onReflexHit: (index: number) => void;
  onSpeedTap: (side: "left" | "right") => void;
}) {
  if (gameType === "rhythm") {
    return (
      <div className="min-h-72 text-center">
        <p className="text-sm font-bold text-[#48665F]">
          Tapez lorsque le curseur traverse la zone centrale.
        </p>
        <div className="relative mt-12 h-12 rounded-full bg-[#DDE9E3] p-1 shadow-inner">
          <span className="absolute inset-y-1 left-1/2 w-[18%] -translate-x-1/2 rounded-full bg-[#F2C94C]/70" />
          <span
            className="absolute top-1/2 h-16 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#176951] shadow-lg"
            style={{ left: `${cursorPosition * 100}%` }}
          />
        </div>
        <button
          type="button"
          onPointerDown={onRhythmTap}
          className="mt-14 min-h-20 w-full touch-manipulation rounded-2xl bg-[#176951] text-xl font-black uppercase tracking-[0.12em] text-white shadow-lg active:scale-[0.98]"
        >
          Cadence !
        </button>
        <p className="mt-4 text-xs font-black text-[#60756E]">
          {liveCount} appui{liveCount > 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  if (gameType === "reflex") {
    return (
      <div className="min-h-72 text-center">
        <p className="text-sm font-bold text-[#48665F]">
          Touchez chaque cible avant sa disparition.
        </p>
        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
          {Array.from({ length: 9 }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={
                reflexTarget === index ? "Cible active" : "Emplacement vide"
              }
              onPointerDown={() => onReflexHit(index)}
              className={`aspect-square touch-manipulation rounded-2xl border transition ${
                reflexTarget === index
                  ? "scale-105 border-[#F2C94C] bg-[#F2C94C] shadow-[0_0_25px_rgba(242,201,76,0.6)]"
                  : "border-[#315B3E]/10 bg-[#EAF5F0]"
              }`}
            >
              {reflexTarget === index ? (
                <span className="text-3xl" aria-hidden="true">
                  ●
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-black text-[#60756E]">
          {liveCount} cible{liveCount > 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-72 text-center">
      <p className="text-sm font-bold text-[#48665F]">
        Alternez gauche et droite le plus vite possible.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {(["left", "right"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onPointerDown={() => onSpeedTap(side)}
            className={`min-h-44 touch-manipulation rounded-[2rem] border-4 text-4xl font-black transition active:scale-95 ${
              speedExpected === side
                ? "border-[#F2C94C] bg-[#176951] text-white shadow-xl"
                : "border-[#315B3E]/10 bg-[#EAF5F0] text-[#789087]"
            }`}
          >
            {side === "left" ? "G" : "D"}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs font-black text-[#60756E]">
        {liveCount} appui{liveCount > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function TrainingResult({ report }: { report: CompletedReport }) {
  const changes = Object.entries(report.ratingChanges)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="mt-4 rounded-xl border border-[#176951]/15 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#278B70]">
          Séance enregistrée
        </p>
        <strong className="text-lg text-[#176951]">
          {report.score}/1000
        </strong>
      </div>
      <p className="mt-2 text-xs font-bold text-[#315B3E]">
        {changes.length
          ? changes
              .map(
                ([key, value]) =>
                  `${
                    RIDER_RATING_AXES.find((axis) => axis.key === key)
                      ?.shortLabel ?? key
                  } +${value.toFixed(3)}`,
              )
              .join(" · ")
          : "Consolidation, sans hausse visible"}
      </p>
    </div>
  );
}
