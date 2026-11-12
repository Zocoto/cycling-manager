export const RACE_STAGE_RECOVERY_INTERVAL_MS = 60_000;

export type RaceStageRefreshReason = "phase" | "results" | "simulation" | "recovery" | "unavailable";

export function watchRaceStageAvailability({
  stageId,
  checkResults,
  checkSimulation,
  refreshOnPhaseChange,
  intervalMs,
  refresh,
}: {
  stageId: string;
  checkResults: boolean;
  checkSimulation: boolean;
  refreshOnPhaseChange: boolean;
  intervalMs: number;
  refresh: (reason: RaceStageRefreshReason) => void;
}) {
  let controller: AbortController | null = null;
  let failures = 0;
  const recoveryAt = Date.now() + RACE_STAGE_RECOVERY_INTERVAL_MS;

  async function check() {
    if (document.visibilityState !== "visible" || controller) return;
    if (refreshOnPhaseChange) {
      refresh("phase");
      return;
    }

    const request = new AbortController();
    controller = request;
    try {
      const response = await fetch(`/api/races/stages/${encodeURIComponent(stageId)}/availability`, {
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(4_500)]),
      });
      if (request.signal.aborted) return;
      if ([401, 403, 404].includes(response.status)) {
        refresh("unavailable");
        return;
      }
      if (!response.ok) throw new Error();
      const availability = await response.json();
      if (request.signal.aborted) return;
      if (typeof availability?.resultsAvailable !== "boolean" ||
          typeof availability?.simulationAvailable !== "boolean" ||
          typeof availability?.cancelled !== "boolean") throw new Error();

      failures = 0;
      if (availability.cancelled) refresh("unavailable");
      else if (checkResults && availability.resultsAvailable) refresh("results");
      else if (checkSimulation && availability.simulationAvailable) refresh("simulation");
      else if (Date.now() >= recoveryAt) refresh("recovery");
    } catch {
      if (!request.signal.aborted && ++failures >= 2) refresh("recovery");
    } finally {
      if (controller === request) controller = null;
    }
  }

  function cancelRequest() {
    controller?.abort();
    controller = null;
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") void check();
    else cancelRequest();
  }

  const timer = setInterval(check, intervalMs);
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (refreshOnPhaseChange) void check();

  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    cancelRequest();
  };
}
