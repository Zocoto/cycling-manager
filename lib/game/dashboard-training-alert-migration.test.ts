import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260831160000_use_next_training_plan_in_dashboard_alert.sql",
  ),
  "utf8",
);

const trainingActions = readFileSync(
  join(process.cwd(), "app/jeu/entrainement/actions.ts"),
  "utf8",
);

describe("dashboard training alert migration", () => {
  it("uses the latest scheduled plan in the existing dashboard RPC", () => {
    expect(migration).toContain(
      "'public.get_current_dashboard_assistant_summary()'::regprocedure",
    );
    expect(migration).toContain("v_previous_cte");
    expect(migration).toContain("v_replacement_cte");

    const replacement = migration.split("$replacement$")[1];
    expect(replacement).toContain("plan.effective_from_day_number desc");
    expect(replacement).not.toContain(
      "plan.effective_from_day_number <= context.current_day_number",
    );
  });

  it("invalidates the Bureau after saving the training plans", () => {
    expect(trainingActions).toContain('revalidatePath("/jeu")');
  });
});
