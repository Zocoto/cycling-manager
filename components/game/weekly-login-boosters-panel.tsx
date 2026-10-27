import {
  getWeeklyLoginBoosterWeek,
  WEEKLY_LOGIN_BOOSTER_INTERVAL,
  type WeeklyLoginBoosterProgress,
} from "@/lib/game/weekly-login-boosters";

export function WeeklyLoginBoostersPanel({ progress }: { progress: WeeklyLoginBoosterProgress }) {
  const week = getWeeklyLoginBoosterWeek(progress.consecutiveDays);
  return (
    <section aria-label="Connexions consécutives" className="rounded-[1.6rem] border border-[#D6A600]/25 bg-[#FFF9DB] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A7000]">Cyclo-Stickers</p>
          <h2 className="mt-1 text-xl font-black text-[#403200]">7 jours d’affilée, 1 booster</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
            Un booster est ajouté automatiquement à votre collection tous les 7 jours de connexion consécutifs.
            Un jour manqué remet la série à zéro. Les boosters déjà gagnés restent acquis et la série continue entre les saisons.
          </p>
        </div>
        <span className="rounded-full border border-[#D6A600]/20 bg-white px-3 py-2 text-xs font-black text-[#715700]">
          Boosters gagnés : {progress.totalBoostersAwarded}
        </span>
      </div>
      <div role="progressbar" aria-label="Semaine de connexion" aria-valuemin={0} aria-valuemax={WEEKLY_LOGIN_BOOSTER_INTERVAL} aria-valuenow={week.completedDays}
        className="mt-4 grid max-w-sm grid-cols-7 gap-2">
        {Array.from({ length: WEEKLY_LOGIN_BOOSTER_INTERVAL }, (_, index) => (
          <span aria-hidden="true" key={index} className={`flex h-9 items-center justify-center rounded-lg border text-xs font-black ${index < week.completedDays ? "border-[#176951] bg-[#176951] text-white" : "border-[#D6A600]/25 bg-white text-[#8A7000]"}`}>
            {index < week.completedDays ? "✓" : index + 1}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-[#60756E]">
        <span>Jours consécutifs : {progress.consecutiveDays}</span>
        <span>Prochain booster dans {week.daysUntilNextBooster} jour(s)</span>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">Les jours sont comptés à l’heure de Paris. Ce bonus est indépendant des cadeaux quotidiens.</p>
      {progress.boosterAwardedToday ? <p role="status" className="mt-3 text-sm font-black text-[#176951]">Votre booster du jour a été ajouté à votre collection !</p> : null}
    </section>
  );
}
