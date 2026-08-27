import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const gameErrorBoundary = readFileSync(
  resolve(process.cwd(), "app/jeu/error.tsx"),
  "utf8",
);

describe("game route error recovery", () => {
  it("retente discrètement avant de proposer des actions compactes", () => {
    expect(gameErrorBoundary).toContain("<GameRouteLoading />");
    expect(gameErrorBoundary).toContain("AUTOMATIC_RETRY_LIMIT");
    expect(gameErrorBoundary).toContain("unstable_retry");
    expect(gameErrorBoundary).toContain("Reconnexion en cours…");
    expect(gameErrorBoundary).not.toContain("Cet écran n’a pas pu se charger");
    expect(gameErrorBoundary).not.toContain("Incident temporaire");
  });
});
