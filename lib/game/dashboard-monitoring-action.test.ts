import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
  resolve(process.cwd(), "app/jeu/actions.ts"),
  "utf8",
);

describe("dashboard monitoring action", () => {
  it("lit les transactions differees avec le client serveur privilegie", () => {
    expect(actionSource).toContain(
      'import { createSupabaseAdminClient } from "@/lib/supabase/admin";',
    );
    expect(actionSource).toMatch(
      /const admin = createSupabaseAdminClient\(\);[\s\S]*?admin\s*\.from\("team_finance_transactions"\)/,
    );
    expect(actionSource).not.toMatch(
      /supabase\s*\.from\("team_finance_transactions"\)/,
    );
  });
});
