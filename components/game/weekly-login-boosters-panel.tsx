import {
  getWeeklyLoginBoosterWeek,
  WEEKLY_LOGIN_BOOSTER_INTERVAL,
  type WeeklyLoginBoosterProgress,
} from "@/lib/game/weekly-login-boosters";

export function WeeklyLoginBoostersPanel({ progress }: { progress: WeeklyLoginBoosterProgress }) {
  const week = getWeeklyLoginBoosterWeek(progress.consecutiveDays);
  return (
    <section aria-label="Connexions consécutives" className="mt-5 rounded-xl border border-[#D6A600]/25 bg-[#FFF9DB] p-4 sm:p-5">
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:items-center">
        <div>
          <h3 className="text-lg font-black text-[#403200]">{WEEKLY_LOGIN_BOOSTER_INTERVAL} jours d’affilée, 1 booster</h3>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-5 text-[#60756E]">
            Un booster est ajouté automatiquement à votre collection tous les {WEEKLY_LOGIN_BOOSTER_INTERVAL} jours de connexion consécutifs.
            Un jour manqué remet la série à zéro. Les boosters déjà gagnés restent acquis et la série continue entre les saisons.
          </p>
        </div>
        <div>
          <div role="progressbar" aria-label="Cycle de connexion" aria-valuemin={0} aria-valuemax={WEEKLY_LOGIN_BOOSTER_INTERVAL} aria-valuenow={week.completedDays}
            className="grid max-w-sm grid-cols-3 gap-2">
            {Array.from({ length: WEEKLY_LOGIN_BOOSTER_INTERVAL }, (_, index) => (
              <span aria-hidden="true" key={index} className={`flex h-8 items-center justify-center rounded-lg border text-xs font-black ${index < week.completedDays ? "border-[#176951] bg-[#176951] text-white" : "border-[#D6A600]/25 bg-white text-[#8A7000]"}`}>
                {index < week.completedDays ? "✓" : index + 1}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-[#60756E]">
            <span>Jours consécutifs : {progress.consecutiveDays}</span>
            <span>Boosters gagnés : {progress.totalBoostersAwarded}</span>
            <span>Prochain booster dans {week.daysUntilNextBooster} jour(s)</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">Les jours sont comptés à l’heure de Paris. Ce bonus est indépendant des cadeaux quotidiens.</p>
      {progress.boosterAwardedToday ? <p role="status" className="mt-3 text-sm font-black text-[#176951]">Votre booster du jour a été ajouté à votre collection !</p> : null}
    </section>
  );
}
