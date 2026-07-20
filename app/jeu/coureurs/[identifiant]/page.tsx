import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { RiderConditionGauges } from "@/components/game/rider-condition-gauges";
import { RiderEquipmentLoadout } from "@/components/game/rider-equipment-loadout";
import { RankingBadge } from "@/components/game/ranking-badge";
import { RiderStatsRadar } from "@/components/game/rider-stats-radar";
import { SponsorLogoMark } from "@/components/game/sponsor-logo";
import { TeamJerseyPreview } from "@/components/game/team-jersey-preview";
import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getPublicRiderProfile } from "@/services/public-rider-profile";
import { getTeamAmateurIdentity } from "@/services/team-amateur-identity";
import { getRiderEquipmentManagement } from "@/services/team-equipment";
import { getRiderTransferManagement } from "@/services/transfer-market";
import { getActiveTeamSponsorIdentity } from "@/services/team-sponsor-identity";
import { renewRiderContractAction, signFreeAgentAction } from "@/app/jeu/transferts/actions";
import { TransferSubmitButton } from "@/components/game/transfer-submit-button";
import { getRiderRankingEntry } from "@/services/uci-rankings";

export const metadata: Metadata = {
  title: "Fiche coureur",
  description:
    "Consultez l’identité, les caractéristiques et la carrière d’un coureur dans Cyclostratège.",
};

type RiderProfilePageProps = {
  params: Promise<{
    identifiant: string;
  }>;
  searchParams: Promise<{
    equipement?: string;
    succes?: string;
    erreur?: string;
  }>;
};

const FREE_AGENT_JERSEY: AmateurJerseyConfig = {
  pattern: "classic",
  primaryColor: FREE_AGENT_RIDER_JERSEY.primaryColor,
  secondaryColor: FREE_AGENT_RIDER_JERSEY.secondaryColor,
  accentColor: FREE_AGENT_RIDER_JERSEY.accentColor,
};

export default async function RiderProfilePage({ params, searchParams }: RiderProfilePageProps) {
  const { identifiant } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [profile, headerData, riderRanking] = await Promise.all([
    getPublicRiderProfile({
      riderIdentifier: identifiant,
      viewerAuthUserId: user.id,
    }),
    getGameHeaderData(supabase, user.id),
    getRiderRankingEntry(identifiant),
  ]);

  if (!profile) {
    notFound();
  }

  const [equipmentManagement, transferManagement] = await Promise.all([
    profile.canManage
      ? getRiderEquipmentManagement(user.id, profile.id)
      : Promise.resolve(null),
    getRiderTransferManagement(user.id, profile.id),
  ]);

  const [amateurIdentity, sponsorIdentity] = profile.currentTeam
    ? await Promise.all([
        getTeamAmateurIdentity(profile.currentTeam.id),
        getActiveTeamSponsorIdentity(profile.currentTeam.id),
      ])
    : [null, null];
  const riderJersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const countryHref = `/jeu/nations/${profile.country.code.toLowerCase()}`;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        {query.equipement ? (
          <p className="mb-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
            {query.equipement === "programme"
              ? "Le changement est programmé : il prendra effet demain à 12 h."
              : "L’équipement du coureur a été mis à jour."}
          </p>
        ) : null}
        {query.succes ? (
          <p className="mb-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
            {query.succes}
          </p>
        ) : null}
        {query.erreur ? (
          <p className="mb-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
            {query.erreur}
          </p>
        ) : null}
        <p className="mb-4 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#60756E]">
          <span aria-hidden="true">↗</span>
          Fiche ouverte indépendamment de votre espace de jeu
        </p>

        <header className="overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-[linear-gradient(135deg,#071A17,#176951)] text-[#FFFDF4] shadow-[0_25px_70px_rgba(19,60,46,0.2)]">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_280px] lg:items-center">
            <RiderAvatar
              profileKey={profile.avatarProfileKey}
              seed={profile.avatarSeed}
              riderId={profile.id}
              age={profile.age ?? 25}
              jersey={riderJersey}
              label={`Portrait généré de ${fullName}`}
              className="h-48 w-48 rounded-[2rem] border-white/25 shadow-2xl sm:h-56 sm:w-56"
            />

            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#9BE0BC]">
                Coureur cycliste
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                {fullName}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.age ? (
                  <IdentityBadge>{profile.age} ans</IdentityBadge>
                ) : null}
                <Link
                  href={countryHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                >
                  <CountryFlag code={profile.country.code} name={profile.country.name} />
                  {profile.country.name}
                  <span aria-hidden="true">↗</span>
                </Link>
                <IdentityBadge>
                  {profile.activeSeason?.name ?? "Hors saison"}
                </IdentityBadge>
              </div>
              <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-[#D6DFD2]">
                Portrait permanent, caractéristiques sportives de la saison et parcours professionnel du coureur.
              </p>
            </div>

            <div className="space-y-3">
              <RankingBadge
                rank={riderRanking?.rank ?? null}
                points={riderRanking?.points ?? 0}
                label="Classement individuel"
                href="/jeu/classements?vue=individuel"
                dark
              />
              <CurrentTeamCard
                team={profile.currentTeam}
                amateurJersey={amateurIdentity?.jersey ?? FREE_AGENT_JERSEY}
                amateurTeamName={amateurIdentity?.amateurName ?? null}
                sponsorIdentity={sponsorIdentity}
              />
            </div>
          </div>
        </header>

        <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Profil sportif
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Caractéristiques de la saison
            </h2>
            {profile.ratings ? (
              <div className="mt-5">
                <RiderStatsRadar ratings={profile.ratings} />
              </div>
            ) : (
              <EmptyBlock message="Aucune caractéristique n’est disponible pour ce coureur." />
            )}
          </section>

          <aside className="space-y-5">
            <RiderConditionGauges
              form={profile.condition.form}
              dayNumber={profile.condition.dayNumber}
            />
            <LockedTrainingCard />
            <SpecialAbilitiesCard />
          </aside>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <CareerHistory history={profile.history} />
          {profile.privateContract ? (
            <div className="space-y-5">
              <PrivateContractCard contract={profile.privateContract} />
              {transferManagement ? (
                <ContractRenewalCard
                  riderId={profile.id}
                  management={transferManagement}
                />
              ) : null}
            </div>
          ) : transferManagement?.isFreeAgent ? (
            <FreeAgentSigningCard
              riderId={profile.id}
              management={transferManagement}
            />
          ) : (
            <CareerSummaryCard
              teamName={profile.currentTeam?.displayName ?? "Agent libre"}
              seasonsCount={new Set(profile.history.map((entry) => entry.seasonId)).size}
            />
          )}
        </div>

        <div className="mt-7">
          <RiderEquipmentLoadout
            riderId={profile.id}
            equipment={profile.equipment}
            canManage={profile.canManage}
            management={equipmentManagement}
          />
        </div>
      </section>
    </main>
  );
}

function FreeAgentSigningCard({
  riderId,
  management,
}: {
  riderId: string;
  management: NonNullable<Awaited<ReturnType<typeof getRiderTransferManagement>>>;
}) {
  return (
    <article className="rounded-[2rem] border border-[#42B99A]/25 bg-[#0B302B] p-6 text-white shadow-[0_16px_45px_rgba(7,26,23,0.16)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#9BE0BC]">
        Agent libre
      </p>
      <h2 className="mt-2 text-2xl font-black text-white">Signer un contrat</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
        Aucune indemnité de transfert. Le contrat couvre la saison actuelle et la suivante.
      </p>
      {management.freeAgentSalary !== null ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">Demande salariale</p>
          <p className="mt-1 text-xl font-black text-[#F2C94C]">{formatMoney(management.freeAgentWeeklySalary ?? 0, "EUR")} / semaine</p>
          <p className="mt-1 text-xs font-bold text-[#BFD1C6]">{formatMoney(management.freeAgentSalary, "EUR")} par saison</p>
        </div>
      ) : null}
      {management.canSignFreeAgent ? (
        <form action={signFreeAgentAction} className="mt-5">
          <input type="hidden" name="riderId" value={riderId} />
          <input type="hidden" name="returnPath" value={`/jeu/coureurs/${riderId}`} />
          <TransferSubmitButton pendingLabel="Signature…">Signer pour 2 saisons</TransferSubmitButton>
        </form>
      ) : (
        <p className="mt-5 rounded-xl bg-[#F2C94C]/10 px-4 py-3 text-xs font-bold text-[#FFE596]">
          {management.freeAgentBlockedReason ?? "Ce coureur n’est pas disponible à la signature."}
        </p>
      )}
    </article>
  );
}

function ContractRenewalCard({
  riderId,
  management,
}: {
  riderId: string;
  management: NonNullable<Awaited<ReturnType<typeof getRiderTransferManagement>>>;
}) {
  if (!management.canRenew && !management.hasPlannedRenewal) return null;
  return (
    <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">Avenir contractuel</p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">Renouvellement</h2>
      {management.hasPlannedRenewal ? (
        <p className="mt-4 rounded-xl bg-[#DDF3E7] px-4 py-3 text-sm font-bold text-[#176951]">Le contrat de la saison suivante est déjà signé.</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#60756E]">
            {management.renewalSalary === 0
              ? "Sa moyenne est inférieure à 60 : il accepte de rester amateur sans salaire."
              : `Sa demande sera de ${formatMoney(management.renewalSalary ?? 0, "EUR")} pour la prochaine saison.`}
          </p>
          <form action={renewRiderContractAction} className="mt-4">
            <input type="hidden" name="riderId" value={riderId} />
            <input type="hidden" name="returnPath" value={`/jeu/coureurs/${riderId}`} />
            <TransferSubmitButton pendingLabel="Renouvellement…" tone="green">Renouveler</TransferSubmitButton>
          </form>
        </>
      )}
    </article>
  );
}

function CurrentTeamCard({
  team,
  amateurJersey,
  amateurTeamName,
  sponsorIdentity,
}: {
  team: { id: string; displayName: string; shortName: string | null } | null;
  amateurJersey: AmateurJerseyConfig;
  amateurTeamName: string | null;
  sponsorIdentity: Awaited<ReturnType<typeof getActiveTeamSponsorIdentity>>;
}) {
  const content = (
    <>
      <TeamJerseyPreview
        amateurJersey={amateurJersey}
        amateurTeamName={amateurTeamName}
        sponsor={sponsorIdentity?.sponsor ?? null}
        sponsorJersey={sponsorIdentity?.selectedJersey ?? null}
        className="h-28 w-24 shrink-0 drop-shadow-xl"
      />
      <span className="min-w-0">
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
          Équipe actuelle
        </span>
        <span className="mt-2 block text-lg font-black text-white">
          {team?.displayName ?? "Agent libre"}
        </span>
        {sponsorIdentity ? (
          <span className="mt-2 flex items-center gap-2">
            <SponsorLogoMark
              src={sponsorIdentity.sponsor.logoPath}
              alt={`Logo de ${sponsorIdentity.sponsor.name}`}
              sponsorName={sponsorIdentity.sponsor.name}
              primaryColor={sponsorIdentity.sponsor.colors.primary}
              backgroundColor={sponsorIdentity.sponsor.colors.background}
              textColor={sponsorIdentity.sponsor.colors.text}
              className="h-8 w-12 rounded-lg p-1"
            />
            <span className="text-xs font-semibold text-[#BFD1C6]">
              {sponsorIdentity.sponsor.name}
            </span>
          </span>
        ) : (
          <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">
            {team ? "Structure amateur" : "Maillot neutre"}
          </span>
        )}
      </span>
    </>
  );

  return team ? (
    <Link
      href={`/jeu/equipes/${team.id}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
    >
      {content}
      <span className="ml-auto self-start text-sm font-black text-[#9BE0BC]" aria-hidden="true">
        ↗
      </span>
    </Link>
  ) : (
    <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4">
      <AmateurTeamJersey
        jersey={FREE_AGENT_JERSEY}
        teamName="Agent libre"
        className="h-28 w-24 shrink-0 opacity-80 drop-shadow-xl"
      />
      <span>
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#9BE0BC]">
          Équipe actuelle
        </span>
        <span className="mt-2 block text-lg font-black">Agent libre</span>
        <span className="mt-1 block text-xs font-semibold text-[#BFD1C6]">Maillot neutre</span>
      </span>
    </div>
  );
}

function CareerHistory({
  history,
}: {
  history: Array<{
    seasonId: string;
    seasonName: string;
    gameYear: number;
    teamId: string;
    teamName: string;
    victories: number | null;
    points: number | null;
    uciRank: number | null;
  }>;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
          Carrière
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#183F37]">
          Historique des clubs
        </h2>
      </div>

      {history.length > 0 ? (
        <div className="overflow-x-auto border-t border-[#315B3E]/10">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-[#F3F8F5] text-xs font-extrabold uppercase tracking-[0.12em] text-[#60756E]">
              <tr>
                <th className="px-6 py-4">Saison</th>
                <th className="px-5 py-4">Équipe</th>
                <th className="px-4 py-4 text-center">Victoires</th>
                <th className="px-4 py-4 text-center">Points</th>
                <th className="px-6 py-4 text-center">Classement UCI</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr
                  key={`${entry.seasonId}-${entry.teamId}`}
                  className="border-t border-[#315B3E]/10 text-sm"
                >
                  <td className="px-6 py-4 font-black text-[#183F37]">
                    {entry.seasonName}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/jeu/equipes/${entry.teamId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-black text-[#176951] underline decoration-[#176951]/25 underline-offset-4 transition hover:text-[#278B70]"
                    >
                      {entry.teamName} <span aria-hidden="true">↗</span>
                    </Link>
                  </td>
                  <HistoryValue value={entry.victories} />
                  <HistoryValue value={entry.points} />
                  <HistoryValue value={entry.uciRank} prefix="#" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-t border-[#315B3E]/10 px-6 pb-6 sm:px-8">
          <EmptyBlock message="Aucune saison en club n’est encore enregistrée." />
        </div>
      )}
    </section>
  );
}

function HistoryValue({ value, prefix = "" }: { value: number | null; prefix?: string }) {
  return (
    <td className="px-4 py-4 text-center font-black text-[#48665F]">
      {value === null ? "—" : `${prefix}${value}`}
    </td>
  );
}

function PrivateContractCard({
  contract,
}: {
  contract: NonNullable<Awaited<ReturnType<typeof getPublicRiderProfile>>>["privateContract"] & {};
}) {
  if (!contract) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-[#D6A93D]/30 bg-[#FFF8DD] p-6 shadow-[0_16px_45px_rgba(111,82,13,0.08)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8A6B16]">
            Données privées
          </p>
          <h2 className="mt-2 text-xl font-black text-[#3F3518]">Contrat</h2>
        </div>
        <span className="rounded-full bg-[#F2C94C]/30 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#6E5715]">
          Votre coureur
        </span>
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine
          label="Salaire annuel"
          value={formatMoney(contract.salaryPerSeason, contract.currencyCode)}
        />
        <ContractLine label="Début" value={contract.startSeasonName} />
        <ContractLine label="Échéance" value={contract.endSeasonName} />
        <ContractLine label="Statut" value="Actif" />
      </dl>

      <div className="mt-6 grid gap-2">
        <FutureActionButton label="Renouveler le contrat" />
        <FutureActionButton label="Organiser un stage" />
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-5 text-[#7E7043]">
        Ces interactions seront activées avec les mécaniques de contrats et d’entraînement.
      </p>
    </section>
  );
}

function CareerSummaryCard({
  teamName,
  seasonsCount,
}: {
  teamName: string;
  seasonsCount: number;
}) {
  return (
    <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-7">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        En bref
      </p>
      <h2 className="mt-2 text-xl font-black text-[#183F37]">Situation sportive</h2>
      <dl className="mt-5 space-y-3 text-sm">
        <ContractLine label="Équipe actuelle" value={teamName} />
        <ContractLine
          label="Saisons en club"
          value={`${seasonsCount} saison${seasonsCount > 1 ? "s" : ""}`}
        />
      </dl>
      <p className="mt-5 rounded-xl border border-[#315B3E]/10 bg-[#F3F8F5] px-4 py-3 text-xs font-semibold leading-5 text-[#60756E]">
        Les informations contractuelles sont réservées au Directeur Sportif de l’équipe actuelle.
      </p>
    </section>
  );
}

function LockedTrainingCard() {
  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF5F3] text-lg" aria-hidden="true">
          🔒
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
            Compte rendu
          </p>
          <h2 className="mt-1 font-black text-[#183F37]">Entraînement</h2>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
        Cet espace sera réservé à l’entraîneur lorsque ce rôle et ses séances seront disponibles.
      </p>
    </section>
  );
}

function SpecialAbilitiesCard() {
  return (
    <section className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]">
        Capacités spéciales
      </p>
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((slot) => (
          <span
            key={slot}
            aria-label="Emplacement de capacité vide"
            className="grid h-11 w-11 place-items-center rounded-xl border border-dashed border-[#315B3E]/25 bg-[#F3F8F5] text-lg font-black text-[#9BAEA7]"
          >
            ·
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-[#60756E]">
        Aucune capacité débloquée.
      </p>
    </section>
  );
}

function ContractLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-current/10 pb-3 last:border-none last:pb-0">
      <dt className="font-semibold opacity-65">{label}</dt>
      <dd className="text-right font-black">{value}</dd>
    </div>
  );
}

function FutureActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="min-h-11 rounded-xl border border-[#8A6B16]/20 bg-white/60 px-4 text-sm font-black text-[#7E7043] opacity-65 disabled:cursor-not-allowed"
    >
      {label} · bientôt
    </button>
  );
}

function IdentityBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black">
      {children}
    </span>
  );
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  return (
    <span
      className={`fi fi-${code.toLowerCase()} shrink-0 rounded-sm`}
      role="img"
      aria-label={`Drapeau : ${name}`}
    />
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <p className="mt-5 rounded-xl border border-dashed border-[#315B3E]/25 bg-[#F3F8F5] px-5 py-5 text-sm font-semibold leading-6 text-[#60756E]">
      {message}
    </p>
  );
}

function formatMoney(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
}
