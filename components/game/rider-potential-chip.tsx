import { PotentialStars } from "@/components/game/potential-stars";

export function RiderPotentialChip({
  potentialSteps,
}: {
  potentialSteps: number | null;
}) {
  return (
    <span
      data-rider-potential
      className="inline-flex items-center rounded-full border border-[#315B3E]/10 bg-white/85 px-2 py-1 text-[9px] font-black text-[#48665F] shadow-sm"
    >
      {potentialSteps === null ? (
        "Potentiel à découvrir"
      ) : (
        <>
          <span className="mr-1">Potentiel</span>
          <PotentialStars potentialSteps={potentialSteps} compact />
        </>
      )}
    </span>
  );
}
