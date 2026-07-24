import type {
  TutorialStepPlacement,
  TutorialTargetRectangle,
} from "@/types/tutorial";

export type TutorialViewportSize = {
  width: number;
  height: number;
};

export type TutorialPanelSize = {
  width: number;
  height: number;
};

export type TutorialPanelPosition = {
  left: number;
  top: number;
  placement: TutorialStepPlacement;
};

type CalculateTutorialPanelPositionOptions = {
  targetRectangle: TutorialTargetRectangle | null;
  preferredPlacement?: TutorialStepPlacement;
  panelSize: TutorialPanelSize;
  viewportSize: TutorialViewportSize;
  gap?: number;
  viewportPadding?: number;
};

const POSITIONING_PLACEMENTS = [
  "top",
  "right",
  "bottom",
  "left",
] as const satisfies readonly TutorialStepPlacement[];

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (maximum < minimum) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function getOppositePlacement(
  placement: TutorialStepPlacement,
): TutorialStepPlacement {
  switch (placement) {
    case "top":
      return "bottom";

    case "right":
      return "left";

    case "bottom":
      return "top";

    case "left":
      return "right";

    case "center":
      return "center";
  }
}

function getCandidatePosition({
  targetRectangle,
  placement,
  panelSize,
  gap,
}: {
  targetRectangle: TutorialTargetRectangle;
  placement: TutorialStepPlacement;
  panelSize: TutorialPanelSize;
  gap: number;
}): TutorialPanelPosition {
  switch (placement) {
    case "top":
      return {
        placement,
        left:
          targetRectangle.left +
          targetRectangle.width / 2 -
          panelSize.width / 2,
        top:
          targetRectangle.top -
          panelSize.height -
          gap,
      };

    case "right":
      return {
        placement,
        left: targetRectangle.right + gap,
        top:
          targetRectangle.top +
          targetRectangle.height / 2 -
          panelSize.height / 2,
      };

    case "bottom":
      return {
        placement,
        left:
          targetRectangle.left +
          targetRectangle.width / 2 -
          panelSize.width / 2,
        top: targetRectangle.bottom + gap,
      };

    case "left":
      return {
        placement,
        left:
          targetRectangle.left -
          panelSize.width -
          gap,
        top:
          targetRectangle.top +
          targetRectangle.height / 2 -
          panelSize.height / 2,
      };

    case "center":
      return {
        placement,
        left: 0,
        top: 0,
      };
  }
}

function positionFitsViewport({
  position,
  panelSize,
  viewportSize,
  viewportPadding,
}: {
  position: TutorialPanelPosition;
  panelSize: TutorialPanelSize;
  viewportSize: TutorialViewportSize;
  viewportPadding: number;
}): boolean {
  return (
    position.left >= viewportPadding &&
    position.top >= viewportPadding &&
    position.left + panelSize.width <=
      viewportSize.width - viewportPadding &&
    position.top + panelSize.height <=
      viewportSize.height - viewportPadding
  );
}

function centerPanel({
  panelSize,
  viewportSize,
  viewportPadding,
}: {
  panelSize: TutorialPanelSize;
  viewportSize: TutorialViewportSize;
  viewportPadding: number;
}): TutorialPanelPosition {
  return {
    placement: "center",
    left: clamp(
      (viewportSize.width - panelSize.width) / 2,
      viewportPadding,
      viewportSize.width -
        panelSize.width -
        viewportPadding,
    ),
    top: clamp(
      (viewportSize.height - panelSize.height) / 2,
      viewportPadding,
      viewportSize.height -
        panelSize.height -
        viewportPadding,
    ),
  };
}

function buildPlacementOrder(
  preferredPlacement: TutorialStepPlacement,
): TutorialStepPlacement[] {
  if (preferredPlacement === "center") {
    return ["center"];
  }

  const placements: TutorialStepPlacement[] = [
    preferredPlacement,
    getOppositePlacement(preferredPlacement),
    ...POSITIONING_PLACEMENTS,
  ];

  return placements.filter(
    (placement, index) =>
      placements.indexOf(placement) === index,
  );
}

/**
 * Agrandit la zone mise en évidence autour de l’élément ciblé,
 * sans jamais dépasser les limites de la fenêtre.
 */
export function expandTutorialTargetRectangle(
  rectangle: TutorialTargetRectangle,
  padding: number,
  viewportSize: TutorialViewportSize,
): TutorialTargetRectangle {
  const safePadding = Math.max(0, padding);

  const top = clamp(
    rectangle.top - safePadding,
    0,
    viewportSize.height,
  );

  const right = clamp(
    rectangle.right + safePadding,
    0,
    viewportSize.width,
  );

  const bottom = clamp(
    rectangle.bottom + safePadding,
    0,
    viewportSize.height,
  );

  const left = clamp(
    rectangle.left - safePadding,
    0,
    viewportSize.width,
  );

  return {
    top,
    right,
    bottom,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Calcule la position de l’infobulle.
 *
 * Le placement demandé est privilégié. Lorsqu’il manque de la place,
 * la fonction essaie automatiquement le côté opposé, puis les autres
 * côtés disponibles.
 */
export function calculateTutorialPanelPosition({
  targetRectangle,
  preferredPlacement = "bottom",
  panelSize,
  viewportSize,
  gap = 14,
  viewportPadding = 12,
}: CalculateTutorialPanelPositionOptions): TutorialPanelPosition {
  const safeViewportPadding = Math.max(
    0,
    viewportPadding,
  );

  if (
    !targetRectangle ||
    preferredPlacement === "center"
  ) {
    return centerPanel({
      panelSize,
      viewportSize,
      viewportPadding: safeViewportPadding,
    });
  }

  const placementOrder = buildPlacementOrder(
    preferredPlacement,
  );

  for (const placement of placementOrder) {
    if (placement === "center") {
      continue;
    }

    const candidate = getCandidatePosition({
      targetRectangle,
      placement,
      panelSize,
      gap,
    });

    if (
      positionFitsViewport({
        position: candidate,
        panelSize,
        viewportSize,
        viewportPadding: safeViewportPadding,
      })
    ) {
      return candidate;
    }
  }

  const fallbackPlacement = preferredPlacement;

  const fallback = getCandidatePosition({
    targetRectangle,
    placement: fallbackPlacement,
    panelSize,
    gap,
  });

  return {
    placement: fallbackPlacement,
    left: clamp(
      fallback.left,
      safeViewportPadding,
      viewportSize.width -
        panelSize.width -
        safeViewportPadding,
    ),
    top: clamp(
      fallback.top,
      safeViewportPadding,
      viewportSize.height -
        panelSize.height -
        safeViewportPadding,
    ),
  };
}