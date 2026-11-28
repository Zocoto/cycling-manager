import type { RaceStageSegment } from "./race-profiles";

type SegmentRelief = Pick<RaceStageSegment, "terrain" | "surface">;

/** Surface and relief coexist: a cobbled ascent is still an ascent. */
export function getRaceSegmentTerrainLabel(segment: SegmentRelief) {
  if (segment.surface === "cobbles") {
    if (segment.terrain === "climb") return "Montée pavée";
    if (segment.terrain === "descent") return "Descente pavée";
    return "Plat pavé";
  }
  if (segment.terrain === "climb") return "Montée";
  if (segment.terrain === "descent") return "Descente";
  return "Plat";
}

export function getRaceSegmentGradientLabel(
  segment: Pick<RaceStageSegment, "averageGradientPct">,
) {
  const gradient = segment.averageGradientPct;
  return Number.isFinite(gradient) && gradient !== 0
    ? ` ${gradient > 0 ? "+" : ""}${gradient} %`
    : "";
}

export function formatRaceSegmentOption(segment: RaceStageSegment) {
  const terrain = getRaceSegmentTerrainLabel(segment);
  const gradient = getRaceSegmentGradientLabel(segment);
  return `T${segment.segmentNumber} · ${terrain}${gradient} · ${segment.distanceKm} km`;
}
