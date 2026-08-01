import {
  claimDailyRewardAction,
  redeemDailyRewardAction,
} from "@/app/jeu/objectifs/actions";
import {
  getDailyRewardImportance,
  getRatingOptionsForOffer,
  requiresRiderTarget,
  type DailyRewardInventoryItem,
  type DailyRewardOverview,
} from "@/lib/game/daily-rewards";

export function DailyRewardsPanel({
  overview,
}: {
  overview: DailyRewardOverview | null;
}) {
  if (!overview) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-[#315B3E]/25 bg-white px-6 py-12 text-center">
        <h2 className="text-2xl font-black text-[#183F37]">
          La saison doit être active
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#60756E]">
          Les cadeaux quotidiens apparaîtront dès que votre équipe disposera
          d’une saison active.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-7">
      <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_20px_60px_rgba(19,60,46,0.11)]">
        <div className="grid gap-6 bg-[linear-gradient(135deg,#071A17,#0B302B_58%,#176951)] px-6 py-7 text-white sm:px-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
              Fidélité · {overview.seasonName}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Votre série quotidienne
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#C4D7CE]">
              Ouvrez un cadeau chaque jour. Une journée de saison manquée
              remet la série à zéro ; tenez jusqu’au 28e jour pour découvrir
              la récompense finale.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center">
            <Metric label="Série" value={`${overview.consecutiveDays} j`} />
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-14 lg:grid-cols-28">
            {Array.from({ length: overview.seasonLength }, (_, index) => {
              const day = index + 1;
              const claimed = overview.claimedSeasonDays.includes(day);
              const current = day === overview.currentDayNumber;
              return (
                <div
                  key={day}
                  title={
                    claimed
                      ? `J${day} · cadeau récupéré`
                      : current
                        ? `J${day} · jour actuel`
                        : `J${day}`
                  }
                  className={`relative flex aspect-square min-w-0 items-center justify-center rounded-lg border text-[10px] font-black sm:text-xs ${
                    claimed
                      ? "border-[#176951] bg-[#176951] text-white"
                      : current
                        ? "border-[#D6A600] bg-[#FFF4B8] text-[#6A5200] ring-2 ring-[#F2C94C]/30"
                        : "border-[#315B3E]/12 bg-[#F3F7F5] text-[#789087]"
                  }`}
                >
                  {claimed ? "✓" : day}
                  {[4, 7, 14, 21, 28].includes(day) &&
                  getDailyRewardImportance(day) > 1 ? (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#F2C94C]" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {overview.availableToday ? (
            <div className="mt-7 rounded-[1.6rem] border border-[#D6A600]/28 bg-[#FFF9DB] p-5 sm:p-6">
              <div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A7000]">
                    J{overview.currentDayNumber} · cadeau {overview.prospectiveStreakDay}/28
                  </p>
                  <h3 className="mt-1 text-2xl font-black text-[#403200]">
                    {overview.offers.length > 1
                      ? "Choisissez votre récompense finale"
                      : "Votre cadeau est prêt à être ouvert"}
                  </h3>
                </div>
              </div>

              <div className={`mt-5 grid gap-4 ${overview.offers.length > 1 ? "lg:grid-cols-3" : "max-w-2xl"}`}>
                {overview.offers.map((offer) => (
                  <form
                    key={offer.key}
                    action={claimDailyRewardAction}
                    className="flex min-h-full flex-col rounded-2xl border border-[#D6A600]/25 bg-white p-5 shadow-[0_10px_25px_rgba(100,75,0,0.08)]"
                  >
                    <input type="hidden" name="rewardKey" value={offer.key} />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
                      {getGiftCategoryLabel(offer.effectKind)}
                    </p>
                    <h4 className="mt-2 text-xl font-black text-[#183F37]">
                      {offer.name}
                    </h4>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                      {offer.description}
                    </p>
                    <p className="mt-4 rounded-xl bg-[#EAF5F3] px-4 py-3 text-sm font-black text-[#176951]">
                      {offer.effectSummary}
                    </p>
                    <button
                      type="submit"
                      className="mt-auto min-h-11 rounded-xl bg-[#176951] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B]"
                    >
                      {overview.offers.length > 1 ? "Choisir ce cadeau" : "Ouvrir le cadeau"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-7 rounded-[1.6rem] border border-[#42B99A]/20 bg-[#EAF5F3] px-5 py-6 text-center">
              <p className="text-lg font-black text-[#176951]">
                ✓ Cadeau de J{overview.currentDayNumber} récupéré
              </p>
              <p className="mt-1 text-sm font-semibold text-[#60756E]">
                Revenez au prochain jour de saison pour prolonger votre série.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_18px_50px_rgba(19,60,46,0.09)] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
              Réserve de cadeaux
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37] sm:text-3xl">
              Bonus à utiliser
            </h2>
          </div>
          <p className="max-w-2xl text-sm font-semibold leading-6 text-[#60756E] sm:text-right">
            Vous choisissez le coureur, la statistique ou la course. Les bonus
            expirent à la fin de la saison suivante.
          </p>
        </div>

        {overview.inventory.some((item) => item.effectKind !== "equipment") ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {overview.inventory
              .filter((item) => item.effectKind !== "equipment")
              .map((item) => (
                <InventoryRewardCard
                  key={item.id}
                  item={item}
                  overview={overview}
                />
              ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-[#315B3E]/20 bg-[#F7FAF8] px-6 py-10 text-center">
            <p className="font-black text-[#183F37]">La réserve est vide.</p>
            <p className="mt-1 text-sm font-semibold text-[#60756E]">
              Les bonus à utiliser plus tard apparaîtront ici. Le matériel est
              rangé directement dans l’inventaire de l’équipe.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function InventoryRewardCard({
  item,
  overview,
}: {
  item: DailyRewardInventoryItem;
  overview: DailyRewardOverview;
}) {
  const ratingOptions = getRatingOptionsForOffer(item);
  const needsRider = requiresRiderTarget(item.effectKind);
  const canUse =
    (!needsRider || overview.riders.length > 0) &&
    (item.effectKind !== "wildcard" || overview.eligibleRaces.length > 0) &&
    (item.effectKind !== "special_ability" || overview.abilities.length > 0);

  return (
    <article className="flex min-h-full flex-col rounded-[1.6rem] border border-[#315B3E]/12 bg-[#FBFDFC] p-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
          {getGiftCategoryLabel(item.effectKind)}
        </p>
        <h3 className="mt-1 text-xl font-black text-[#183F37]">{item.name}</h3>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
        {item.description}
      </p>
      <p className="mt-4 rounded-xl border border-[#42B99A]/18 bg-[#EAF5F3] px-4 py-3 text-sm font-black text-[#176951]">
        {item.effectSummary}
      </p>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#789087]">
        Valable jusqu’à la fin de la saison {item.expiresAfterGameYear}
      </p>

      <form action={redeemDailyRewardAction} className="mt-auto space-y-3 pt-5">
        <input type="hidden" name="inventoryId" value={item.id} />
        {needsRider ? (
          <SelectField name="riderId" label="Coureur" required>
            <option value="">Choisir un coureur</option>
            {overview.riders.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.name}{rider.countryName ? ` · ${rider.countryName}` : ""}
              </option>
            ))}
          </SelectField>
        ) : null}

        {item.effectKind === "rating_boost" ? (
          <SelectField name="ratingKey" label="Statistique" required>
            <option value="">Choisir une statistique</option>
            {ratingOptions.map((option) => (
              <option key={option.databaseKey} value={option.databaseKey}>
                {option.shortLabel} · {option.label}
              </option>
            ))}
          </SelectField>
        ) : null}

        {item.effectKind === "special_ability" ? (
          <SelectField name="abilityCode" label="Capacité" required>
            <option value="">Choisir une capacité</option>
            {overview.abilities.map((ability) => (
              <option key={ability.code} value={ability.code}>
                {ability.name} · {ability.effectSummary}
              </option>
            ))}
          </SelectField>
        ) : null}

        {item.effectKind === "wildcard" ? (
          <SelectField name="raceEditionId" label="Course Elite hors GT" required>
            <option value="">Choisir une course</option>
            {overview.eligibleRaces.map((race) => (
              <option key={race.id} value={race.id}>
                J{race.firstDayNumber} · {race.name}
              </option>
            ))}
          </SelectField>
        ) : null}

        <button
          type="submit"
          disabled={!canUse}
          className="min-h-11 w-full rounded-xl bg-[#176951] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#0B302B] disabled:cursor-not-allowed disabled:bg-[#A9B9B2]"
        >
          {getUseLabel(item.effectKind)}
        </button>
        {!canUse ? (
          <p className="text-xs font-bold text-[#9A453D]">
            Aucun choix compatible n’est disponible actuellement.
          </p>
        ) : null}
      </form>
    </article>
  );
}

function SelectField({
  name,
  label,
  required,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black text-[#315B3E]">
      {label}
      <select
        name={name}
        required={required}
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[#315B3E]/18 bg-white px-3 text-sm font-bold text-[#183F37] outline-none focus:border-[#278B70] focus:ring-2 focus:ring-[#42B99A]/20"
      >
        {children}
      </select>
    </label>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-20 rounded-xl bg-black/15 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#BFD1C6]">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function getGiftCategoryLabel(kind: DailyRewardInventoryItem["effectKind"]) {
  if (kind === "form_boost") return "Forme";
  if (kind === "rider_experience") return "Expérience";
  if (kind === "rating_boost") return "Statistique permanente";
  if (kind === "training_multiplier") return "Entraînement";
  if (kind === "scouting_boost") return "Scouting";
  if (kind === "equipment") return "Matériel";
  if (kind === "special_ability") return "Talent révélé";
  if (kind === "naturalization") return "Naturalisation";
  return "Ticket d’or";
}

function getUseLabel(kind: DailyRewardInventoryItem["effectKind"]) {
  if (kind === "training_multiplier") return "Activer pour la prochaine séance";
  if (kind === "scouting_boost") return "Activer pendant 7 jours";
  if (kind === "wildcard") return "Réserver la Wild Card";
  return "Utiliser ce cadeau";
}
