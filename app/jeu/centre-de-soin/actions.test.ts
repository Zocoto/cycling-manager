import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const actions = readFileSync(
  join(process.cwd(), "app/jeu/centre-de-soin/actions.ts"),
  "utf8",
);

describe("actions du centre de soin", () => {
  it("ne réactualise que le centre après une validation nutritionnelle", () => {
    const helper = actions.slice(
      actions.indexOf("function revalidateHealthPaths()"),
      actions.indexOf("function redirectWithError"),
    );

    expect(helper).toContain('revalidatePath("/jeu/centre-de-soin")');
    expect(helper).not.toContain('revalidatePath("/jeu/effectif")');
    expect(helper).not.toContain('revalidatePath("/jeu/calendrier")');
    expect(helper).not.toContain('revalidatePath("/jeu")');
  });

  it("journalise la durée du lot sans exposer les coureurs", () => {
    expect(actions).toContain('console.info("nutrition_batch_action"');
    expect(actions).toContain("durationMs: Date.now() - startedAt");
    expect(actions).not.toContain("riderIds:");
  });
});
