import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260914120000_shorten_professional_nations_cup_courses.sql",
  ),
  "utf8",
);

type AuthoredSegment = {
  slotKey: string;
  number: number;
  distanceKm: number;
  terrain: string;
  surface: string;
  gradient: number;
};

function readAuthoredSegments() {
  const pattern =
    /\('(nc-[^']+)',\s*(\d+)::smallint,\s*([\d.]+)::numeric,\s*'([^']+)',\s*'([^']+)',\s*(-?[\d.]+)::numeric\)/g;

  return Array.from(migration.matchAll(pattern), (match): AuthoredSegment => ({
    slotKey: match[1],
    number: Number(match[2]),
    distanceKm: Number(match[3]),
    terrain: match[4],
    surface: match[5],
    gradient: Number(match[6]),
  }));
}

describe("professional Nations Cup sprint formats", () => {
  const segments = readAuthoredSegments();

  it("replaces the five long classics with short specialist races", () => {
    const expectedDistances = new Map([
      ["nc-mountain", 50],
      ["nc-hills", 55],
      ["nc-sprint", 55],
      ["nc-cobbles", 55],
      ["nc-time-trial", 20],
    ]);

    for (const [slotKey, distanceKm] of expectedDistances) {
      expect(
        segments
          .filter((segment) => segment.slotKey === slotKey)
          .reduce((total, segment) => total + segment.distanceKm, 0),
      ).toBe(distanceKm);
    }
  });

  it("makes every profile visibly and mechanically distinctive", () => {
    const mountain = segments.filter(
      (segment) => segment.slotKey === "nc-mountain",
    );
    expect(mountain.at(-1)).toMatchObject({
      terrain: "climb",
      distanceKm: 10,
      gradient: 10,
    });

    const hills = segments.filter((segment) => segment.slotKey === "nc-hills");
    expect(hills.filter((segment) => segment.terrain === "climb")).toHaveLength(
      4,
    );
    expect(Math.max(...hills.map((segment) => segment.gradient))).toBe(11);

    const sprint = segments.filter(
      (segment) => segment.slotKey === "nc-sprint",
    );
    expect(sprint.every((segment) => segment.terrain === "flat")).toBe(true);

    const cobbles = segments.filter(
      (segment) => segment.slotKey === "nc-cobbles",
    );
    expect(
      cobbles
        .filter((segment) => segment.surface === "cobbles")
        .reduce((total, segment) => total + segment.distanceKm, 0),
    ).toBe(36);

    const timeTrial = segments.filter(
      (segment) => segment.slotKey === "nc-time-trial",
    );
    expect(timeTrial.some((segment) => segment.terrain === "climb")).toBe(
      true,
    );
  });

  it("updates planned S3 races and future editions without rewriting results", () => {
    expect(migration).toContain("where target.status = 'planned'");
    expect(migration).toContain(
      "select public.ensure_due_professional_nations_cup();",
    );
    expect(migration).toContain(
      "create or replace function public.ensure_professional_nations_cup",
    );
  });
});
