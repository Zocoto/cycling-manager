"use client";

import { useEffect, useRef } from "react";

import { settleDueOfficialRaceRewardsAction } from "@/app/jeu/actions";

const SETTLEMENT_RETRY_DELAY_MS = 60_000;
const IDLE_RECHECK_DELAY_MS = 15 * 60_000;
const FINISH_GRACE_PERIOD_MS = 3_000;

export function RaceSettlementWatcher() {
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    function scheduleNextCheck(nextSettlementAt: string | null) {
      if (cancelled) return;
      if (timer !== null) window.clearTimeout(timer);

      const nextTimestamp = nextSettlementAt
        ? new Date(nextSettlementAt).getTime()
        : Number.NaN;
      const delay = Number.isFinite(nextTimestamp)
        ? Math.max(
            FINISH_GRACE_PERIOD_MS,
            nextTimestamp - Date.now() + FINISH_GRACE_PERIOD_MS
          )
        : IDLE_RECHECK_DELAY_MS;
      timer = window.setTimeout(() => void settleDueRewards(), delay);
    }

    async function settleDueRewards() {
      if (
        inFlightRef.current ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        return;
      }

      inFlightRef.current = true;
      try {
        const settlement = await settleDueOfficialRaceRewardsAction();
        scheduleNextCheck(settlement.nextSettlementAt);
      } catch (error) {
        console.error("Impossible de clôturer les récompenses de course :", error);
        scheduleNextCheck(
          new Date(Date.now() + SETTLEMENT_RETRY_DELAY_MS).toISOString()
        );
      } finally {
        inFlightRef.current = false;
      }
    }

    void settleDueRewards();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void settleDueRewards();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
