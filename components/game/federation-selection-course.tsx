import Link from "@/components/ui/app-link";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RACE_STAGE_TYPE_LABELS } from "@/lib/game/race-calendar";
import type { FederationSelectionCourse } from "@/lib/game/federation-selection-weather";
import { resolveRaceProfileType } from "@/lib/game/race-profiles";

export function getFederationCourseProfileLabel(
  course: FederationSelectionCourse,
): string {
  const labels = {
    flat: "Plat",
    sprint: "Plat · Sprint",
    hilly: "Vallonné",
    mountain: "Montagneux",
    cobbles: "Pavé",
    mixed: "Mixte",
  };
  if (course.profileType !== "time_trial") return labels[course.profileType];
  // A time trial is a discipline, not a terrain. Read its actual course when
  // the calendar only supplies the generic time_trial profile classification.
  if (!course.segments.length) return "Relief non précisé";
  const resolved = resolveRaceProfileType("flat", course.segments);
  const terrain = resolved === "mountain"
    ? "Montagneux"
    : course.segments.some((segment) => segment.terrain === "climb" && segment.averageGradientPct >= 3)
      ? "Vallonné"
      : "Plat";
  return course.segments.some((segment) => segment.surface === "cobbles")
    ? `${terrain} · Pavé`
    : terrain;
}

export function FederationSelectionCoursePreview({
  course,
}: {
  course: FederationSelectionCourse;
}) {
  return (
    <section aria-label="Parcours de l’épreuve" className="border-b border-[#315B3E]/10 bg-[#F6FAF7] p-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#183F37]">{course.stageName}</p>
          <p className="mt-1 text-xs font-semibold text-[#60756E]">
            {RACE_STAGE_TYPE_LABELS[course.stageType]} · {course.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km
          </p>
        </div>
        <Link href={course.href} className="inline-flex min-h-10 items-center rounded-xl border border-[#176951]/20 bg-white px-4 text-xs font-black text-[#176951] hover:bg-[#E8F7F1]">
          Voir la course →
        </Link>
      </div>
      {course.segments.length ? (
        <div className="mt-4">
          <RaceStageProfile segments={course.segments} showLegend />
        </div>
      ) : null}
    </section>
  );
}
