"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  completeYouthManualTrainingAction,
  startYouthManualTrainingAction,
} from "@/app/jeu/centre-de-formation/actions";
import { RIDER_RATING_AXES } from "@/lib/game/rider-profile";
import {
  YOUTH_REFLEX_TARGET_INTERVAL_MS,
  YOUTH_TRAINING_DURATION_SECONDS,
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

type BreakawayWindowPhase = "wait" | "go" | "spent";

const DEMO_DURATION_SECONDS = 12;
const BREAKAWAY_CYCLE_MILLISECONDS = 3_800;
const PUNCHEUR_CLIMB_MILLISECONDS = 5_000;

export function YouthTrainingMiniGame({
  academyRiderId,
  riderName,
  trainingMode,
  gameType,
  currentSlotLabel,
  currentSlotCompleted,
  completedSlotCount,
  demoMode = false,
}: {
  academyRiderId: string;
  riderName: string;
  trainingMode: YouthTrainingMode;
  gameType: YouthTrainingGameType;
  currentSlotLabel: string;
  currentSlotCompleted: boolean;
  completedSlotCount: number;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [activeGameType, setActiveGameType] =
    useState<YouthTrainingGameType>(gameType);
  const [durationSeconds, setDurationSeconds] = useState(
    YOUTH_TRAINING_DURATION_SECONDS,
  );
  const [secondsLeft, setSecondsLeft] = useState(
    YOUTH_TRAINING_DURATION_SECONDS,
  );
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CompletedReport | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0.5);
  const [reflexTarget, setReflexTarget] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [speedExpected, setSpeedExpected] =
    useState<"left" | "right">("left");
  const [timeTrialPosition, setTimeTrialPosition] = useState(0.24);
  const [timeTrialOptimalPercent, setTimeTrialOptimalPercent] = useState(0);
  const [breakawayEnergy, setBreakawayEnergy] = useState(100);
  const [breakawayWindowPhase, setBreakawayWindowPhase] =
    useState<BreakawayWindowPhase>("wait");
  const [breakawayCycleProgress, setBreakawayCycleProgress] = useState(0);
  const [breakawayFeedback, setBreakawayFeedback] = useState("");
  const [puncheurProgress, setPuncheurProgress] = useState(0);
  const [puncheurCharge, setPuncheurCharge] = useState(0);
  const [puncheurFeedback, setPuncheurFeedback] = useState("");

  const gameStartedAtRef = useRef(0);
  const cursorPositionRef = useRef(0.5);
  const rhythmPointsRef = useRef(0);
  const rhythmTapsRef = useRef(0);
  const lastRhythmTapRef = useRef(0);
  const reflexHitsRef = useRef(0);
  const reflexOpportunitiesRef = useRef(0);
  const speedTapsRef = useRef(0);
  const speedExpectedRef = useRef<"left" | "right">("left");
  const timeTrialPositionRef = useRef(0.24);
  const timeTrialControlRef = useRef<-1 | 0 | 1>(0);
  const timeTrialOptimalMillisecondsRef = useRef(0);
  const timeTrialElapsedMillisecondsRef = useRef(0);
  const breakawaySuccessfulAttacksRef = useRef(0);
  const breakawayOpportunitiesRef = useRef(0);
  const breakawayEnergyRef = useRef(100);
  const breakawayCycleRef = useRef(-1);
  const breakawayActedCycleRef = useRef(-1);
  const puncheurPointsRef = useRef(0);
  const puncheurOpportunitiesRef = useRef(0);
  const puncheurCycleRef = useRef(-1);
  const puncheurReleasedCycleRef = useRef(-1);
  const puncheurProgressRef = useRef(0);
  const puncheurChargeRef = useRef(0);
  const puncheurChargingRef = useRef(false);
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
      timeTrialOptimalMilliseconds:
        timeTrialOptimalMillisecondsRef.current,
      timeTrialElapsedMilliseconds:
        timeTrialElapsedMillisecondsRef.current,
      breakawaySuccessfulAttacks:
        breakawaySuccessfulAttacksRef.current,
      breakawayOpportunities: breakawayOpportunitiesRef.current,
      breakawayEnergy: breakawayEnergyRef.current,
      puncheurPoints: puncheurPointsRef.current,
      puncheurOpportunities: puncheurOpportunitiesRef.current,
    });

    if (demoMode) {
      setReport({
        score,
        slot: "manual_am",
        trainingPriority: "tutorial",
        ratingChanges: {},
      });
      setPhase("completed");
      finishingRef.current = false;
      return;
    }

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
  }, [activeGameType, attemptId, demoMode, router]);
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
      const animateRhythm = (timestamp: number) => {
        const elapsed = timestamp - gameStartedAtRef.current;
        const rhythmPhase = elapsed / 350 + Math.sin(elapsed / 2_300) * 2;
        const position = (Math.sin(rhythmPhase) + 1) / 2;
        cursorPositionRef.current = position;
        setCursorPosition(position);
        animationFrame = window.requestAnimationFrame(animateRhythm);
      };
      animationFrame = window.requestAnimationFrame(animateRhythm);
    }

    if (activeGameType === "reflex") {
      const spawnTarget = () => {
        reflexOpportunitiesRef.current += 1;
        setReflexTarget(Math.floor(Math.random() * 9));
      };
      spawnTarget();
      reflexTimer = window.setInterval(
        spawnTarget,
        YOUTH_REFLEX_TARGET_INTERVAL_MS,
      );
    }

    if (activeGameType === "time_trial") {
      let previousTimestamp = gameStartedAtRef.current;
      const animateTimeTrial = (timestamp: number) => {
        const delta = Math.min(40, timestamp - previousTimestamp);
        const elapsed = timestamp - gameStartedAtRef.current;
        previousTimestamp = timestamp;
        const wind =
          Math.sin(elapsed / 710) * 0.000055 +
          Math.sin(elapsed / 1_930) * 0.000025 +
          0.000012;
        const nextPosition = clamp(
          timeTrialPositionRef.current +
            timeTrialControlRef.current * delta * 0.0002 +
            wind * delta,
          0.03,
          0.97,
        );
        timeTrialPositionRef.current = nextPosition;
        timeTrialElapsedMillisecondsRef.current += delta;
        if (nextPosition >= 0.38 && nextPosition <= 0.62) {
          timeTrialOptimalMillisecondsRef.current += delta;
        }
        const optimalPercent =
          timeTrialElapsedMillisecondsRef.current > 0
            ? Math.round(
                (timeTrialOptimalMillisecondsRef.current /
                  timeTrialElapsedMillisecondsRef.current) *
                  100,
              )
            : 0;
        setTimeTrialPosition(nextPosition);
        setTimeTrialOptimalPercent(optimalPercent);
        animationFrame = window.requestAnimationFrame(animateTimeTrial);
      };
      animationFrame = window.requestAnimationFrame(animateTimeTrial);
    }

    if (activeGameType === "breakaway") {
      const animateBreakaway = (timestamp: number) => {
        const elapsed = timestamp - gameStartedAtRef.current;
        const cycle = Math.floor(elapsed / BREAKAWAY_CYCLE_MILLISECONDS);
        const cycleProgress =
          (elapsed % BREAKAWAY_CYCLE_MILLISECONDS) /
          BREAKAWAY_CYCLE_MILLISECONDS;
        if (cycle !== breakawayCycleRef.current) {
          breakawayCycleRef.current = cycle;
          breakawayOpportunitiesRef.current = Math.max(
            breakawayOpportunitiesRef.current,
            cycle + 1,
          );
          setBreakawayFeedback("");
        }
        const favorable = cycleProgress >= 0.34 && cycleProgress <= 0.67;
        setBreakawayCycleProgress(cycleProgress);
        setBreakawayWindowPhase(
          breakawayActedCycleRef.current === cycle
            ? "spent"
            : favorable
              ? "go"
              : "wait",
        );
        animationFrame = window.requestAnimationFrame(animateBreakaway);
      };
      animationFrame = window.requestAnimationFrame(animateBreakaway);
    }

    if (activeGameType === "puncheur") {
      let previousTimestamp = gameStartedAtRef.current;
      const animatePuncheur = (timestamp: number) => {
        const delta = Math.min(40, timestamp - previousTimestamp);
        const elapsed = timestamp - gameStartedAtRef.current;
        previousTimestamp = timestamp;
        const cycle = Math.floor(elapsed / PUNCHEUR_CLIMB_MILLISECONDS);
        const climbProgress =
          (elapsed % PUNCHEUR_CLIMB_MILLISECONDS) /
          PUNCHEUR_CLIMB_MILLISECONDS;
        if (cycle !== puncheurCycleRef.current) {
          puncheurCycleRef.current = cycle;
          puncheurOpportunitiesRef.current = Math.max(
            puncheurOpportunitiesRef.current,
            cycle + 1,
          );
          puncheurChargeRef.current = 0;
          setPuncheurCharge(0);
          setPuncheurFeedback("");
        }
        if (
          puncheurChargingRef.current &&
          puncheurReleasedCycleRef.current !== cycle
        ) {
          puncheurChargeRef.current = clamp(
            puncheurChargeRef.current + delta / 1_650,
            0,
            1,
          );
          setPuncheurCharge(puncheurChargeRef.current);
        }
        puncheurProgressRef.current = climbProgress;
        setPuncheurProgress(climbProgress);
        animationFrame = window.requestAnimationFrame(animatePuncheur);
      };
      animationFrame = window.requestAnimationFrame(animatePuncheur);
    }

    return () => {
      window.clearTimeout(finishTimer);
      window.clearInterval(countdownTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      if (reflexTimer) window.clearInterval(reflexTimer);
      timeTrialControlRef.current = 0;
      puncheurChargingRef.current = false;
    };
  }, [activeGameType, durationSeconds, finishGame, phase]);

  async function startGame() {
    setPhase("starting");
    setError(null);
    setReport(null);
    resetCounters();

    if (demoMode) {
      setAttemptId("tutorial-demo");
      setActiveGameType(gameType);
      setDurationSeconds(DEMO_DURATION_SECONDS);
      setSecondsLeft(DEMO_DURATION_SECONDS);
      setPhase("playing");
      return;
    }

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
    timeTrialPositionRef.current = 0.24;
    timeTrialControlRef.current = 0;
    timeTrialOptimalMillisecondsRef.current = 0;
    timeTrialElapsedMillisecondsRef.current = 0;
    breakawaySuccessfulAttacksRef.current = 0;
    breakawayOpportunitiesRef.current = 0;
    breakawayEnergyRef.current = 100;
    breakawayCycleRef.current = -1;
    breakawayActedCycleRef.current = -1;
    puncheurPointsRef.current = 0;
    puncheurOpportunitiesRef.current = 0;
    puncheurCycleRef.current = -1;
    puncheurReleasedCycleRef.current = -1;
    puncheurProgressRef.current = 0;
    puncheurChargeRef.current = 0;
    puncheurChargingRef.current = false;
    finishingRef.current = false;
    setCursorPosition(0.5);
    setSpeedExpected("left");
    setLiveCount(0);
    setReflexTarget(null);
    setTimeTrialPosition(0.24);
    setTimeTrialOptimalPercent(0);
    setBreakawayEnergy(100);
    setBreakawayWindowPhase("wait");
    setBreakawayCycleProgress(0);
    setBreakawayFeedback("");
    setPuncheurProgress(0);
    setPuncheurCharge(0);
    setPuncheurFeedback("");
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
  function startTimeTrialControl(
    direction: -1 | 1,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    timeTrialControlRef.current = direction;
  }

  function stopTimeTrialControl(direction: -1 | 1) {
    if (timeTrialControlRef.current === direction) {
      timeTrialControlRef.current = 0;
    }
  }

  function registerBreakawayAttack() {
    const elapsed = performance.now() - gameStartedAtRef.current;
    const cycle = Math.floor(elapsed / BREAKAWAY_CYCLE_MILLISECONDS);
    if (breakawayActedCycleRef.current === cycle) return;
    breakawayActedCycleRef.current = cycle;
    const cycleProgress =
      (elapsed % BREAKAWAY_CYCLE_MILLISECONDS) /
      BREAKAWAY_CYCLE_MILLISECONDS;
    const favorable = cycleProgress >= 0.34 && cycleProgress <= 0.67;
    const energyCost = favorable ? 8 : 14;
    const nextEnergy = Math.max(0, breakawayEnergyRef.current - energyCost);
    breakawayEnergyRef.current = nextEnergy;
    setBreakawayEnergy(nextEnergy);

    if (favorable) {
      breakawaySuccessfulAttacksRef.current += 1;
      setLiveCount(breakawaySuccessfulAttacksRef.current);
      setBreakawayFeedback("Écart creusé !");
    } else {
      setBreakawayFeedback(
        cycleProgress < 0.34 ? "Parti trop tôt" : "Fenêtre manquée",
      );
    }
    setBreakawayWindowPhase("spent");
  }

  function startPuncheurCharge(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    if (puncheurReleasedCycleRef.current === puncheurCycleRef.current) return;
    puncheurChargingRef.current = true;
  }

  function releasePuncheurCharge() {
    puncheurChargingRef.current = false;
    const cycle = puncheurCycleRef.current;
    if (cycle < 0 || puncheurReleasedCycleRef.current === cycle) return;
    puncheurReleasedCycleRef.current = cycle;
    const timingScore = clamp(
      1 - Math.abs(puncheurProgressRef.current - 0.84) / 0.22,
      0,
      1,
    );
    const chargeScore = clamp(
      1 - Math.abs(puncheurChargeRef.current - 0.82) / 0.45,
      0,
      1,
    );
    const points = Math.round((timingScore * 0.7 + chargeScore * 0.3) * 1_000);
    puncheurPointsRef.current += points;
    setLiveCount(
      Math.round(
        puncheurPointsRef.current /
          Math.max(1, puncheurOpportunitiesRef.current),
      ),
    );
    setPuncheurFeedback(
      points >= 900
        ? "Sommet parfait !"
        : points >= 650
          ? "Bonne accélération"
          : puncheurProgressRef.current < 0.7
            ? "Effort déclenché trop tôt"
            : "Le sommet est déjà passé",
    );
  }

  if (trainingMode === "automatic") {
    return (
      <div className="rounded-2xl border border-[#176951]/15 bg-[#EAF5F3] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#278B70]">
              Mode actif · entraînement automatique
            </p>
            <p className="mt-1 text-xs font-bold text-[#315B3E]">
              Une séance est réalisée chaque jour à 8 h avec l’efficacité junior ×2.
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
          Créneau manuel déjà effectué · {currentSlotLabel}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[#315B3E]">
          {completedSlotCount}/2 créneaux réalisés aujourd’hui. Le résultat
          complet du dernier entraînement est affiché ci-dessous.
        </p>
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
              {YOUTH_TRAINING_GAME_LABELS[gameType]} ·{" "}
              {demoMode
                ? `aperçu ${DEMO_DURATION_SECONDS} s`
                : `${YOUTH_TRAINING_DURATION_SECONDS} secondes`}
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
        {report ? <TrainingResult report={report} demoMode={demoMode} /> : null}
      </div>

      {phase === "playing" || phase === "submitting" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Entraînement de ${riderName}`}
          className={`fixed inset-0 grid place-items-center bg-[#071A17]/90 p-3 backdrop-blur-sm sm:p-6 ${
            demoMode ? "z-[240]" : "z-[100]"
          }`}
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
                  timeTrialPosition={timeTrialPosition}
                  timeTrialOptimalPercent={timeTrialOptimalPercent}
                  breakawayEnergy={breakawayEnergy}
                  breakawayWindowPhase={breakawayWindowPhase}
                  breakawayCycleProgress={breakawayCycleProgress}
                  breakawayFeedback={breakawayFeedback}
                  puncheurProgress={puncheurProgress}
                  puncheurCharge={puncheurCharge}
                  puncheurFeedback={puncheurFeedback}
                  onRhythmTap={registerRhythmTap}
                  onReflexHit={registerReflexHit}
                  onSpeedTap={registerSpeedTap}
                  onTimeTrialControlStart={startTimeTrialControl}
                  onTimeTrialControlEnd={stopTimeTrialControl}
                  onBreakawayAttack={registerBreakawayAttack}
                  onPuncheurChargeStart={startPuncheurCharge}
                  onPuncheurChargeEnd={releasePuncheurCharge}
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
  timeTrialPosition,
  timeTrialOptimalPercent,
  breakawayEnergy,
  breakawayWindowPhase,
  breakawayCycleProgress,
  breakawayFeedback,
  puncheurProgress,
  puncheurCharge,
  puncheurFeedback,
  onRhythmTap,
  onReflexHit,
  onSpeedTap,
  onTimeTrialControlStart,
  onTimeTrialControlEnd,
  onBreakawayAttack,
  onPuncheurChargeStart,
  onPuncheurChargeEnd,
}: {
  gameType: YouthTrainingGameType;
  cursorPosition: number;
  reflexTarget: number | null;
  liveCount: number;
  speedExpected: "left" | "right";
  timeTrialPosition: number;
  timeTrialOptimalPercent: number;
  breakawayEnergy: number;
  breakawayWindowPhase: BreakawayWindowPhase;
  breakawayCycleProgress: number;
  breakawayFeedback: string;
  puncheurProgress: number;
  puncheurCharge: number;
  puncheurFeedback: string;
  onRhythmTap: () => void;
  onReflexHit: (index: number) => void;
  onSpeedTap: (side: "left" | "right") => void;
  onTimeTrialControlStart: (
    direction: -1 | 1,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onTimeTrialControlEnd: (direction: -1 | 1) => void;
  onBreakawayAttack: () => void;
  onPuncheurChargeStart: (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onPuncheurChargeEnd: () => void;
}) {
  if (gameType === "rhythm") {
    return (
      <div className="min-h-72 text-center" data-youth-game="rhythm">
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
      <div className="min-h-72 text-center" data-youth-game="reflex">
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

  if (gameType === "speed") {
    return (
      <div className="min-h-72 text-center" data-youth-game="speed">
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

  if (gameType === "time_trial") {
    return (
      <div className="min-h-72 text-center" data-youth-game="time_trial">
        <p className="text-sm font-bold text-[#48665F]">
          Compensez le vent et maintenez le coureur dans la zone aéro.
        </p>
        <div className="mt-7 rounded-[1.75rem] bg-[#0B302B] p-5 text-white shadow-inner sm:p-7">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0CA]">
            <span>Relâché</span>
            <span>Zone optimale</span>
            <span>Sur-régime</span>
          </div>
          <div className="relative mt-5 h-20 overflow-visible rounded-full border border-white/15 bg-[#071F1B]">
            <span className="absolute inset-y-2 left-[38%] w-[24%] rounded-full bg-[#72D4B7]/35 ring-2 ring-[#72D4B7]/60" />
            <span
              className="absolute top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-[#F2C94C] bg-[#F8FBF9] text-[9px] font-black text-[#0B302B] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              style={{ left: `${timeTrialPosition * 100}%` }}
            >
              AÉRO
            </span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {([
            { direction: -1 as const, label: "Relâcher" },
            { direction: 1 as const, label: "Accélérer" },
          ]).map(({ direction, label }) => (
            <button
              key={direction}
              type="button"
              onPointerDown={(event) =>
                onTimeTrialControlStart(direction, event)
              }
              onPointerUp={() => onTimeTrialControlEnd(direction)}
              onPointerCancel={() => onTimeTrialControlEnd(direction)}
              className="min-h-16 touch-none rounded-2xl border-2 border-[#176951]/20 bg-[#EAF5F0] text-sm font-black uppercase tracking-[0.1em] text-[#176951] transition active:scale-[0.98] active:bg-[#176951] active:text-white"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-black text-[#60756E]">
          {timeTrialOptimalPercent}% du temps dans la zone
        </p>
      </div>
    );
  }
  if (gameType === "breakaway") {
    const windowCopy =
      breakawayWindowPhase === "go"
        ? "ATTAQUEZ !"
        : breakawayWindowPhase === "spent"
          ? breakawayFeedback || "Relance jouée"
          : "Restez dans les roues";
    return (
      <div className="min-h-72 text-center" data-youth-game="breakaway">
        <p className="text-sm font-bold text-[#48665F]">
          Préservez votre énergie et attaquez lorsque le peloton hésite.
        </p>
        <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-[#0B302B] p-5 text-white sm:p-6">
          <div className="flex items-center justify-between gap-3 text-left">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#9BE0CA]">
                Énergie
              </p>
              <strong className="text-2xl tabular-nums">{breakawayEnergy}%</strong>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
                breakawayWindowPhase === "go"
                  ? "animate-pulse bg-[#F2C94C] text-[#071A17]"
                  : breakawayWindowPhase === "spent"
                    ? "bg-white/10 text-white"
                    : "bg-[#143F38] text-[#9BE0CA]"
              }`}
            >
              {windowCopy}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-[#72D4B7] transition-[width]"
              style={{ width: `${breakawayEnergy}%` }}
            />
          </div>
          <div className="relative mt-8 h-16 rounded-full border border-white/10 bg-[#071F1B]">
            <span className="absolute inset-y-2 left-[34%] w-[33%] rounded-full bg-[#F2C94C]/20 ring-1 ring-[#F2C94C]/50" />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-[9px] font-black uppercase text-[#B8CEC7]">
              Peloton
            </span>
            <span
              className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#F2C94C] bg-[#176951] text-[9px] font-black shadow-lg"
              style={{ left: `${8 + breakawayCycleProgress * 84}%` }}
            >
              VOUS
            </span>
          </div>
        </div>
        <button
          type="button"
          onPointerDown={onBreakawayAttack}
          disabled={breakawayWindowPhase === "spent" || breakawayEnergy <= 0}
          className={`mt-5 min-h-18 w-full touch-manipulation rounded-2xl text-base font-black uppercase tracking-[0.12em] shadow-lg transition active:scale-[0.98] disabled:opacity-45 ${
            breakawayWindowPhase === "go"
              ? "bg-[#F2C94C] text-[#071A17]"
              : "bg-[#176951] text-white"
          }`}
        >
          Placer l’attaque
        </button>
        <p className="mt-4 text-xs font-black text-[#60756E]">
          {liveCount} attaque{liveCount > 1 ? "s" : ""} réussie
          {liveCount > 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-72 text-center" data-youth-game="puncheur">
      <p className="text-sm font-bold text-[#48665F]">
        Chargez votre effort puis relâchez au passage du sommet.
      </p>
      <div className="relative mt-6 h-44 overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-[#DDF2EB] to-[#8DCAB8]">
        <svg
          viewBox="0 0 600 180"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M0 164 C120 160 190 145 270 118 C365 86 430 42 505 20 C545 10 575 15 600 22 L600 180 L0 180 Z"
            fill="#176951"
          />
          <path
            d="M0 154 C120 150 190 135 270 108 C365 76 430 32 505 10 C545 0 575 5 600 12"
            fill="none"
            stroke="#F8FBF9"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M438 36 C468 22 490 15 520 9"
            fill="none"
            stroke="#F2C94C"
            strokeWidth="12"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
        <span className="absolute right-[8%] top-4 rounded-full bg-[#F2C94C] px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#071A17]">
          Zone sommet
        </span>
        <span
          className="absolute grid h-12 w-12 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#0B302B] text-[8px] font-black text-white shadow-xl"
          style={{
            left: `${7 + puncheurProgress * 84}%`,
            bottom: `${12 + puncheurProgress * 68}%`,
          }}
        >
          VOUS
        </span>
      </div>
      <div className="mt-5 text-left">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
          <span>Charge d’effort</span>
          <span>{Math.round(puncheurCharge * 100)}%</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#DDE9E3]">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#72D4B7] via-[#F2C94C] to-[#E96A4B] transition-[width]"
            style={{ width: `${puncheurCharge * 100}%` }}
          />
        </div>
      </div>
      <button
        type="button"
        onPointerDown={onPuncheurChargeStart}
        onPointerUp={onPuncheurChargeEnd}
        onPointerCancel={onPuncheurChargeEnd}
        className="mt-5 min-h-18 w-full touch-none rounded-2xl bg-[#176951] text-base font-black uppercase tracking-[0.12em] text-white shadow-lg transition active:scale-[0.98] active:bg-[#0B302B]"
      >
        Maintenir · puis relâcher
      </button>
      <p className="mt-4 min-h-5 text-xs font-black text-[#60756E]">
        {puncheurFeedback || "Préparez votre accélération"}
      </p>
    </div>
  );
}

function TrainingResult({
  report,
  demoMode,
}: {
  report: CompletedReport;
  demoMode: boolean;
}) {
  if (!demoMode) {
    return (
      <div
        role="status"
        className="mt-4 rounded-xl border border-[#176951]/15 bg-white p-3"
      >
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#278B70]">
          Entraînement enregistré
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-[#315B3E]">
          Le résultat complet et les gains appliqués sont mis à jour dans le
          rapport ci-dessous.
        </p>
      </div>
    );
  }

  const changes = Object.entries(report.ratingChanges)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <div className="mt-4 rounded-xl border border-[#176951]/15 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#278B70]">
          Démonstration terminée
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
          : "Simulation terminée · aucune progression enregistrée"}
      </p>
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}