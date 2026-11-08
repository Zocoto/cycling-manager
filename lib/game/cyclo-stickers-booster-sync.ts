"use client";

import { useEffect } from "react";

export const CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT = "cyclo-stratege:cyclo-stickers-boosters-changed";
export const CYCLO_STICKERS_SHOW_BOOSTERS_EVENT = "cyclo-stratege:cyclo-stickers-show-boosters";

export type CycloStickersBoostersChangedDetail = {
  hasUnopenedBoosters?: boolean;
};

export function notifyCycloStickersBoostersChanged(hasUnopenedBoosters?: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CycloStickersBoostersChangedDetail>(
    CYCLO_STICKERS_BOOSTERS_CHANGED_EVENT,
    { detail: { hasUnopenedBoosters } },
  ));
}

export function RefreshCycloStickersBoosterBadge() {
  useEffect(() => notifyCycloStickersBoostersChanged(), []);
  return null;
}
