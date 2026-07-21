import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { HealthCenterSubmitButton } from "@/components/game/health-center-submit-button";
import { RiderAvatar } from "@/components/game/rider-avatar";
import {
  FORM_CAMP_TYPES,
  getProtocolRecoveryReductionHours,
  type FormCampType,
} from "@/lib/game/health-center";
import { getPhysiotherapistRiderCapacity } from "@/lib/game/staff";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";
import {
  getCurrentTeamHealthOverview,
  type TeamHealthOverview,
  type TeamHealthRider,
} from "@/services/team-health";
import {
  applyInjuryProtocolAction,
  assignPhysiotherapistAction,
  bookFormCampAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Centre de soin",
  description:
    "Gérez les blessures, la convalescence et la forme de vos coureurs.",
};

const HEALTH_TABS = [
  { code: "blessures", label: "Blessures" },
  { code: "forme", label: "Forme" },
  { code: "nutrition", label: "Nutrition" },
  { code: "staff", label: "Staff médical" },
] as const;

type HealthTab = (typeof HEALTH_TABS)[number]["code"];

type HealthCenterPageProps = {
  searchParams: Promise<{
    onglet?: string | string[];
    soin?: string | string[];
    stage?: string | string[];
    affectation?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function HealthCenterPage({
  searchParams,
}: HealthCenterPageProps) {
  const query = await searchParams;
  const requestedTab = readQuery(query.onglet);
  const activeTab = isHealthTab(requestedTab) ? requestedTab : "blessures";
  const errorMessage = readQuery(query.erreur);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  await supabase.rpc("settle_current_team_finances");
  const [headerData, overview, amateurIdentity] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamHealthOverview(user.id),
    getTeamAmateurIdentityForAuthUser(user.id),
  ]);

  if (!overview) redirect("/jeu");

  const sponsorIdentity = headerData.teamSponsorIdentity;
  const jersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;
  const injuredCount = overview.riders.filter((rider) => rider.injury).length;
  const campCount = overview.riders.filter((rider) => rider.formCamp).length;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={sponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau du DS
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[42px] border-white/5"
          />
          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Santé · récupération · disponibilité
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
                Centre de soin
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Soignez les blessures de {overview.teamName}, programmez les
                remises en forme et anticipez chaque indisponibilité dans une
                saison de 28 jours.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroMetric label="Jour" value={`J${overview.currentDayNumber}`} />
              <HeroMetric label="Blessés" value={String(injuredCount)} alert={injuredCount > 0} />
              <HeroMetric label="En stage" value={String(campCount)} />
              <HeroMetric
                label="Trésorerie"
                value={formatCurrency(overview.balance, overview.currency)}
              />
            </div>
          </div>
        </header>

        {readQuery(query.soin) === "confirme" ? (
          <SuccessMessage>
            Le protocole médical est appliqué et la nouvelle date de reprise est enregistrée.
          </SuccessMessage>
        ) : null}
        {readQuery(query.stage) === "confirme" ? (
          <SuccessMessage>
            Le stage commence demain. Le coureur est désormais indisponible sur toute sa durée.
          </SuccessMessage>
        ) : null}
        {readQuery(query.affectation) === "confirmee" ? (
          <SuccessMessage>
            L’affectation du kiné est enregistrée. Son bonus protégera ces coureurs dès leur prochaine course.
          </SuccessMessage>
        ) : null}
        {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

        <nav
          aria-label="Rubriques du centre de soin"
          className="mt-7 grid gap-3 rounded-[2rem] border border-[#315B3E]/12 bg-white p-3 shadow-[0_12px_36px_rgba(19,60,46,0.07)] sm:grid-cols-4"
        >
          {HEALTH_TABS.map((tab) => (
            <Link
              key={tab.code}
              href={`/jeu/centre-de-soin?onglet=${tab.code}`}
              aria-current={activeTab === tab.code ? "page" : undefined}
              className={
                activeTab === tab.code
                  ? "rounded-2xl bg-[#0B302B] px-4 py-4 text-center text-sm font-black text-white shadow-lg"
                  : "rounded-2xl px-4 py-4 text-center text-sm font-black text-[#48665F] transition hover:bg-[#EAF5F3] hover:text-[#176951]"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {activeTab === "blessures" ? (
          <InjuriesPanel overview={overview} jersey={jersey} />
        ) : null}
        {activeTab === "forme" ? (
          <FormPanel overview={overview} jersey={jersey} />
        ) : null}
        {activeTab === "nutrition" ? <NutritionPanel /> : null}
        {activeTab === "staff" ? (
          <MedicalStaffPanel overview={overview} />
        ) : null}
      </section>
    </main>
  );
}

function InjuriesPanel({
  overview,
  jersey,
}: {
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  const injuredRiders = overview.riders.filter(
    (rider): rider is TeamHealthRider & { injury: NonNullable<TeamHealthRider["injury"]> } =>
      rider.injury !== null
  );

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Gestion des blessures"
        title="Infirmerie et convalescences"
        detail="Une blessure bloque automatiquement les inscriptions. Chaque tranche complète de 24 heures retire les points de forme prévus par le protocole."
      />

      {injuredRiders.length === 0 ? (
        <div className="mt-5 rounded-[2rem] border border-[#42B99A]/20 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(19,60,46,0.07)]">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#DDF3E7] text-[#176951]">
            <MedicalCrossIcon className="h-8 w-8" />
          </span>
          <h3 className="mt-5 text-2xl font-black text-[#183F37]">
            Infirmerie vide
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Aucun coureur n’est actuellement blessé. Les diagnostics issus des
            courses apparaîtront ici immédiatement.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {injuredRiders.map((rider) => (
            <InjuryCard
              key={rider.injury.id}
              rider={rider}
              overview={overview}
              jersey={jersey}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function InjuryCard({
  rider,
  overview,
  jersey,
}: {
  rider: TeamHealthRider & {
    injury: NonNullable<TeamHealthRider["injury"]>;
  };
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  const remaining = getRemainingDuration(rider.injury.expectedRecoveryAt);
  const treatment = rider.injury.treatment;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#D75D5D]/20 bg-white shadow-[0_18px_50px_rgba(88,34,34,0.08)]">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(460px,1.45fr)] lg:p-8">
        <div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <RiderAvatar
                profileKey={rider.avatarProfileKey}
                seed={rider.avatarSeed}
                riderId={rider.id}
                age={rider.age}
                jersey={jersey}
                label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                className="h-20 w-20"
              />
              <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#D94F4F] text-white shadow-lg">
                <MedicalCrossIcon className="h-4 w-4" />
              </span>
            </div>
            <div className="min-w-0">
              <Link
                href={`/jeu/coureurs/${rider.id}`}
                target="_blank"
                className="text-xl font-black text-[#183F37] hover:text-[#176951]"
              >
                {rider.firstName} {rider.lastName} ↗
              </Link>
              <p className="mt-1 text-sm font-bold text-[#60756E]">
                Forme {rider.form}/100 · perte −{rider.injury.formLossPerDay}/jour
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#D75D5D]/20 bg-[#FFF3F1] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#B54242]">
              Diagnostic
            </p>
            <h3 className="mt-2 text-2xl font-black text-[#702E2E]">
              {rider.injury.label}
            </h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MedicalMetric label="Temps restant" value={remaining.label} />
              <MedicalMetric
                label="Reprise prévue"
                value={formatDateTime(rider.injury.expectedRecoveryAt)}
              />
            </dl>
          </div>

          {rider.injury.doctorRecoveryHoursReduced > 0 ? (
            <p className="mt-4 rounded-xl bg-[#E8F0FF] px-4 py-3 text-sm font-bold text-[#315A8A]">
              Médecin de l’équipe · {rider.injury.doctorRecoveryHoursReduced} h de convalescence évitées dès le diagnostic
            </p>
          ) : null}

          {treatment ? (
            <p className="mt-4 rounded-xl bg-[#DDF3E7] px-4 py-3 text-sm font-bold text-[#176951]">
              Protocole appliqué · {getProtocolName(overview, treatment.protocolCode)}
              {treatment.recoveryHoursReduced > 0
                ? ` · ${treatment.recoveryHoursReduced} h gagnées`
                : ""}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Protocoles disponibles
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
            Un seul protocole peut être appliqué par blessure, tant qu’il reste au moins 24 heures de convalescence.
          </p>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {overview.protocols.map((protocol) => {
              const reductionHours = getProtocolRecoveryReductionHours({
                recoveryHours: rider.injury.recoveryHours,
                durationReductionPct: protocol.durationReductionPct,
              });
              const disabled =
                Boolean(treatment) ||
                remaining.hours < 24 ||
                overview.balance < protocol.price;

              return (
                <form
                  key={protocol.code}
                  action={applyInjuryProtocolAction}
                  className="flex flex-col rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-4"
                >
                  <input type="hidden" name="injuryId" value={rider.injury.id} />
                  <input type="hidden" name="protocolCode" value={protocol.code} />
                  <h4 className="font-black text-[#183F37]">{protocol.name}</h4>
                  <p className="mt-2 flex-1 text-xs font-semibold leading-5 text-[#60756E]">
                    {protocol.description}
                  </p>
                  <p className="mt-3 text-xs font-black text-[#176951]">
                    {reductionHours > 0 ? `${reductionHours} h gagnées · ` : ""}
                    {formatCurrency(protocol.price, overview.currency)}
                  </p>
                  <div className="mt-4">
                    <HealthCenterSubmitButton
                      pendingLabel="Application…"
                      disabled={disabled}
                      tone="green"
                    >
                      Appliquer
                    </HealthCenterSubmitButton>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function FormPanel({
  overview,
  jersey,
}: {
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Gestion de la forme"
        title="Repos naturel et stages ciblés"
        detail="Sans course, blessure ou stage, un coureur récupère automatiquement 2 points par jour. Un stage commence toujours le lendemain et dure de un à trois jours."
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {overview.riders.map((rider) => (
          <FormRiderCard
            key={rider.id}
            rider={rider}
            overview={overview}
            jersey={jersey}
          />
        ))}
      </div>
    </section>
  );
}

function FormRiderCard({
  rider,
  overview,
  jersey,
}: {
  rider: TeamHealthRider;
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  const unavailable = Boolean(rider.injury || rider.formCamp);
  const cannotSchedule = unavailable || rider.form >= 100 || overview.currentDayNumber >= 28;

  return (
    <article className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_40px_rgba(19,60,46,0.07)] sm:p-6">
      <div className="flex items-center gap-4">
        <RiderAvatar
          profileKey={rider.avatarProfileKey}
          seed={rider.avatarSeed}
          riderId={rider.id}
          age={rider.age}
          jersey={jersey}
          label={`Portrait de ${rider.firstName} ${rider.lastName}`}
          className="h-16 w-16"
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/jeu/coureurs/${rider.id}`}
            target="_blank"
            className="truncate text-lg font-black text-[#183F37] hover:text-[#176951]"
          >
            {rider.firstName} {rider.lastName} ↗
          </Link>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#DCE8E3]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#D6A93A,#42B99A)]"
              style={{ width: `${rider.form}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-black text-[#48665F]">
            Forme {rider.form}/100
          </p>
        </div>
      </div>

      {rider.injury ? (
        <AvailabilityNotice tone="danger">
          {rider.injury.label} · retour le {formatDateTime(rider.injury.expectedRecoveryAt)}
        </AvailabilityNotice>
      ) : rider.formCamp ? (
        <AvailabilityNotice tone="warning">
          {rider.formCamp.label} · J{rider.formCamp.startDay}–J{rider.formCamp.endDay} · +{rider.formCamp.formGainPerDay}/jour
        </AvailabilityNotice>
      ) : (
        <AvailabilityNotice tone="success">
          Disponible · récupération naturelle de +2 lors d’une journée libre
        </AvailabilityNotice>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(Object.keys(FORM_CAMP_TYPES) as FormCampType[]).map((type) => {
          const camp = FORM_CAMP_TYPES[type];
          return (
            <form
              key={type}
              action={bookFormCampAction}
              className="rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF8] p-4"
            >
              <input type="hidden" name="riderId" value={rider.id} />
              <input type="hidden" name="campType" value={type} />
              <p className="font-black text-[#183F37]">{camp.label}</p>
              <p className="mt-1 text-xs font-bold text-[#278B70]">
                +{camp.formGainPerDay} forme/jour · {formatCurrency(camp.pricePerDay, overview.currency)}/jour
              </p>
              <label className="mt-3 block text-[10px] font-black uppercase tracking-wider text-[#60756E]">
                Durée
                <select
                  name="durationDays"
                  defaultValue="1"
                  disabled={cannotSchedule}
                  className="mt-1 min-h-10 w-full rounded-xl border border-[#315B3E]/20 bg-white px-3 text-sm font-black text-[#183F37] outline-none focus:border-[#278B70]"
                >
                  <option value="1">1 jour</option>
                  <option value="2">2 jours</option>
                  <option value="3">3 jours</option>
                </select>
              </label>
              <div className="mt-3">
                <HealthCenterSubmitButton
                  pendingLabel="Planification…"
                  disabled={cannotSchedule || overview.balance < camp.pricePerDay}
                >
                  Programmer
                </HealthCenterSubmitButton>
              </div>
            </form>
          );
        })}
      </div>
    </article>
  );
}

function NutritionPanel() {
  return (
    <FuturePanel
      eyebrow="Nutrition"
      title="Actions ponctuelles sur la forme"
      description="Les recharges énergétiques et plans de récupération seront débloqués avec le recrutement des nutritionnistes. Chaque action sera payante et limitée à une intervention par coureur et par jour."
      items={[
        "Recharge glucidique avant un objectif",
        "Plan de récupération après une course",
        "Capacité et efficacité liées au niveau du nutritionniste",
      ]}
    />
  );
}

function MedicalStaffPanel({ overview }: { overview: TeamHealthOverview }) {
  const doctors = overview.medicalStaff.filter(
    (member) => member.role === "doctor",
  );
  const physiotherapists = overview.medicalStaff.filter(
    (member) => member.role === "physiotherapist",
  );

  return (
    <section className="mt-7">
      <SectionHeading
        eyebrow="Staff médical"
        title="Une récupération pilotée par vos spécialistes"
        detail="Le médecin agit automatiquement sur chaque nouveau diagnostic. Les kinés protègent uniquement les coureurs que vous leur confiez."
      />

      {doctors.length === 0 && physiotherapists.length === 0 ? (
        <div className="mt-5 rounded-[2rem] border border-[#315B3E]/12 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(19,60,46,0.07)]">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#DDF3E7] text-[#176951]">
            <MedicalCrossIcon className="h-8 w-8" />
          </span>
          <h3 className="mt-5 text-2xl font-black text-[#183F37]">
            Aucun spécialiste médical recruté
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Recrutez un médecin ou un kiné sur le marché du staff pour activer leurs effets.
          </p>
          <Link
            href="/jeu/staff"
            className="mt-5 inline-flex rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0B302B]"
          >
            Ouvrir le marché du staff
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-xl font-black text-[#183F37]">Médecins</h3>
            {doctors.length > 0 ? (
              doctors.map((doctor) => (
                <article
                  key={doctor.contractId}
                  className="rounded-[2rem] border border-[#D75D5D]/18 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-[#183F37]">
                        {doctor.firstName} {doctor.lastName}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#D6655A]">
                        Médecin · niveau {doctor.level}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#FFF0EE] px-3 py-2 text-xs font-black text-[#A63D3D]">
                      −{doctor.level * 6} %
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
                    Toute nouvelle blessure est raccourcie automatiquement de {doctor.level * 6} % de sa durée initiale. Le meilleur médecin actif fait référence.
                  </p>
                </article>
              ))
            ) : (
              <MedicalStaffEmpty label="Aucun médecin dans l’équipe." />
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black text-[#183F37]">Kinés</h3>
            {physiotherapists.length > 0 ? (
              physiotherapists.map((physio) => {
                const capacity = getPhysiotherapistRiderCapacity(physio.level);
                return (
                  <form
                    key={physio.contractId}
                    action={assignPhysiotherapistAction}
                    className="rounded-[2rem] border border-[#8B6FB6]/20 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
                  >
                    <input
                      type="hidden"
                      name="staffContractId"
                      value={physio.contractId}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-[#183F37]">
                          {physio.firstName} {physio.lastName}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#7856A4]">
                          Kiné · niveau {physio.level}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1EAF9] px-3 py-2 text-xs font-black text-[#684390]">
                        {physio.assignedRiderIds.length}/{capacity}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
                      Chaque coureur suivi perd {physio.level} point{physio.level > 1 ? "s" : ""} de forme en moins après une course, avec un minimum de 1 point de malus.
                    </p>
                    <fieldset className="mt-5 grid gap-2 sm:grid-cols-2">
                      <legend className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#60756E]">
                        Coureurs suivis · {capacity} maximum
                      </legend>
                      {overview.riders.map((rider) => (
                        <label
                          key={rider.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#315B3E]/10 bg-[#F7FAF8] px-3 py-3 text-sm font-bold text-[#183F37]"
                        >
                          <input
                            type="checkbox"
                            name="riderIds"
                            value={rider.id}
                            defaultChecked={physio.assignedRiderIds.includes(rider.id)}
                            className="h-4 w-4 accent-[#7856A4]"
                          />
                          <span className="min-w-0 truncate">
                            {rider.firstName} {rider.lastName}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="mt-5">
                      <HealthCenterSubmitButton pendingLabel="Enregistrement…">
                        Enregistrer les affectations
                      </HealthCenterSubmitButton>
                    </div>
                  </form>
                );
              })
            ) : (
              <MedicalStaffEmpty label="Aucun kiné dans l’équipe." />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MedicalStaffEmpty({ label }: { label: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-white px-5 py-8 text-center text-sm font-bold text-[#60756E]">
      {label}
    </p>
  );
}

function FuturePanel({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
      <div className="grid gap-8 p-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:p-10">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            {eyebrow} · prochaine évolution
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#183F37]">{title}</h2>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#60756E]">
            {description}
          </p>
          <span className="mt-6 inline-flex rounded-full bg-[#F2C94C]/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#755A0B]">
            En attente du module Staff
          </span>
        </div>
        <ul className="space-y-3 rounded-2xl bg-[#0B302B] p-6 text-white">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-sm font-semibold leading-6 text-[#D6DFD2]">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#F2C94C]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <header>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-black text-[#183F37]">{title}</h2>
      <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-[#60756E]">
        {detail}
      </p>
    </header>
  );
}

function HeroMetric({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="min-w-28 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9BE0BC]">
        {label}
      </p>
      <p className={`mt-1 text-lg font-black ${alert ? "text-[#FF9EA6]" : "text-[#F2C94C]"}`}>
        {value}
      </p>
    </div>
  );
}

function MedicalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wider text-[#9D6767]">
        {label}
      </dt>
      <dd className="mt-1 font-black text-[#702E2E]">{value}</dd>
    </div>
  );
}

function AvailabilityNotice({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "danger";
}) {
  const classes = {
    success: "border-[#42B99A]/20 bg-[#DDF3E7] text-[#176951]",
    warning: "border-[#D29F32]/20 bg-[#FFF6D8] text-[#755A0B]",
    danger: "border-[#D75D5D]/20 bg-[#FFF0EE] text-[#8A2F2F]",
  }[tone];
  return (
    <p className={`mt-4 rounded-xl border px-4 py-3 text-xs font-black ${classes}`}>
      {children}
    </p>
  );
}

function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 rounded-2xl border border-[#42B99A]/25 bg-[#DFF5EA] px-5 py-4 text-sm font-bold text-[#176951]">
      {children}
    </p>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mt-5 rounded-2xl border border-[#C94F4F]/25 bg-[#FFF0EE] px-5 py-4 text-sm font-bold text-[#8A2F2F]">
      {message.slice(0, 300)}
    </p>
  );
}

function MedicalCrossIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="currentColor">
      <path d="M7.5 2.5h5v5h5v5h-5v5h-5v-5h-5v-5h5v-5Z" />
    </svg>
  );
}

function getRemainingDuration(value: string) {
  const hours = Math.max(
    0,
    Math.ceil((new Date(value).getTime() - Date.now()) / 3_600_000)
  );
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return {
    hours,
    label:
      days > 0
        ? `${days} j ${remainingHours} h`
        : `${remainingHours} h`,
  };
}

function getProtocolName(overview: TeamHealthOverview, code: string) {
  return overview.protocols.find((protocol) => protocol.code === code)?.name ?? code;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isHealthTab(value: string): value is HealthTab {
  return HEALTH_TABS.some((tab) => tab.code === value);
}
