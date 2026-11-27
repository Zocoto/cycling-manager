import type { TrainingPersonalityBonus } from "@/lib/game/training-personality-bonus";

export function TrainingPersonalityBonusNotice({
  bonus,
  tone = "light",
}: {
  bonus: TrainingPersonalityBonus | null | undefined;
  tone?: "light" | "dark";
}) {
  if (!bonus || bonus.percentage !== 5) return null;
  const recorded = bonus.source === "session";
  const partial = recorded && bonus.sessionCount !== undefined && bonus.totalSessionCount !== undefined
    && bonus.sessionCount < bonus.totalSessionCount;
  const detail = recorded
    ? "Bonus déjà inclus dans la progression, avant plafonds et arrondis."
    : "Cette ancienne séance ne détaille pas le caractère. Le bonus affiché est celui du caractère actuel.";

  return (
    <span
      data-training-personality-bonus={bonus.source}
      title={detail}
      className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold leading-4 ${
        tone === "dark" ? "border-[#9BE0BC]/25 bg-[#9BE0BC]/10 text-[#C9F1DC]"
          : "border-[#176951]/15 bg-[#EAF5F3] text-[#176951]"
      }`}
    >
      <span>{recorded ? "Caractère Assidu" : "Caractère actuel : Assidu"}</span>
      <strong>+5 % de progression</strong>
      {partial ? <span className="whitespace-nowrap">{bonus.sessionCount}/{bonus.totalSessionCount} <span>séances</span></span> : null}
    </span>
  );
}
