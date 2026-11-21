import { z } from "zod";

import {
  GALA_S5_COURSES,
  SEASON_FIVE_GALA,
  type SeasonFiveGalaProgram,
} from "./season-five-gala";

export type GalaS5Rider = {
  rider_id: string;
  first_name: string;
  last_name: string;
  age?: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration?: number;
  downhill?: number;
  endurance?: number;
  resistance?: number;
  recovery?: number;
  breakaway?: number;
  prologue?: number;
  continentalAdmitted?: boolean;
};

export type SeasonFiveGalaContext = {
  isOpen: boolean;
  closesAt: string;
  team: { id: string; name: string; futureName?: string | null; identityReady?: boolean } | null;
  program: SeasonFiveGalaProgram | null;
  selections: Partial<Record<string, string[]>>;
  riders: GalaS5Rider[];
  courseCounts?: Partial<Record<string, number>>;
  unavailable?: boolean;
};

export type GalaS5RegistrationState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialGalaS5RegistrationState: GalaS5RegistrationState = {
  status: "idle",
  message: "",
};

const programSchema = z.enum(["pro-tour", "continental"]);
const lineupSchema = z.array(z.uuid()).max(SEASON_FIVE_GALA.maxRiders).refine(
  (ids) => ids.length === 0 || ids.length >= SEASON_FIVE_GALA.minRiders,
  "Sélectionnez 7 à 8 coureurs pour chaque course retenue.",
).refine(
  (ids) => new Set(ids).size === ids.length,
  "Un coureur ne peut être sélectionné deux fois dans une course.",
);

export const seasonFiveGalaRegistrationSchema = z.object({
  program: programSchema,
  selections: z.record(z.string(), lineupSchema),
  previousProgram: programSchema.nullable().default(null),
}).strict().superRefine((input, context) => {
  const expected = GALA_S5_COURSES.filter((course) => course.program === input.program);
  if (Object.keys(input.selections).length !== expected.length ||
    expected.some((course) => !(course.id in input.selections))) {
    context.addIssue({ code: "custom", message: "Les trois courses doivent appartenir au même programme." });
  }
  if (!Object.values(input.selections).some((ids) => ids.length > 0)) {
    context.addIssue({ code: "custom", message: "Sélectionnez au moins une course du gala." });
  }
});

export function buildSeasonFiveGalaSelections(
  program: SeasonFiveGalaProgram,
  selections: Partial<Record<string, string[]>> = {},
): Record<string, string[]> {
  return Object.fromEntries(GALA_S5_COURSES
    .filter((course) => course.program === program)
    .map((course) => [course.id, [...(selections[course.id] ?? [])]]));
}

export function isSeasonFiveGalaContinentalRiderEligible(rider: GalaS5Rider): boolean {
  if (rider.continentalAdmitted === true) return true;
  return [rider.mountain, rider.hills, rider.flat, rider.time_trial, rider.cobbles, rider.sprint]
    .every((value) => Number.isFinite(value) && value >= 1 && value <= SEASON_FIVE_GALA.continentalCap);
}

const nativeRatingSchema = z.number().finite().nonnegative();
const contextRiderSchema = z.object({
  rider_id: z.uuid(),
  first_name: z.string(),
  last_name: z.string(),
  age: z.number().int().positive().optional(),
  mountain: nativeRatingSchema,
  hills: nativeRatingSchema,
  flat: nativeRatingSchema,
  time_trial: nativeRatingSchema,
  cobbles: nativeRatingSchema,
  sprint: nativeRatingSchema,
  acceleration: nativeRatingSchema.optional(),
  downhill: nativeRatingSchema.optional(),
  endurance: nativeRatingSchema.optional(),
  resistance: nativeRatingSchema.optional(),
  recovery: nativeRatingSchema.optional(),
  breakaway: nativeRatingSchema.optional(),
  prologue: nativeRatingSchema.optional(),
  frozen_admission: z.boolean().optional(),
});
const courseIdSchema = z.string().refine((id) => GALA_S5_COURSES.some((course) => course.id === id));
const galaContextSchema = z.object({
  isOpen: z.boolean(),
  closesAt: z.iso.datetime({ offset: true }),
  team: z.object({
    id: z.uuid(),
    name: z.string().min(1),
    futureName: z.string().nullable().optional(),
    identityReady: z.boolean().optional(),
  }).nullable(),
  program: programSchema.nullable(),
  selections: z.record(courseIdSchema, lineupSchema),
  riders: z.array(contextRiderSchema),
  courseCounts: z.record(courseIdSchema, z.number().int().nonnegative()).optional(),
}).superRefine((input, context) => {
  const validIds = new Set(GALA_S5_COURSES.filter((course) => course.program === input.program).map((course) => course.id));
  if (Object.keys(input.selections).some((id) => !validIds.has(id))) {
    context.addIssue({ code: "custom", message: "Programme enregistré incohérent." });
  }
  if (new Set(input.riders.map((rider) => rider.rider_id)).size !== input.riders.length) {
    context.addIssue({ code: "custom", message: "Effectif du gala incohérent." });
  }
});

export function parseSeasonFiveGalaContext(value: unknown): SeasonFiveGalaContext | null {
  const parsed = galaContextSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    selections: parsed.data.program
      ? buildSeasonFiveGalaSelections(parsed.data.program, parsed.data.selections)
      : {},
    riders: parsed.data.riders.map(({ frozen_admission, ...rider }) => ({
      ...rider,
      continentalAdmitted: frozen_admission === true,
    })),
  };
}
