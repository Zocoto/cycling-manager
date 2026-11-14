"use client";

import { useEffect } from "react";

export const CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT = "cyclo-stratege:cyclo-stickers-boosters-changed";
export const CYCLO_STICKERS_SHOW_BOOSTERS_EVENT = "cyclo-stratege:cyclo-stickers-show-boosters";
export const CYCLO_STICKERS_TRADES_CHANGED_EVENT = "cyclo-stratege:cyclo-stickers-trades-changed";

export type CycloStickersBoostersChangedDetail = {
  hasUnopenedBoosters?: boolean;
};

export type CycloStickersTradesChangedDetail = {
  pendingIncomingCount?: number;
};

export function notifyCycloStickersBoostersChanged(hasUnopenedBoosters?: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CycloStickersBoostersChangedDetail>(
    CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT,
    { detail: { hasUnopenedBoosters } },
  ));
}

export function notifyCycloStickersTradesChanged(pendingIncomingCount?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CycloStickersTradesChangedDetail>(
    CYCLO_STICKERS_TRADES_CHANGED_EVENT,
    { detail: { pendingIncomingCount } },
  ));
}

export function RefreshCycloStickersBoosterBadge() {
  useEffect(() => notifyCycloStickersBoostersChanged(), []);
  return null;
}
