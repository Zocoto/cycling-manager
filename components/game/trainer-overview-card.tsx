import type { TeamTrainer } from "@/services/team-training";

export function TrainerOverviewCard({ trainer }: { trainer: TeamTrainer }) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-[#183F37]">
            {trainer.firstName} {trainer.lastName}
          </p>
          <p className="mt-1 text-xs font-bold text-[#60756E]">
            <span
              className={`fi fi-${trainer.countryCode.toLowerCase()} mr-2 rounded-sm`}
              role="img"
              aria-label={`Drapeau : ${trainer.countryName}`}
            />
            {trainer.countryName} · {trainer.specialtyLabel}
          </p>
        </div>
        <span className="rounded-full bg-[#FFF2C7] px-3 py-1 text-xs font-black text-[#7A5B09]">
          N{trainer.level}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border border-[#176951]/12 bg-white px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
            Talent de base
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#183F37]">
              {trainer.specialtyLabel}
            </p>
            <span className="shrink-0 rounded-full bg-[#DFF5EC] px-2.5 py-1 text-xs font-black text-[#176951]">
              +{trainer.efficiencyBonus}%
            </span>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-[#60756E]">
            Efficacité sur les entraînements de sa spécialité.
          </p>
        </div>

        <div className="rounded-xl border border-[#315B3E]/10 bg-[#EEF5F1] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
              Lignes de talent supplémentaires
            </p>
            <span className="text-[10px] font-black text-[#176951]">
              {trainer.talents.length}/3
            </span>
          </div>
          {trainer.talents.length > 0 ? (
            <div className="mt-2 space-y-2">
              {trainer.talents.map((talent) => (
                <div
                  key={`${trainer.contractId}-${talent.slot}`}
                  className="border-t border-[#315B3E]/10 pt-2 first:border-0 first:pt-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black text-[#183F37]">
                      Ligne {talent.slot} · {talent.specialtyLabel}
                    </p>
                    <span className="shrink-0 text-xs font-black text-[#176951]">
                      +{talent.efficiencyBonus}%
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] font-semibold leading-relaxed text-[#60756E]">
                    {talent.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] font-semibold text-[#60756E]">
              Aucune ligne supplémentaire
            </p>
          )}
        </div>
      </div>

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
