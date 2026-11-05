import { isSquadStatus, type SquadStatus } from "./squad-status";
import type { SavedSquadStatus, SquadStatusesSaveState, SquadStatusUpdate } from "./squad-status-editor";

type StatusMap = Record<string, SquadStatus | null>;
export type SquadStatusDraftState = {
  serverRevision: string;
  confirmedByRiderId: StatusMap;
  baselineByRiderId: StatusMap;
  valuesByRiderId: StatusMap;
};

export function squadStatusRevision(statuses: readonly SavedSquadStatus[]) {
  return JSON.stringify([...statuses].sort((a,b)=>a.riderId < b.riderId ? -1 : a.riderId > b.riderId ? 1 : 0));
}

export function createSquadStatusDrafts(statuses: readonly SavedSquadStatus[], serverRevision = squadStatusRevision(statuses)): SquadStatusDraftState {
  const confirmedByRiderId = Object.fromEntries(statuses.map(row=>[row.riderId,row.squadStatus]));
  return {serverRevision,confirmedByRiderId,baselineByRiderId:{...confirmedByRiderId},valuesByRiderId:{...confirmedByRiderId}};
}

export function updateSquadStatusDraft(state: SquadStatusDraftState, riderId: string, status: SquadStatus | null): SquadStatusDraftState {
  if (!Object.hasOwn(state.valuesByRiderId,riderId) || (status !== null && !isSquadStatus(status)) || state.valuesByRiderId[riderId] === status) return state;
  return {...state,valuesByRiderId:{...state.valuesByRiderId,[riderId]:status}};
}

export function getSquadStatusUpdates(state: SquadStatusDraftState): SquadStatusUpdate[] {
  return Object.keys(state.baselineByRiderId).sort().flatMap(riderId=>{
    const squadStatus=state.valuesByRiderId[riderId],expectedStatus=state.baselineByRiderId[riderId];
    return squadStatus === expectedStatus ? [] : [{riderId,squadStatus,expectedStatus}];
  });
}

/** Sorting/revalidation may replace server children without discarding pending choices. */
export function rebaseSquadStatusDrafts(state: SquadStatusDraftState, statuses: readonly SavedSquadStatus[], serverRevision = squadStatusRevision(statuses)): SquadStatusDraftState {
  const next=createSquadStatusDrafts(statuses,serverRevision);
  for (const row of statuses) {
    if (!Object.hasOwn(state.baselineByRiderId,row.riderId) || state.valuesByRiderId[row.riderId] === state.baselineByRiderId[row.riderId]) continue;
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
    if (submittedConfirmedByRiderId && latest !== submittedConfirmedByRiderId[saved.riderId] && latest !== saved.squadStatus) {
      // An independent refresh completed during this request. Keep that newer
      // server observation and require an explicit retry for the remaining draft.
      next.baselineByRiderId[saved.riderId]=latest;
      continue;
    }
    next.confirmedByRiderId[saved.riderId]=saved.squadStatus;
    next.baselineByRiderId[saved.riderId]=saved.squadStatus;
  }
  return next;
}

export function discardSquadStatusDrafts(state: SquadStatusDraftState): SquadStatusDraftState {
  return {...state,baselineByRiderId:{...state.confirmedByRiderId},valuesByRiderId:{...state.confirmedByRiderId}};
}
