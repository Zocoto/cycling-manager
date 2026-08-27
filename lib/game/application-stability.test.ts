import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function collectInteractiveRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectInteractiveRouteFiles(path);
    return entry.name === "page.tsx" || entry.name === "layout.tsx" ? [path] : [];
  });
}

const forbiddenGlobalSettlements = [
  "settle_current_rider_state",
  "settle_current_health_and_form",
  "settle_due_training_sessions",
  "settle_due_staff_academy_trainings",
  "settle_due_infrastructure_projects",
  "settle_due_elite_wildcards",
  "settle_due_development_races",
  "settle_finished_race_conditions",
] as const;

const interactiveReaders = [
  ...collectInteractiveRouteFiles(join(process.cwd(), "app/jeu")),
  ...[
    "services/development-team.ts",
    "services/public-rider-profile.ts",
    "services/race-calendar.ts",
    "services/rider-season-planning.ts",
    "services/staff-academy.ts",
    "services/team-health.ts",
    "services/team-infrastructures.ts",
    "services/team-race-reconnaissance.ts",
    "services/team-training.ts",
    "services/youth-development.ts",
  ].map((path) => join(process.cwd(), path)),
];

describe("application stability guardrails", () => {
  it("keeps global settlements out of interactive page reads", () => {
    for (const path of interactiveReaders) {
      const source = readFileSync(path, "utf8");
      for (const settlement of forbiddenGlobalSettlements) {
        expect(source, `${path} must not run ${settlement}`).not.toContain(
          settlement,
        );
      }
    }
  });

  it("isolates, observes, and periodically checks background maintenance", () => {
    const route = readFileSync(
      join(
        process.cwd(),
        "app/api/cron/rider-state-maintenance/[task]/route.ts",
      ),
      "utf8",
    );
    const service = readFileSync(
      join(process.cwd(), "services/game-state-settlement.ts"),
      "utf8",
    );
    const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");

    expect(route).toContain("runGameMaintenanceTask(task)");
    expect(route).toContain('task === "health-check"');
    expect(route).toContain("durationMs");
    expect(service).toContain('status: "running"');
    expect(service).toContain('status: "failed"');
    expect(service).toContain("MAINTENANCE_STALE_AFTER_MS");
    for (const task of [
      "training",
      "health",
      "staff-academy",
      "infrastructure",
      "equipment",
      "elite-wildcards",
      "development",
      "health-check",
    ]) {
      expect(vercel).toContain(`/rider-state-maintenance/${task}`);
    }
  });

  it("provides recoverable error screens instead of a blank page", () => {
    const gameError = readFileSync(
      join(process.cwd(), "app/jeu/error.tsx"),
      "utf8",
    );
    const globalError = readFileSync(
      join(process.cwd(), "app/global-error.tsx"),
      "utf8",
    );

    expect(gameError).toContain("unstable_retry");
    expect(gameError).toContain("Votre partie est conservée");
    expect(globalError).toContain("unstable_retry");
    expect(globalError).toContain("<html lang=\"fr\">");
  });
});
