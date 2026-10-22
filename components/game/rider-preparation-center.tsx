import Image from "next/image";

import { startRiderPerformancePreparationAction } from "@/app/jeu/entrainement/actions";
import { getPerformancePreparationPolicy, PERFORMANCE_PREPARATION_FACILITIES, PERFORMANCE_PREPARATION_TYPES, type PerformancePreparationType } from "@/lib/game/performance-preparation";
import { getInfrastructureSpecializationProposal } from "@/lib/game/infrastructure-specializations";
import type { TeamRiderPreparationOverview } from "@/services/team-rider-preparation";

export function RiderPreparationCenter({
  overview,
}: {
  overview: TeamRiderPreparationOverview;
}) {
  return (
    <div>
      <header className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] p-7 text-white shadow-[0_22px_60px_rgba(7,26,23,.2)] sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#9BE0BC]">
          {overview.teamName} · {overview.seasonName} · J
          {overview.currentDayNumber}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Préparation coureurs
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-[#D6DFD2]">
          Le coureur est indisponible pendant deux jours. Son bonus s’active dès
          le lendemain de son retour et peut traverser la fin de saison.
        </p>
      </header>
      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        {PERFORMANCE_PREPARATION_TYPES.map(type => <FacilityCard key={type} overview={overview}
          type={type} title={PERFORMANCE_PREPARATION_FACILITIES[type].name}
          imagePath={PERFORMANCE_PREPARATION_FACILITIES[type].imagePath} stats={PERFORMANCE_PREPARATION_FACILITIES[type].stats} />)}
      </div>
      {overview.preparations.length ? (
        <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-black text-[#183F37]">
            Préparations récentes
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {overview.preparations.slice(0, 8).map((preparation) => (
              <article
                key={preparation.id}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F5F9F7] p-4"
              >
                <p className="font-black text-[#183F37]">
                  {preparation.riderName}
                </p>
                <p className="mt-1 text-xs font-bold text-[#60756E]">
                  {PERFORMANCE_PREPARATION_FACILITIES[preparation.type].name}{" "}
                  N{preparation.buildingLevel} · +
                  {preparation.ratingBonus.toLocaleString("fr-FR")}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#176951]">
                  {getPreparationStatusLabel(
                    preparation,
                    overview.currentGameDayIndex,
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FacilityCard({
  overview,
  type,
  title,
  imagePath,
  stats,
}: {
  overview: TeamRiderPreparationOverview;
  type: PerformancePreparationType;
  title: string;
  imagePath: string;
  stats: string;
}) {
  const facility = overview.facilities[type];
  const policy = getPerformancePreparationPolicy(facility.level, { preparationType: type, specializationCode: facility.specializationCode });
  const orientation = getInfrastructureSpecializationProposal("team", type)?.options.find(option => option.code === facility.specializationCode);
  const activeIds =
    facility.activePreparationIds ??
    (facility.activePreparationId ? [facility.activePreparationId] : []);
  const activePreparations = overview.preparations.filter((row) =>
    activeIds.includes(row.id),
  );
  const nextBonusStart = overview.currentGameDayIndex + 3;
  const nextBonusEnd =
    overview.currentGameDayIndex + 2 + (policy?.bonusDays ?? 0);
  const availableRiders = overview.riders.filter(
    (rider) =>
      !overview.preparations.some(
        (preparation) =>
          preparation.riderId === rider.id &&
          preparation.status !== "cancelled" &&
          ((preparation.status === "planned" &&
            preparation.preparationStartGameDay <=
              overview.currentGameDayIndex + 2 &&
            preparation.preparationEndGameDay >=
              overview.currentGameDayIndex + 1) ||
            (preparation.type === type &&
              preparation.bonusStartGameDay <= nextBonusEnd &&
              preparation.bonusEndGameDay >= nextBonusStart)),
      ),
  );
  return (
    <article
      data-preparation-facility={type}
      className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,.09)]"
    >
      <div className="relative aspect-[16/8] overflow-hidden bg-[#071A17]">
        <Image
          src={imagePath}
          alt={title}
          fill
          sizes="(min-width:1280px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#9BE0BC]">
            Installation niveau {facility.level}
          </p>
          <h2 className="mt-1 text-3xl font-black">{title}</h2>
        </div>
      </div>
      <div className="p-6">
        {!policy ? (
          <p className="rounded-xl bg-[#FFF3D6] p-4 text-sm font-bold text-[#74550B]">
            Construisez cette installation dans la rubrique Infrastructures pour
            débloquer la préparation.
          </p>
        ) : (
          <>
            <p className="text-sm font-bold text-[#176951]">
              Après 2 jours : +{policy.ratingBonus.toLocaleString("fr-FR")} sur{" "}
              {stats} pendant {policy.bonusDays} jours.
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
              Bonus de base, avant l’effet éventuel de l’architecte. Les bonus
              d’une même installation ne se cumulent pas sur un coureur.
            </p>
            <p className="mt-3 text-xs font-bold leading-5 text-[#60756E]">
              {type === "indoor_track" ? "Préparez ensemble votre sprinteur et ses lanceurs aux niveaux supérieurs."
                : type === "wind_tunnel" ? "Préparez vos spécialistes du chrono et vos rouleurs pour une série de courses."
                : "Préparation ciblée sur une seule note, sans modifier les statistiques permanentes du coureur."}
            </p>
            {orientation ? <p className="mt-2 text-xs font-bold text-[#176951]">Orientation active : {orientation.name}</p> : null}
            <div className="mt-4 rounded-xl bg-[#EAF5F3] p-4">
              <p className="text-sm font-black text-[#176951]">
                Places occupées : {activeIds.length}/{policy.capacity}
              </p>
              {activePreparations.length ? (
                <ul className="mt-2 space-y-1 text-xs font-semibold text-[#176951]">
                  {activePreparations.map((preparation) => (
                    <li key={preparation.id}>
                      {preparation.riderName} ·{" "}
                      {getPreparationStatusLabel(
                        preparation,
                        overview.currentGameDayIndex,
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {activeIds.length >= policy.capacity ? (
              <p className="mt-4 text-sm font-bold text-[#60756E]">
                Toutes les places sont occupées. Attendez le retour d’un coureur
                pour lancer une nouvelle préparation de 2 jours.
              </p>
            ) : !availableRiders.length ? (
              <p className="mt-4 text-sm font-bold text-[#60756E]">
                Aucun coureur disponible pour une nouvelle préparation sans
                chevauchement.
              </p>
            ) : (
              <form
                action={startRiderPerformancePreparationAction}
                className="mt-5"
              >
                <input type="hidden" name="preparationType" value={type} />
                <label className="text-xs font-black uppercase tracking-wider text-[#60756E]">
                  Coureur
                </label>
                <select
                  name="riderId"
                  required
                  className="mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold text-[#183F37]"
                >
                  <option value="">Choisir un coureur</option>
                  {availableRiders.map((rider) => (
                    <option key={rider.id} value={rider.id}>
                      {rider.firstName} {rider.lastName} · {rider.countryCode}
                    </option>
                  ))}
                </select>
                <button className="mt-4 w-full rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0B302B]">
                  Envoyer pendant 2 jours
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function getPreparationStatusLabel(
  preparation: TeamRiderPreparationOverview["preparations"][number],
  currentGameDayIndex: number,
) {
  if (currentGameDayIndex < preparation.preparationStartGameDay) {
    const days = preparation.preparationStartGameDay - currentGameDayIndex;
    return `Départ dans ${days} jour${days > 1 ? "s" : ""} · bonus ensuite`;
  }
  if (currentGameDayIndex <= preparation.preparationEndGameDay) {
    const days = preparation.bonusStartGameDay - currentGameDayIndex;
    return `Préparation en cours · bonus dans ${days} jour${days > 1 ? "s" : ""}`;
  }
  if (currentGameDayIndex < preparation.bonusStartGameDay) {
    return "Préparation terminée · bonus dès demain";
  }
  if (currentGameDayIndex <= preparation.bonusEndGameDay) {
    const days = preparation.bonusEndGameDay - currentGameDayIndex + 1;
    return `Bonus actif · encore ${days} jour${days > 1 ? "s" : ""}`;
  }
  return "Bonus terminé";
}
