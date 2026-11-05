import type { SquadStatus } from "./squad-status";

export type SquadStatusUpdate = {
  riderId: string;
  squadStatus: SquadStatus | null;
  expectedStatus: SquadStatus | null;
};
export type SavedSquadStatus = Pick<SquadStatusUpdate, "riderId" | "squadStatus">;
export type SquadStatusesSaveState = {
  status: "idle" | "success" | "error";
  message: string;
  savedStatuses: SavedSquadStatus[];
};
export const INITIAL_SQUAD_STATUSES_SAVE_STATE: SquadStatusesSaveState = {
  status: "idle", message: "", savedStatuses: [],
};
