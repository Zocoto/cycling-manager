import { z } from "zod";
import { GALA_PROGRAM_PROFILES, type GalaProgram, type GalaProfile } from "./season-four-gala";
import type { GalaNativeRatings } from "./season-four-gala-startlists";

export type GalaRegistrationRider = GalaNativeRatings & { rider_id: string; first_name: string; last_name: string };
export type SeasonFourGalaContext = {
  isOpen: boolean;
  team: { id: string; name: string } | null;
  program: GalaProgram | null;
  selections: Partial<Record<GalaProfile, string[]>>;
  riders: GalaRegistrationRider[];
  counts: Record<GalaProgram, number>;
  unavailable?: boolean;
};
export type GalaRegistrationState = { status: "idle" | "success" | "error"; message: string };
export const initialGalaRegistrationState: GalaRegistrationState = { status: "idle", message: "" };
export const galaRegistrationSchema = z.object({
  program: z.enum(["world-tour", "continental"]),
  selections: z.record(z.string(), z.array(z.uuid()).min(7).max(8)),
}).strict().superRefine((input, ctx) => {
  const profiles = GALA_PROGRAM_PROFILES[input.program];
  if (Object.keys(input.selections).length !== 3 || profiles.some(profile => !input.selections[profile])) {
    ctx.addIssue({ code: "custom", message: "Trois compositions du même programme sont requises." });
  }
  for (const ids of Object.values(input.selections)) if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Un coureur ne peut être sélectionné deux fois dans une course." });
});

export type GalaPublicEntries = { teams: { teamId: string; name: string; jerseyImagePath: string | null; riders: { id: string; name: string }[] }[]; total: number; hasMore: boolean; favorites?: { name: string; team: string }[] };
