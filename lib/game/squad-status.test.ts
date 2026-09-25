import { describe, expect, it } from "vitest";

import {
  getSquadStatusLabel,
  getSquadStatusRank,
  isSquadStatus,
  parseSquadStatus,
  SQUAD_STATUS_OPTIONS,
} from "./squad-status";

describe("squad statuses", () => {
  it("expose une hiérarchie complète sans valeur dupliquée", () => {
    expect(new Set(SQUAD_STATUS_OPTIONS.map((option) => option.value)).size).toBe(
      SQUAD_STATUS_OPTIONS.length,
    );
    expect(SQUAD_STATUS_OPTIONS.map((option) => option.rank)).toEqual([
      100, 90, 80, 70, 60, 50, 40, 30, 20,
    ]);
  });

  it("rejette les statuts inconnus venant de la base ou du client", () => {
    expect(isSquadStatus("absolute_leader")).toBe(true);
    expect(parseSquadStatus("lieutenant")).toBe("lieutenant");
    expect(parseSquadStatus("manager")).toBeNull();
    expect(parseSquadStatus(null)).toBeNull();
  });

  it("fournit le libellé et le rang utilisés par l’interface et le tri", () => {
    expect(getSquadStatusLabel("road_captain")).toBe("Capitaine de route");
    expect(getSquadStatusLabel(null)).toBe("Non défini");
    expect(getSquadStatusRank("absolute_leader")).toBe(100);
    expect(getSquadStatusRank(null)).toBeNull();
  });
});
