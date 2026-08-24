import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  resolve(process.cwd(), "app/jeu/materiel/laboratoire/page.tsx"),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "services/team-equipment-rnd.ts"),
  "utf8",
);

describe("parallel equipment R&D laboratory", () => {
  it("renders every active project while keeping a free slot launch form", () => {
    expect(page).toContain("overview.activeProjects.map");
    expect(page).toContain("overview.availableEngineers.map");
    expect(page).toContain("La recherche est gratuite");
    expect(page).not.toContain("Ingénieur R&D (facultatif)");
    expect(page).not.toContain("Aucun ingénieur</option>");
  });

  it("removes engineers already assigned to an active project", () => {
    expect(service).toContain("busyEngineerContractIds");
    expect(service).toContain(
      "!busyEngineerContractIds.has(engineer.contractId)",
    );
    expect(service).toContain(
      "engineers.length - activeProjects.length",
    );
  });
});
