import { describe, expect, it } from "vitest";

import {
  calculateTutorialPanelPosition,
  expandTutorialTargetRectangle,
} from "@/lib/tutorial/geometry";
import type { TutorialTargetRectangle } from "@/types/tutorial";

function createTargetRectangle(
  overrides: Partial<TutorialTargetRectangle> = {},
): TutorialTargetRectangle {
  return {
    top: 100,
    right: 200,
    bottom: 200,
    left: 100,
    width: 100,
    height: 100,
    ...overrides,
  };
}

describe("expandTutorialTargetRectangle", () => {
  it("ajoute une marge autour de la cible", () => {
    const result = expandTutorialTargetRectangle(
      createTargetRectangle(),
      10,
      {
        width: 1000,
        height: 800,
      },
    );

    expect(result).toEqual({
      top: 90,
      right: 210,
      bottom: 210,
      left: 90,
      width: 120,
      height: 120,
    });
  });

  it("ne dépasse jamais les limites de la fenêtre", () => {
    const result = expandTutorialTargetRectangle(
      createTargetRectangle({
        top: 4,
        left: 3,
        right: 997,
        bottom: 798,
        width: 994,
        height: 794,
      }),
      20,
      {
        width: 1000,
        height: 800,
      },
    );

    expect(result).toEqual({
      top: 0,
      right: 1000,
      bottom: 800,
      left: 0,
      width: 1000,
      height: 800,
    });
  });
});

describe("calculateTutorialPanelPosition", () => {
  it("centre l’infobulle lorsqu’aucune cible n’est définie", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: null,
      panelSize: {
        width: 300,
        height: 200,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
    });

    expect(result).toEqual({
      placement: "center",
      left: 350,
      top: 300,
    });
  });

  it("utilise le placement demandé lorsqu’il tient dans la fenêtre", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: createTargetRectangle(),
      preferredPlacement: "right",
      panelSize: {
        width: 200,
        height: 120,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
    });

    expect(result).toEqual({
      placement: "right",
      left: 214,
      top: 90,
    });
  });

  it("utilise le côté opposé lorsque le placement demandé déborde", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: createTargetRectangle({
        left: 850,
        right: 950,
      }),
      preferredPlacement: "right",
      panelSize: {
        width: 200,
        height: 120,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
    });

    expect(result).toEqual({
      placement: "left",
      left: 636,
      top: 90,
    });
  });

  it("place l’infobulle au-dessus lorsque le bas manque de place", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: createTargetRectangle({
        top: 650,
        bottom: 750,
      }),
      preferredPlacement: "bottom",
      panelSize: {
        width: 240,
        height: 160,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
    });

    expect(result).toEqual({
      placement: "top",
      left: 30,
      top: 476,
    });
  });

  it("respecte explicitement le placement centré", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: createTargetRectangle(),
      preferredPlacement: "center",
      panelSize: {
        width: 320,
        height: 180,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
    });

    expect(result).toEqual({
      placement: "center",
      left: 340,
      top: 310,
    });
  });

  it("contraint la position lorsque le panneau est très grand", () => {
    const result = calculateTutorialPanelPosition({
      targetRectangle: createTargetRectangle({
        top: 10,
        right: 990,
        bottom: 790,
        left: 10,
        width: 980,
        height: 780,
      }),
      preferredPlacement: "right",
      panelSize: {
        width: 900,
        height: 700,
      },
      viewportSize: {
        width: 1000,
        height: 800,
      },
      viewportPadding: 12,
    });

    expect(result.left).toBeGreaterThanOrEqual(12);
    expect(result.top).toBeGreaterThanOrEqual(12);
    expect(
      result.left + 900,
    ).toBeLessThanOrEqual(988);
    expect(
      result.top + 700,
    ).toBeLessThanOrEqual(788);
  });
});