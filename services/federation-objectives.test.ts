import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "services/federation-objectives.ts"),
  "utf8",
);

describe("federation objective metrics", () => {
  it("compte la preuve durable de soumission manuelle sans dépendre du mode courant", () => {
    expect(source).toContain(
      '.not("manually_submitted_at", "is", null)',
    );
    expect(source).not.toContain(
      '.not("created_by_director_id", "is", null)',
    );
    expect(source).toContain(
      '.in("status", ["pending_confirmation", "finalized"])',
    );
  });
});
