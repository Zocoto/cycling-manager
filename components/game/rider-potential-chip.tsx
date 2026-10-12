import { PotentialStars } from "@/components/game/potential-stars";
import {
  formatScoutedPotentialValue,
  type ScoutedPotentialValue,
} from "@/lib/game/transfer-scouting";

export function RiderPotentialChip({
  potentialSteps,
  scoutedPotential,
}: {
  potentialSteps: number | null;
  scoutedPotential?: ScoutedPotentialValue | null;
}) {
  const potential: ScoutedPotentialValue = scoutedPotential ?? (
    potentialSteps === null
      ? { kind: "unknown" }
      : { kind: "exact", steps: potentialSteps }
  );

  return (
    <span
      data-rider-potential
      title={potential.kind === "range" ? "Potentiel estimé par le scouting" : undefined}
      className="inline-flex items-center rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#48665F] shadow-sm"
    >
      {potential.kind === "unknown" ? (
        "Potentiel à découvrir"
      ) : potential.kind === "range" ? (
        <>Potentiel estimé {formatScoutedPotentialValue(potential)}</>
      ) : (
        <>
          <span className="mr-1">Potentiel</span>
          <PotentialStars potentialSteps={potential.steps} compact />
        </>
      )}
    </span>
  );
}
