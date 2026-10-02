import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const developmentTeamService = readFileSync(
  resolve(process.cwd(), "services/development-team.ts"),
  "utf8",
);

describe("classements Development Team volumineux", () => {
  it("charge tous les résultats sans subir la limite PostgREST de 1 000 lignes", () => {
    expect(developmentTeamService).toContain(
      "collectChunkedPaginatedRows<ResultRow, { message: string }, string>",
    );
    expect(developmentTeamService).toContain("values: visibleEditionIds");
    expect(developmentTeamService).toContain(
      '.in("race_edition_id", editionIdChunk)',
    );
    expect(developmentTeamService).toContain(".range(from, to)");
    expect(developmentTeamService).not.toContain(
      '.in("race_edition_id", visibleEditionIds)\n        .order("rank")',
    );
  });

  it("utilise un ordre stable afin de ne perdre ni dupliquer de lignes entre deux pages", () => {
    expect(developmentTeamService).toContain(
      '.order("race_edition_id", { ascending: true })',
    );
    expect(developmentTeamService).toContain(
      '.order("result_scope", { ascending: true })',
    );
    expect(developmentTeamService).toContain(
      '.order("id", { ascending: true })',
    );
  });
});
