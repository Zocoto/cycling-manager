import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const assignmentMatrix = readFileSync(
  join(
    process.cwd(),
    "components/game/physiotherapist-assignment-matrix.tsx",
  ),
  "utf8",
);

describe("mise en page mobile des affectations kiné", () => {
  it("remplace la matrice large par des fiches tactiles sur téléphone et tablette", () => {
    expect(assignmentMatrix).toContain(
      "data-mobile-physiotherapist-assignments",
    );
    expect(assignmentMatrix).toContain('className="grid gap-3 lg:hidden"');
    expect(assignmentMatrix).toContain("Kiné");
    expect(assignmentMatrix).toContain("Effet sur le coureur");
  });

  it("conserve le tableau et son défilement horizontal sur grand écran", () => {
    expect(assignmentMatrix).toContain(
      'className="hidden overflow-x-auto overscroll-x-contain rounded-[1.75rem]',
    );
    expect(assignmentMatrix).toContain("lg:block");
    expect(assignmentMatrix).toContain(
      '<table className="w-full min-w-max border-separate',
    );
  });

  it("applique sur mobile les mêmes quotas et la même fonction d’affectation", () => {
    const mobileMarkup = assignmentMatrix.slice(
      assignmentMatrix.indexOf("data-mobile-physiotherapist-assignments"),
      assignmentMatrix.indexOf(
        '<div className="hidden overflow-x-auto overscroll-x-contain',
      ),
    );

    expect(mobileMarkup).toContain("countPhysiotherapistAssignments(");
    expect(mobileMarkup).toContain("assignedCount >= capacity");
    expect(mobileMarkup).toContain("togglePhysiotherapistAssignment({");
    expect(mobileMarkup).toContain("disabled={capacityReached}");
  });
});
