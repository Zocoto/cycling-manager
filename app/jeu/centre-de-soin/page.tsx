import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { FormCampPlanner } from "@/components/game/form-camp-planner";
import { GameHeader } from "@/components/game/game-header";
import {
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";
import { HealthCenterSubmitButton } from "@/components/game/health-center-submit-button";
import { PhysiotherapistAssignmentMatrix } from "@/components/game/physiotherapist-assignment-matrix";
import {
  NutritionInterventionFields,
  NutritionInterventionsEditor,
} from "@/components/game/nutrition-interventions-editor";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import {
  NUTRITION_INTERVENTIONS,
  getDoctorFormCampBoostPct,
  getNutritionInterventionOutcome,
  getProtocolRecoveryReductionHours,
  type NutritionInterventionCode,
} from "@/lib/game/health-center";
import { getHealthCenterErrorMessage } from "@/lib/game/health-center-errors";
import type { TeamRiderSeasonPlanning } from "@/lib/game/rider-season-planning";
import {
  getNutritionistDailyCapacity,
  getPhysiotherapistRiderCapacity,
} from "@/lib/game/staff";
import {
  createAmateurRiderJersey,
  createSponsoredRiderJersey,
  FREE_AGENT_RIDER_JERSEY,
} from "@/lib/rider-jersey";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MEDICAL_CENTER_TUTORIAL_KEY,
  MEDICAL_CENTER_TUTORIAL_ROUTES,
} from "@/lib/tutorial/medical-center";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamRiderSeasonPlanning } from "@/services/rider-season-planning";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";
import {
  getCurrentTeamHealthOverview,
  type TeamHealthOverview,
  type TeamHealthRider,
  type TeamMedicalStaffMember,
} from "@/services/team-health";
import { applyInjuryProtocolAction } from "./actions";

export const metadata: Metadata = {
  title: "Centre de soin",
  description:
    "Gérez les blessures, la convalescence et la forme de vos coureurs.",
};

export const maxDuration = 300;

const HEALTH_TABS = [
  {
    code: "blessures",
    label: "Blessures",
    description: "Protocoles et reprises",
  },
  { code: "forme", label: "Forme", description: "Suivi et stages" },
  {
    code: "nutrition",
    label: "Nutrition",
    description: "Compléments et récupération",
  },
  {
    code: "kines",
    label: "Kinés",
    description: "Affectations individuelles",
  },
  {
    code: "staff",
    label: "Équipe médicale",
    description: "Médecins et spécialistes",
  },
] as const;

type HealthTab = (typeof HEALTH_TABS)[number]["code"];

const HEALTH_TUTORIAL_ROUTES: Record<HealthTab, string> = {
  blessures: MEDICAL_CENTER_TUTORIAL_ROUTES.injuries,
  forme: MEDICAL_CENTER_TUTORIAL_ROUTES.form,
  nutrition: MEDICAL_CENTER_TUTORIAL_ROUTES.nutrition,
  kines: MEDICAL_CENTER_TUTORIAL_ROUTES.physiotherapists,
  staff: MEDICAL_CENTER_TUTORIAL_ROUTES.staff,
};

type HealthCenterPageProps = {
  searchParams: Promise<{
    onglet?: string | string[];
    soin?: string | string[];
    stage?: string | string[];
    affectation?: string | string[];
    nutrition?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function HealthCenterPage({
  searchParams,
}: HealthCenterPageProps) {
  const query = await searchParams;
  const requestedTab = readQuery(query.onglet);
  const activeTab = isHealthTab(requestedTab) ? requestedTab : "blessures";
  const rawErrorMessage = readQuery(query.erreur);
  const errorMessage = rawErrorMessage
    ? getHealthCenterErrorMessage(rawErrorMessage)
    : "";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  await supabase.rpc("settle_current_team_finances");
  const [
    headerData,
    overview,
    amateurIdentity,
    medicalCenterTutorialProgress,
    riderPlanning,
  ] =
    await Promise.all([
      getGameHeaderData(supabase, user.id),
      getCurrentTeamHealthOverview(user.id),
      getTeamAmateurIdentityForAuthUser(user.id),
      getAuthenticatedTutorialProgress(
        supabase,
        MEDICAL_CENTER_TUTORIAL_KEY,
      ).catch((error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel du centre de soins :",
          error,
        );
        return null;
      }),
      activeTab === "forme"
        ? getCurrentTeamRiderSeasonPlanning({ authUserId: user.id })
        : Promise.resolve(null),
    ]);

  if (!overview) redirect("/jeu");

  const sponsorIdentity = headerData.teamSponsorIdentity;
  const jersey = sponsorIdentity
    ? createSponsoredRiderJersey({
        colors: sponsorIdentity.sponsor.colors,
        style: sponsorIdentity.selectedJersey.style,
        imagePath: sponsorIdentity.selectedJersey.imagePath,
      })
    : amateurIdentity
      ? createAmateurRiderJersey(amateurIdentity.jersey)
      : FREE_AGENT_RIDER_JERSEY;
  const injuredCount = overview.riders.filter((rider) => rider.injury).length;
  const campCount = overview.riders.filter((rider) => rider.formCamp).length;
  const currentMedicalCenterTutorialRoute = HEALTH_TUTORIAL_ROUTES[activeTab];

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {medicalCenterTutorialProgress?.status === "in_progress" &&
      medicalCenterTutorialProgress.current_route ===
        currentMedicalCenterTutorialRoute &&
      medicalCenterTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={MEDICAL_CENTER_TUTORIAL_KEY}
          currentStepKey={medicalCenterTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={sponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <BackToOfficeLink />
          <TutorialLaunchButton
            tutorialKey={MEDICAL_CENTER_TUTORIAL_KEY}
            iconOnly
          />
        </div>

        <header
          data-tutorial-id="medical-center-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
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
            Les stages sont programmés sur la plage choisie. Les coureurs sont
            désormais indisponibles sur toute leur durée.
          </SuccessMessage>
        ) : null}
        {readQuery(query.affectation) === "confirmee" ? (
          <SuccessMessage>
            Les affectations des kinés sont enregistrées. Leurs bonus
            protégeront les coureurs suivis dès leur prochain effort.
          </SuccessMessage>
        ) : null}
        {readQuery(query.nutrition) === "confirmee" ? (
          <SuccessMessage>
            Les compléments sont enregistrés : la forme des coureurs et la trésorerie ont été mises à jour en une seule fois.
          </SuccessMessage>
        ) : null}
        {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

        <GameSectionTabs
          ariaLabel="Rubriques du centre de soin"
          columns={5}
          className="mt-7"
        >
          {HEALTH_TABS.map((tab) => (
            <GameSectionTabLink
              key={tab.code}
              href={`/jeu/centre-de-soin?onglet=${tab.code}`}
              active={activeTab === tab.code}
              label={tab.label}
              description={tab.description}
            />
          ))}
        </GameSectionTabs>

        {activeTab === "blessures" ? (
          <InjuriesPanel overview={overview} jersey={jersey} />
        ) : null}
        {activeTab === "forme" ? (
          riderPlanning ? (
            <FormPanel overview={overview} planning={riderPlanning} />
          ) : null
        ) : null}
        {activeTab === "nutrition" ? (
          <NutritionPanel overview={overview} jersey={jersey} />
        ) : null}
        {activeTab === "kines" ? (
          <PhysiotherapistsPanel overview={overview} jersey={jersey} />
        ) : null}
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
    <section data-tutorial-id="medical-center-injuries" className="mt-7">
      <SectionHeading
        eyebrow="Gestion des blessures"
        title="Infirmerie et convalescences"
        detail="Une blessure bloque automatiquement les inscriptions. Chaque tranche complète de 24 heures retire les points de forme prévus par le protocole."
      />

      <MedicalProtocolCatalog overview={overview} />

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

function MedicalProtocolCatalog({
  overview,
}: {
  overview: TeamHealthOverview;
}) {
  return (
    <section
      data-tutorial-id="medical-center-protocols"
      className="mt-5 rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_14px_40px_rgba(19,60,46,0.06)] sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#278B70]">
            Catalogue permanent
          </p>
          <h3 className="mt-1 text-xl font-black text-[#183F37]">
            Protocoles disponibles
          </h3>
        </div>
        <p className="max-w-2xl text-xs font-semibold leading-5 text-[#60756E]">
          Le gain exact est recalculé selon la blessure. Un protocole ne peut
          être appliqué qu’une fois et lorsqu’il reste au moins 24 h de soins.
        </p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {overview.protocols.map((protocol) => (
          <article
            key={protocol.code}
            className="rounded-2xl border border-[#315B3E]/10 bg-[#F7FAF8] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-black text-[#183F37]">{protocol.name}</h4>
              <span className="shrink-0 rounded-full bg-[#DDF3E7] px-2.5 py-1 text-[10px] font-black text-[#176951]">
                {formatCurrency(protocol.price, overview.currency)}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
              {protocol.description}
            </p>
            <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[#278B70]">
              {protocol.durationReductionPct > 0
                ? `−${protocol.durationReductionPct} % de convalescence · `
                : "Durée inchangée · "}
              −{protocol.formLossPerDay} forme/jour
            </p>
          </article>
        ))}
      </div>
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
  const isFatigueInjury =
    rider.injury.diagnosisCode === "fatigue_exhaustion";

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
                {isFatigueInjury
                  ? "Forme bloquée à 0 pendant la convalescence"
                  : `Forme ${rider.form}/100 · perte −${rider.injury.formLossPerDay}/jour`}
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
          {isFatigueInjury ? (
            <div className="rounded-2xl border border-[#D75D5D]/20 bg-[#FFF3F1] p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#B54242]">
                Repos obligatoire
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#702E2E]">
                Cette blessure survient lorsque la forme devait passer sous zéro.
                Sa durée est fixée à trois jours : le médecin et les protocoles ne
                peuvent pas la raccourcir.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
                Protocoles disponibles
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#60756E]">
                Un seul protocole peut être appliqué par blessure, tant qu’il
                reste au moins 24 heures de convalescence.
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
                      <input
                        type="hidden"
                        name="injuryId"
                        value={rider.injury.id}
                      />
                      <input
                        type="hidden"
                        name="protocolCode"
                        value={protocol.code}
                      />
                      <h4 className="font-black text-[#183F37]">
                        {protocol.name}
                      </h4>
                      <p className="mt-2 flex-1 text-xs font-semibold leading-5 text-[#60756E]">
                        {protocol.description}
                      </p>
                      <p className="mt-3 text-xs font-black text-[#176951]">
                        {reductionHours > 0
                          ? `${reductionHours} h gagnées · `
                          : ""}
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
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function FormPanel({
  overview,
  planning,
}: {
  overview: TeamHealthOverview;
  planning: TeamRiderSeasonPlanning;
}) {
  const totalDoctorLevel = overview.medicalStaff
    .filter((member) => member.role === "doctor")
    .reduce((total, doctor) => total + doctor.level, 0);
  const doctorBoostPct = getDoctorFormCampBoostPct(totalDoctorLevel);

  return (
    <section data-tutorial-id="medical-center-form" className="mt-7">
      <SectionHeading
        eyebrow="Gestion de la forme"
        title="Planning et stages de récupération"
        detail="Sans course, blessure ou stage, un coureur récupère automatiquement 2 points par jour. Placez librement un stage de un à trois jours sur le calendrier futur, puis validez tous les coureurs disponibles en une seule fois."
      />

      <div
        role="note"
        className="mt-5 flex items-start gap-3 rounded-2xl border border-[#D6A93A]/30 bg-[#FFF9DF] px-5 py-4 text-[#705B00]"
      >
        <span
          aria-hidden="true"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F2C94C] text-xs font-black text-[#4F4100]"
        >
          !
        </span>
        <p className="text-sm font-semibold leading-6">
          <strong className="font-black">
            Coureur indisponible pendant le stage.
          </strong>{" "}
          Il ne peut pas être engagé en course et ses entraînements sont
          suspendus jusqu’à la fin du stage.
        </p>
      </div>

      <div data-tutorial-id="medical-center-form-camps">
        <FormCampPlanner
          riders={overview.riders.map((rider) => ({
            id: rider.id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            countryName: rider.countryName,
            countryCode: rider.countryCode,
            form: rider.form,
          }))}
          planning={planning}
          balance={overview.balance}
          currency={overview.currency}
          doctorBoostPct={doctorBoostPct}
        />
      </div>
    </section>
  );
}

function NutritionPanel({
  overview,
  jersey,
}: {
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  const nutritionists = overview.medicalStaff
    .filter((member) => member.role === "nutritionist")
    .sort((left, right) => right.level - left.level);
  const usageByContract = new Map<string, number>();
  for (const intervention of overview.nutritionInterventionsToday) {
    usageByContract.set(
      intervention.nutritionistContractId,
      (usageByContract.get(intervention.nutritionistContractId) ?? 0) + 1,
    );
  }
  const availableNutritionist = nutritionists.find(
    (member) =>
      (usageByContract.get(member.contractId) ?? 0) <
      getNutritionistDailyCapacity(member.level),
  );
  const referenceNutritionist = availableNutritionist ?? nutritionists[0];
  const nutritionistOptions = nutritionists.map((nutritionist) => {
    const used = usageByContract.get(nutritionist.contractId) ?? 0;
    const capacity = getNutritionistDailyCapacity(nutritionist.level);

    return {
      contractId: nutritionist.contractId,
      name: `${nutritionist.firstName} ${nutritionist.lastName}`,
      level: nutritionist.level,
      remainingCapacity: Math.max(0, capacity - used),
    };
  });

  return (
    <section data-tutorial-id="medical-center-nutrition" className="mt-7">
      <SectionHeading
        eyebrow="Nutrition"
        title="Récupération quotidienne et interventions ciblées"
        detail="Les niveaux de vos nutritionnistes se cumulent pour renforcer passivement la récupération. Chaque spécialiste peut aussi traiter un nombre limité de coureurs par jour, avec un gain et un tarif liés à son propre niveau."
      />
      <section
        data-tutorial-id="medical-center-nutrition-options"
        className="mt-5 rounded-[2rem] border border-[#78A94E]/20 bg-white p-5 shadow-[0_14px_38px_rgba(19,60,46,0.06)] sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#658F42]">
              Interventions disponibles
            </p>
            <h3 className="mt-1 text-xl font-black text-[#183F37]">
              Compléments et récupération ciblée
            </h3>
          </div>
          <p className="text-xs font-bold text-[#60756E]">
            {referenceNutritionist
              ? `Effets avec ${referenceNutritionist.firstName} ${referenceNutritionist.lastName}`
              : "Aperçu avec un nutritionniste de niveau 1"}
          </p>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {(Object.keys(NUTRITION_INTERVENTIONS) as NutritionInterventionCode[]).map((code) => {
            const intervention = NUTRITION_INTERVENTIONS[code];
            const outcome = getNutritionInterventionOutcome({
              code,
              nutritionistLevel: referenceNutritionist?.level ?? 1,
            });
            return (
              <article
                key={code}
                className="rounded-2xl border border-[#315B3E]/12 bg-[#F7FAF5] p-5"
              >
                <p className="text-sm font-black text-[#183F37]">
                  {intervention.label}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
                  {intervention.description}
                </p>
                <p className="mt-4 text-sm font-black text-[#527633]">
                  +{outcome.formGain} forme · {formatCurrency(outcome.price, overview.currency)}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#809189]">
                  Niveau {intervention.minimumNutritionistLevel} requis
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {nutritionists.length === 0 ? (
        <div className="mt-5 rounded-[2rem] border border-[#78A94E]/20 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(19,60,46,0.07)]">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#EEF7E8] text-3xl" aria-hidden="true">
            ◉
          </span>
          <h3 className="mt-5 text-2xl font-black text-[#183F37]">
            Aucun nutritionniste recruté
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Recrutez un nutritionniste pour débloquer les compléments, la récupération passive et les interventions ponctuelles.
          </p>
          <Link
            href="/jeu/staff"
            className="mt-5 inline-flex rounded-xl bg-[#78A94E] px-5 py-3 text-sm font-black text-white transition hover:bg-[#587E38]"
          >
            Ouvrir le marché du staff
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {nutritionists.map((nutritionist) => {
              const used = usageByContract.get(nutritionist.contractId) ?? 0;
              const capacity = getNutritionistDailyCapacity(nutritionist.level);
              return (
                <article
                  key={nutritionist.contractId}
                  className="rounded-[2rem] border border-[#78A94E]/20 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-[#183F37]">
                        {nutritionist.firstName} {nutritionist.lastName}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#658F42]">
                        Nutritionniste · niveau {nutritionist.level}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EEF7E8] px-3 py-2 text-xs font-black text-[#527633]">
                      {used}/{capacity} aujourd’hui
                    </span>
                  </div>
                  <MedicalStaffBaseSkills
                    rows={getNutritionistBaseSkillRows(nutritionist.level)}
                  />
                  <MedicalStaffAdditionalSkills member={nutritionist} />
                </article>
              );
            })}
          </div>


          <NutritionInterventionsEditor
            riderIds={overview.riders
              .filter(
                (rider) =>
                  !overview.nutritionInterventionsToday.some(
                    (intervention) => intervention.riderId === rider.id,
                  ),
              )
              .map((rider) => rider.id)}
            nutritionists={nutritionistOptions}
            balance={overview.balance}
            currency={overview.currency}
          >
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {overview.riders.map((rider) => {
                const applied = overview.nutritionInterventionsToday.find(
                  (intervention) => intervention.riderId === rider.id,
                );

                return (
                  <article
                    key={rider.id}
                    className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-5 shadow-[0_12px_36px_rgba(19,60,46,0.06)]"
                  >
                    <div className="flex items-center gap-4">
                      <RiderAvatar
                        profileKey={rider.avatarProfileKey}
                        seed={rider.avatarSeed}
                        riderId={rider.id}
                        age={rider.age}
                        jersey={jersey}
                        label={`Portrait de ${rider.firstName} ${rider.lastName}`}
                        className="h-14 w-14"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-[#183F37]">
                          {rider.firstName} {rider.lastName}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#60756E]">
                          Forme actuelle · {rider.form}/100
                        </p>
                      </div>
                      <span className="rounded-full bg-[#EEF7E8] px-3 py-2 text-sm font-black text-[#527633]">
                        {applied ? `+${applied.formGain}` : `${rider.form} %`}
                      </span>
                    </div>

                    {applied ? (
                      <p className="mt-4 rounded-xl bg-[#EEF7E8] px-4 py-3 text-sm font-bold text-[#527633]">
                        {applied.label} appliquée aujourd’hui · {applied.formBefore} → {applied.formAfter} de forme.
                      </p>
                    ) : (
                      <NutritionInterventionFields
                        riderId={rider.id}
                        riderForm={rider.form}
                        currency={overview.currency}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </NutritionInterventionsEditor>
        </>
      )}
    </section>
  );
}

function MedicalStaffPanel({ overview }: { overview: TeamHealthOverview }) {
  const doctors = overview.medicalStaff.filter(
    (member) => member.role === "doctor",
  );
  const nutritionists = overview.medicalStaff.filter(
    (member) => member.role === "nutritionist",
  );
  const physiotherapists = overview.medicalStaff.filter(
    (member) => member.role === "physiotherapist",
  );

  return (
    <section data-tutorial-id="medical-center-staff" className="mt-7">
      <SectionHeading
        eyebrow="Équipe médicale"
        title="Tous les spécialistes médicaux de l’équipe"
        detail="Le médecin raccourcit les nouvelles blessures et renforce les stages de récupération, le nutritionniste soutient la récupération quotidienne et le kiné protège la forme des coureurs qui lui sont affectés."
      />

      {doctors.length === 0 &&
      nutritionists.length === 0 &&
      physiotherapists.length === 0 ? (
        <div className="mt-5 rounded-[2rem] border border-[#315B3E]/12 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(19,60,46,0.07)]">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#DDF3E7] text-[#176951]">
            <MedicalCrossIcon className="h-8 w-8" />
          </span>
          <h3 className="mt-5 text-2xl font-black text-[#183F37]">
            Aucun spécialiste médical recruté
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Recrutez un médecin, un kiné ou un nutritionniste sur le marché du
            staff pour activer leurs effets.
          </p>
          <Link
            href="/jeu/staff"
            className="mt-5 inline-flex rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0B302B]"
          >
            Ouvrir le marché du staff
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-6 xl:grid-cols-3">
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
                  <MedicalStaffBaseSkills
                    rows={[
                      {
                        label: "Traitement des blessures",
                        description: `−${doctor.level * 6} % sur la durée initiale de toute nouvelle blessure`,
                      },
                      {
                        label: "Efficacité des stages de récupération",
                        description: `+${doctor.level * 5} % sur les gains de forme des stages classiques et premium`,
                      },
                    ]}
                  />
                  <MedicalStaffAdditionalSkills member={doctor} />
                </article>
              ))
            ) : (
              <MedicalStaffEmpty label="Aucun médecin dans l’équipe." />
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black text-[#183F37]">
              Nutritionnistes
            </h3>
            {nutritionists.length > 0 ? (
              nutritionists.map((nutritionist) => (
                <article
                  key={nutritionist.contractId}
                  className="rounded-[2rem] border border-[#78A94E]/20 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-[#183F37]">
                        {nutritionist.firstName} {nutritionist.lastName}
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#658F42]">
                        Nutritionniste · niveau {nutritionist.level}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#EEF7E8] px-3 py-2 text-xs font-black text-[#527633]">
                      −{nutritionist.level * 5} %
                    </span>
                  </div>
                  <MedicalStaffBaseSkills
                    rows={getNutritionistBaseSkillRows(nutritionist.level)}
                  />
                  <MedicalStaffAdditionalSkills member={nutritionist} />
                  <Link
                    href="/jeu/centre-de-soin?onglet=nutrition"
                    className="mt-5 inline-flex text-sm font-black text-[#527633] hover:text-[#183F37]"
                  >
                    Ouvrir les interventions →
                  </Link>
                </article>
              ))
            ) : (
              <MedicalStaffEmpty label="Aucun nutritionniste dans l’équipe." />
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black text-[#183F37]">Kinés</h3>
            {physiotherapists.length > 0 ? (
              physiotherapists.map((physiotherapist) => {
                const capacity = getPhysiotherapistRiderCapacity(
                  physiotherapist.level,
                );

                return (
                  <article
                    key={physiotherapist.contractId}
                    className="rounded-[2rem] border border-[#8B6FB6]/20 bg-white p-6 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-[#183F37]">
                          {physiotherapist.firstName} {physiotherapist.lastName}
                        </p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#7856A4]">
                          Kiné · niveau {physiotherapist.level}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1EAF9] px-3 py-2 text-xs font-black text-[#684390]">
                        {physiotherapist.assignedRiderIds.length}/{capacity}
                      </span>
                    </div>
                    <MedicalStaffBaseSkills
                      rows={[
                        {
                          label: "Suivi des coureurs affectés",
                          description: `Jusqu’à ${physiotherapist.level} point${physiotherapist.level > 1 ? "s" : ""} de forme protégé${physiotherapist.level > 1 ? "s" : ""} par effort ou journée de blessure`,
                        },
                      ]}
                    />
                    <MedicalStaffAdditionalSkills member={physiotherapist} />
                    <Link
                      href="/jeu/centre-de-soin?onglet=kines"
                      className="mt-5 inline-flex text-sm font-black text-[#684390] hover:text-[#183F37]"
                    >
                      Gérer les affectations →
                    </Link>
                  </article>
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

function PhysiotherapistsPanel({
  overview,
  jersey,
}: {
  overview: TeamHealthOverview;
  jersey: Parameters<typeof RiderAvatar>[0]["jersey"];
}) {
  const physiotherapists = overview.medicalStaff.filter(
    (member) => member.role === "physiotherapist",
  );

  return (
    <section
      data-tutorial-id="medical-center-physiotherapists"
      className="mt-7"
    >
      <SectionHeading
        eyebrow="Kinés"
        title="Attribuez chaque coureur à son kiné"
        detail="Un coureur ne peut être suivi que par un kiné à la fois. Son niveau détermine sa capacité et le nombre de points de forme protégés en course, à l’entraînement et pendant une blessure."
      />

      {physiotherapists.length > 0 ? (
        <div
          data-tutorial-id="medical-center-physiotherapist-assignments"
        >
          <PhysiotherapistAssignmentMatrix
            riders={overview.riders}
            physiotherapists={physiotherapists}
            jersey={jersey}
          />
        </div>
      ) : (
        <div className="mt-5 rounded-[2rem] border border-[#8B6FB6]/20 bg-white px-6 py-12 text-center shadow-[0_16px_42px_rgba(19,60,46,0.07)]">
          <h3 className="text-2xl font-black text-[#183F37]">
            Aucun kiné dans l’équipe
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-[#60756E]">
            Recrutez un kiné pour constituer ses listes de coureurs et activer
            sa protection de forme.
          </p>
          <PhysiotherapistAssignmentPreview riders={overview.riders} />
          <Link
            href="/jeu/staff"
            className="mt-5 inline-flex rounded-xl bg-[#7856A4] px-5 py-3 text-sm font-black text-white hover:bg-[#5C3B80]"
          >
            Ouvrir le marché du staff
          </Link>
        </div>
      )}
    </section>
  );
}

function PhysiotherapistAssignmentPreview({
  riders,
}: {
  riders: TeamHealthRider[];
}) {
  return (
    <article
      data-tutorial-id="medical-center-physiotherapist-assignments"
      className="mx-auto mt-6 max-w-3xl rounded-2xl border border-dashed border-[#8B6FB6]/35 bg-[#FAF7FD] p-5 text-left"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-black text-[#183F37]">Aperçu d’une fiche kiné</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#7856A4]">
            Exemple · niveau 1
          </p>
        </div>
        <span className="rounded-full bg-[#F1EAF9] px-3 py-2 text-xs font-black text-[#684390]">
          0/4
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-[#60756E]">
        Le niveau détermine la protection de forme et la capacité de suivi. Les
        commandes ci-dessous se débloquent dès le recrutement d’un kiné.
      </p>
      <fieldset disabled className="mt-5 grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#60756E]">
          Coureurs suivis · exemple non interactif
        </legend>
        {riders.slice(0, 4).map((rider) => (
          <label
            key={rider.id}
            className="flex items-center gap-3 rounded-xl border border-[#315B3E]/10 bg-white px-3 py-3 text-sm font-bold text-[#183F37] opacity-75"
          >
            <input type="checkbox" className="h-4 w-4 accent-[#7856A4]" />
            <span className="min-w-0 truncate">
              {rider.firstName} {rider.lastName}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        disabled
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#7856A4] px-4 text-sm font-black text-white opacity-45"
      >
        Enregistrer les affectations
      </button>
    </article>
  );
}

function getNutritionistBaseSkillRows(level: number) {
  const supplementBonus = Math.floor((level - 1) / 2);
  const supplementDetails = [
    `−${level * 5} % sur le coût`,
    supplementBonus > 0
      ? `+${supplementBonus} point${supplementBonus > 1 ? "s" : ""} de forme par intervention`
      : null,
  ].filter((detail): detail is string => detail !== null);

  return [
    {
      label: "Compléments ciblés",
      description: supplementDetails.join(" · "),
    },
    {
      label: "Récupération passive de toute l’équipe",
      description: `+${(level / 5).toLocaleString("fr-FR")} point de forme par coureur et par jour`,
    },
  ];
}

function MedicalStaffBaseSkills({
  rows,
}: {
  rows: Array<{ label: string; description: string }>;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[#315B3E]/10 bg-[#F2F8F5] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#60756E]">
        Compétence de base
      </p>
      <div className="mt-2 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs font-black text-[#183F37]">{row.label}</p>
            <p className="mt-0.5 text-xs font-semibold leading-5 text-[#60756E]">
              {row.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicalStaffAdditionalSkills({
  member,
}: {
  member: TeamMedicalStaffMember;
}) {
  if (member.talents.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-[#E2A63B]/25 bg-[#FFF9E8] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8A6714]">
        Compétences supplémentaires · {member.talents.length}/3
      </p>
      <div className="mt-2 space-y-3">
        {member.talents.map((talent) => (
          <div key={talent.code}>
            <p className="text-xs font-black text-[#5E4A18]">{talent.label}</p>
            <p className="mt-0.5 text-xs font-bold leading-5 text-[#6D5A27]">
              {talent.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicalStaffEmpty({ label }: { label: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-[#315B3E]/20 bg-white px-5 py-8 text-center text-sm font-bold text-[#60756E]">
      {label}
    </p>
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
