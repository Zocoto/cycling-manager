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
  courseCounts?: Partial<Record<`${GalaProgram}:${GalaProfile}`, number>>;
  unavailable?: boolean;
};
export type GalaRegistrationState = { status: "idle" | "success" | "error"; message: string };
export const initialGalaRegistrationState: GalaRegistrationState = { status: "idle", message: "" };
const galaCourseBaseSchema = z.object({
  program: z.enum(["world-tour", "continental"]),
  profile: z.enum(["mountain", "hills", "cobbles", "sprint"]),
  riderIds: z.array(z.uuid()).min(7).max(8),
}).strict();
export const galaCourseRegistrationSchema = galaCourseBaseSchema.superRefine((input, ctx) => {
  if (!GALA_PROGRAM_PROFILES[input.program].includes(input.profile) || new Set(input.riderIds).size !== input.riderIds.length) {
    ctx.addIssue({ code: "custom", message: "Sélection de course invalide." });
  }
});
export const galaCourseWithdrawalSchema = galaCourseBaseSchema.extend({ riderIds: z.array(z.uuid()).max(8) }).superRefine((input, ctx) => {
  if (!GALA_PROGRAM_PROFILES[input.program].includes(input.profile)) ctx.addIssue({ code: "custom", message: "Sélection de course invalide." });
});
export const galaProgramChangeSchema = z.object({
  program: z.enum(["world-tour", "continental"]),
  previousProgram: z.enum(["world-tour", "continental"]),
}).strict();
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
