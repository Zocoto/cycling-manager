import type { TeamTrainer } from "@/services/team-training";
import { StaffCardHeader } from "./staff-card-header";
import { StaffSkills } from "./staff-skills";

export function TrainerOverviewCard({ trainer }: { trainer: TeamTrainer }) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-5">
      <StaffCardHeader member={{
        ...trainer, role: "trainer", trainerSpecialty: trainer.specialty, architectSpecialty: null,
      }} />
      <StaffSkills level={trainer.level}
        effects={[`+${trainer.efficiencyBonus} % d’efficacité sur les entraînements ${trainer.specialtyLabel.toLocaleLowerCase("fr")}`]}
        talents={trainer.talents} nationalityAffinity={false} />

      <div className="mt-4 border-t border-[#315B3E]/10 pt-3">
        <div className="flex items-center justify-between gap-3 text-xs font-black">
          <span className="text-[#60756E]">Coureurs suivis</span>
          <span
            className={
              trainer.assignedRiderCount >= trainer.riderCapacity
                ? "text-[#B54242]"
                : "text-[#176951]"
            }
          >
            {trainer.assignedRiderCount}/{trainer.riderCapacity}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DCE8E3]"
          role="progressbar"
          aria-label={`Quota de ${trainer.firstName} ${trainer.lastName}`}
          aria-valuemin={0}
          aria-valuemax={trainer.riderCapacity}
          aria-valuenow={Math.min(
            trainer.assignedRiderCount,
            trainer.riderCapacity,
          )}
        >
          <span
            className={`block h-full rounded-full ${
              trainer.assignedRiderCount >= trainer.riderCapacity
                ? "bg-[#D84B4B]"
                : "bg-[#42B99A]"
            }`}
            style={{
              width: `${Math.min(
                100,
                (trainer.assignedRiderCount / trainer.riderCapacity) * 100,
              )}%`,
            }}
          />
        </div>
      </div>
    </article>
  );
}
