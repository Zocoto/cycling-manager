import { z } from "zod";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import { GALA_S5_COURSES, type SeasonFiveGalaProgram } from "./season-five-gala";

export type SeasonFiveGalaPublicJersey =
  | { kind: "sponsor"; imagePath: string }
  | { kind: "amateur"; jersey: AmateurJerseyConfig };

export type SeasonFiveGalaPublicRider = {
  riderId: string;
  firstName: string;
  lastName: string;
  position: number;
};
export type SeasonFiveGalaPublicTeam = {
  teamId: string;
  name: string;
  futureName: string | null;
  identityReady: boolean;
  jersey: SeasonFiveGalaPublicJersey;
  riders: SeasonFiveGalaPublicRider[];
};
export type SeasonFiveGalaPublicStartlists = {
  editionId: string;
  sourceSeason: 5;
  targetGameYear: 6;
  closesAt: string;
  courses: {
    eventKey: string;
    program: SeasonFiveGalaProgram;
    teams: SeasonFiveGalaPublicTeam[];
  }[];
};

const nonemptyName = z.string().trim().min(1);
const riderSchema = z.object({
  riderId: z.uuid(), firstName: nonemptyName, lastName: nonemptyName,
  position: z.number().int().min(1).max(8),
});
const rawJerseySchema = z.object({
  pattern: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
});
const teamSchema = z.object({
  teamId: z.uuid(), name: nonemptyName, futureName: nonemptyName.nullable(),
  identityReady: z.boolean(), sponsorCatalogKey: z.string().nullable(),
  jerseyId: z.string().nullable(), jerseyStyle: z.string().nullable(),
  amateurJersey: rawJerseySchema.nullable().optional(),
  riders: z.array(riderSchema).min(7).max(8),
}).superRefine((team, context) => {
  if (new Set(team.riders.map(rider => rider.riderId)).size !== team.riders.length ||
    team.riders.some((rider, index) => rider.position !== index + 1)) {
    context.addIssue({ code: "custom", message: "Invalid S5 public startlist rider order or identity." });
  }
});

const rawStartlistsSchema = z.object({
  editionId: z.uuid(), sourceSeason: z.literal(5), targetGameYear: z.literal(6),
  closesAt: z.iso.datetime({ offset: true }),
  courses: z.array(z.object({
    eventKey: z.string(), program: z.enum(["pro-tour", "continental"]),
    teams: z.array(teamSchema),
  })).length(6),
}).superRefine((payload, context) => {
  const eventKeys = new Set<string>();
  const programsByTeam = new Map<string, SeasonFiveGalaProgram>();
  const ownersByRider = new Map<string, string>();
  for (const course of payload.courses) {
    const expected = GALA_S5_COURSES.find(candidate => candidate.id === course.eventKey);
    if (!expected || expected.program !== course.program || eventKeys.has(course.eventKey)) {
      context.addIssue({ code: "custom", message: "Invalid S5 public startlist course programme." });
    }
    eventKeys.add(course.eventKey);
    if (new Set(course.teams.map(team => team.teamId)).size !== course.teams.length) {
      context.addIssue({ code: "custom", message: "Duplicate S5 public startlist team." });
    }
    for (const team of course.teams) {
      const previousProgram = programsByTeam.get(team.teamId);
      if (previousProgram && previousProgram !== course.program) {
        context.addIssue({ code: "custom", message: "A gala team belongs to multiple programmes." });
      }
      programsByTeam.set(team.teamId, course.program);
      for (const rider of team.riders) {
        const previousOwner = ownersByRider.get(rider.riderId);
        if (previousOwner && previousOwner !== team.teamId) {
          context.addIssue({ code: "custom", message: "A gala rider belongs to multiple teams." });
        }
        ownersByRider.set(rider.riderId, team.teamId);
      }
    }
  }
});

export type RawSeasonFiveGalaPublicStartlists = z.infer<typeof rawStartlistsSchema>;

/** Validate the full edition snapshot and strip any non-public extra fields. */
export function parseSeasonFiveGalaPublicStartlistsPayload(value: unknown): RawSeasonFiveGalaPublicStartlists | null {
  const parsed = rawStartlistsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
