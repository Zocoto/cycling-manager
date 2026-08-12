import Link from "@/components/ui/app-link";
import { GameHeader } from "@/components/game/game-header";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  CONTINENTAL_CHAMPION_PALETTES,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import type { GameHeaderData } from "@/services/game-header-data";
import type { PublicRiderProfile } from "@/services/public-rider-profile";

export function ArchivedRiderProfileView({
  profile,
  headerData,
  simulatorEmail,
}: {
  profile: PublicRiderProfile;
  headerData: GameHeaderData;
  simulatorEmail?: string;
}) {
  if (!profile.archive) return null;

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const seasonsCount = new Set(profile.history.map((entry) => entry.seasonId))
    .size;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={simulatorEmail}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#60756E]">
          <span aria-hidden="true">⌛</span>
          Fiche historique · carrière terminée
        </p>

        <header className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#193D35)] text-[#FFFDF4] shadow-[0_25px_70px_rgba(19,60,46,0.2)]">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <RiderAvatar
              profileKey={profile.avatarProfileKey}
              seed={profile.avatarSeed}
              riderId={profile.id}
              age={profile.archive.retirementAge ?? 35}
              jersey={FREE_AGENT_RIDER_JERSEY}
              label={`Portrait historique de ${fullName}`}
              className="h-40 w-40 rounded-[2rem] border-white/20 grayscale-[20%] shadow-2xl sm:h-48 sm:w-48"
            />

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#F2C94C]">
                Archives du peloton
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                {fullName}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold text-[#D6DFD2]">
                <Link
                  href={`/jeu/nations/${profile.country.code.toLowerCase()}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 transition hover:bg-white/15"
                >
                  <span
                    className={`fi fi-${profile.country.code.toLowerCase()} rounded-sm`}
                    role="img"
                    aria-label={`Drapeau ${profile.country.name}`}
                  />
                  {profile.country.name}
                </Link>
                <span className="rounded-full bg-[#F2C94C]/20 px-3 py-1.5 text-[#FFE897]">
                  Retraité en {profile.archive.retirementSeasonName}
                </span>
                {profile.archive.retirementAge ? (
                  <span className="rounded-full bg-white/10 px-3 py-1.5">
                    Âge figé · {profile.archive.retirementAge} ans
                  </span>
                ) : null}
              </div>
              <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-[#BFD1C6]">
                Cette fiche est figée à la fin de la carrière du coureur. Elle
                conserve uniquement les équipes traversées, les victoires, les
                classements et les résultats marquants de son parcours.
              </p>
              <p className="mt-2 text-xs font-bold text-[#9BE0BC]">
                {profile.archive.reasonLabel}
              </p>
            </div>
          </div>

          <dl className="grid border-t border-white/10 bg-black/10 sm:grid-cols-4">
            <ArchiveMetric
              label="Saisons en équipe"
              value={String(seasonsCount)}
            />
            <ArchiveMetric
              label="Victoires"
              value={String(profile.archive.totalVictories)}
            />
            <ArchiveMetric
              label="Points carrière"
              value={String(profile.archive.totalPoints)}
            />
            <ArchiveMetric
              label="Meilleur rang UCI"
              value={
                profile.archive.bestUciRank
                  ? `#${profile.archive.bestUciRank}`
                  : "—"
              }
            />
          </dl>
        </header>

        <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
          <div className="px-6 py-6 sm:px-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Carrière
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Historique des saisons
            </h2>
          </div>

          {profile.history.length ? (
            <div className="grid gap-3 border-t border-[#315B3E]/10 p-5 lg:grid-cols-2">
              {profile.history.map((entry) => (
                <article
                  key={`${entry.seasonId}-${entry.teamId}`}
                  className="rounded-2xl border border-[#315B3E]/12 bg-[#F8FBF9] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#278B70]">
                        {entry.seasonName}
                      </p>
                      <Link
                        href={`/jeu/equipes/${entry.teamId}`}
                        className="mt-2 inline-flex font-black text-[#183F37] underline decoration-[#176951]/25 underline-offset-4"
                      >
                        {entry.teamName} ↗
                      </Link>
                    </div>
                    <span className="rounded-full bg-[#E5F4ED] px-3 py-1 text-[10px] font-black text-[#176951]">
                      {entry.uciRank ? `UCI #${entry.uciRank}` : "Non classé"}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <HistoryMetric
                      label="Victoires"
                      value={entry.victories ?? 0}
                    />
                    <HistoryMetric label="Points" value={entry.points ?? 0} />
                  </dl>

                  {entry.nationalTitles.length ||
                  entry.worldTitles.length ||
                  entry.continentalTitles.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.nationalTitles.map((title) => (
                        <span
                          key={`${title.type}-${title.countryCode}`}
                          className="rounded-full bg-[#F2C94C]/20 px-3 py-1 text-[10px] font-black text-[#71580A]"
                        >
                          {title.type === "time_trial"
                            ? "Champion national CLM"
                            : "Champion national"}
                        </span>
                      ))}
                      {entry.worldTitles.map((title) => (
                        <span
                          key={`world-${title.type}`}
                          className="rounded-full bg-[linear-gradient(90deg,#2166B1,#E32636,#111111,#F2C94C,#16834A)] px-3 py-1 text-[10px] font-black text-white shadow-sm"
                        >
                          Champion du monde{" "}
                          {title.type === "time_trial" ? "CLM" : "route"}
                        </span>
                      ))}
                      {entry.continentalTitles.map((title) => {
                        const palette =
                          CONTINENTAL_CHAMPION_PALETTES[title.continentCode];
                        return (
                          <span
                            key={`continental-${title.continentCode}-${title.type}`}
                            className="rounded-full px-3 py-1 text-[10px] font-black text-white shadow-sm"
                            style={{ backgroundColor: palette.secondary }}
                          >
                            Champion {title.continentName}{" "}
                            {title.type === "time_trial" ? "CLM" : "route"}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}

                  {entry.notablePerformances.length ? (
                    <div className="mt-4 border-t border-[#315B3E]/10 pt-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#60756E]">
                        Résultats notables
                      </p>
                      <ul className="mt-2 space-y-2">
                        {entry.notablePerformances
                          .slice(0, 4)
                          .map((performance) => (
                            <li
                              key={performance.raceEditionId}
                              className="text-xs font-semibold leading-5 text-[#48665F]"
                            >
                              <strong className="text-[#183F37]">
                                {performance.raceName}
                              </strong>{" "}
                              · {performance.labels.join(" · ")}
                            </li>
                          ))}
                      </ul>
                      {entry.notablePerformances.length > 4 ? (
                        <details className="group mt-3 rounded-xl border border-[#315B3E]/10 bg-white">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-black text-[#176951] marker:hidden">
                            <span>
                              Voir les {entry.notablePerformances.length - 4}{" "}
                              autres résultats
                            </span>
                            <span
                              aria-hidden="true"
                              className="transition group-open:rotate-180"
                            >
                              ⌄
                            </span>
                          </summary>
                          <ul className="space-y-2 border-t border-[#315B3E]/10 px-3 py-3">
                            {entry.notablePerformances
                              .slice(4)
                              .map((performance) => (
                                <li
                                  key={performance.raceEditionId}
                                  className="text-xs font-semibold leading-5 text-[#48665F]"
                                >
                                  <strong className="text-[#183F37]">
                                    {performance.raceName}
                                  </strong>{" "}
                                  · {performance.labels.join(" · ")}
                                </li>
                              ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="border-t border-[#315B3E]/10 px-6 py-8 text-sm font-bold text-[#60756E] sm:px-8">
              Aucune saison en équipe n’est enregistrée pour ce coureur.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function ArchiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-white/10 px-6 py-5 sm:border-r sm:last:border-r-0">
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9BE0BC]">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-black text-white">{value}</dd>
    </div>
  );
}

function HistoryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-[#60756E]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black text-[#183F37]">{value}</dd>
    </div>
  );
}
