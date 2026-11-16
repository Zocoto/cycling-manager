import { isSquadStatus, type SquadStatus } from "./squad-status";
import type { SavedSquadStatus, SquadStatusesSaveState, SquadStatusUpdate } from "./squad-status-editor";

type StatusChoice = {
  squadStatus: SquadStatus | null;
  protectedLeaderId: string | null;
};
type StatusMap = Record<string, StatusChoice>;
export type SquadStatusDraftState = {
  serverRevision: string;
  confirmedByRiderId: StatusMap;
  baselineByRiderId: StatusMap;
  valuesByRiderId: StatusMap;
};

export function squadStatusRevision(statuses: readonly SavedSquadStatus[]) {
  return JSON.stringify(
    [...statuses]
      .sort((a, b) => a.riderId.localeCompare(b.riderId))
      .map(row => [row.riderId, row.squadStatus, row.protectedLeaderId ?? null]),
  );
}

export function createSquadStatusDrafts(statuses: readonly SavedSquadStatus[], serverRevision = squadStatusRevision(statuses)): SquadStatusDraftState {
  const confirmedByRiderId = Object.fromEntries(statuses.map(row => [row.riderId, getStatusChoice(row)]));
  return {serverRevision,confirmedByRiderId,baselineByRiderId:{...confirmedByRiderId},valuesByRiderId:{...confirmedByRiderId}};
}

export function updateSquadStatusDraft(
  state: SquadStatusDraftState,
  riderId: string,
  squadStatus: SquadStatus | null,
  protectedLeaderId?: string | null,
): SquadStatusDraftState {
  if (!Object.hasOwn(state.valuesByRiderId, riderId) || (squadStatus !== null && !isSquadStatus(squadStatus))) return state;
  const current = state.valuesByRiderId[riderId];
  const next = getStatusChoice({
    squadStatus,
    protectedLeaderId: protectedLeaderId === undefined ? current.protectedLeaderId : protectedLeaderId,
  });
  if (sameStatusChoice(current, next)) return state;
  return {...state,valuesByRiderId:{...state.valuesByRiderId,[riderId]:next}};
}

export function getSquadStatusUpdates(state: SquadStatusDraftState): SquadStatusUpdate[] {
  return Object.keys(state.baselineByRiderId).sort().flatMap(riderId => {
    const current = state.valuesByRiderId[riderId];
    const expected = state.baselineByRiderId[riderId];
    if (sameStatusChoice(current, expected)) return [];
    const update: SquadStatusUpdate = {
      riderId,
      squadStatus: current.squadStatus,
      expectedStatus: expected.squadStatus,
    };
    if (current.squadStatus === "close_guard" || expected.squadStatus === "close_guard") {
      update.protectedLeaderId = current.protectedLeaderId;
      update.expectedProtectedLeaderId = expected.protectedLeaderId;
    }
    return [update];
  });
}

/** Sorting/revalidation may replace server children without discarding pending choices. */
export function rebaseSquadStatusDrafts(state: SquadStatusDraftState, statuses: readonly SavedSquadStatus[], serverRevision = squadStatusRevision(statuses)): SquadStatusDraftState {
  const next=createSquadStatusDrafts(statuses,serverRevision);
  for (const row of statuses) {
    if (!Object.hasOwn(state.baselineByRiderId,row.riderId) || sameStatusChoice(state.valuesByRiderId[row.riderId], state.baselineByRiderId[row.riderId])) continue;
    next.valuesByRiderId[row.riderId]=state.valuesByRiderId[row.riderId];
    // Keep the original expectation so a refreshed concurrent edit still conflicts.
    next.baselineByRiderId[row.riderId]=state.baselineByRiderId[row.riderId];
  }
  return next;
}

export function acknowledgeSquadStatusSave(state: SquadStatusDraftState, result: SquadStatusesSaveState, submittedConfirmedByRiderId?: Readonly<StatusMap>): SquadStatusDraftState {
  if (result.status !== "success") return state;
  const next={...state,confirmedByRiderId:{...state.confirmedByRiderId},baselineByRiderId:{...state.baselineByRiderId}};
  for (const saved of result.savedStatuses) {
    if (!Object.hasOwn(state.valuesByRiderId,saved.riderId)) continue;
    const latest=state.confirmedByRiderId[saved.riderId];
    const savedChoice = getStatusChoice(saved);
    if (submittedConfirmedByRiderId && !sameStatusChoice(latest, submittedConfirmedByRiderId[saved.riderId]) && !sameStatusChoice(latest, savedChoice)) {
      // An independent refresh completed during this request. Keep that newer
      // server observation and require an explicit retry for the remaining draft.
      next.baselineByRiderId[saved.riderId]=latest;
      continue;
    }
    next.confirmedByRiderId[saved.riderId]=savedChoice;
    next.baselineByRiderId[saved.riderId]=savedChoice;
  }
  return next;
}

export function discardSquadStatusDrafts(state: SquadStatusDraftState): SquadStatusDraftState {
  return {...state,baselineByRiderId:{...state.confirmedByRiderId},valuesByRiderId:{...state.confirmedByRiderId}};
}

function getStatusChoice(row: Pick<SavedSquadStatus, "squadStatus" | "protectedLeaderId">): StatusChoice {
  return {
    squadStatus: row.squadStatus,
    protectedLeaderId: row.squadStatus === "close_guard" ? row.protectedLeaderId ?? null : null,
  };
}

function sameStatusChoice(left: StatusChoice, right: StatusChoice | undefined) {
  return left.squadStatus === right?.squadStatus && left.protectedLeaderId === right?.protectedLeaderId;
}
