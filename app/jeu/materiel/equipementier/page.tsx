import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { EquipmentPartnerSubmitButton } from "@/components/game/equipment-partner-submit-button";
import { GameHeader } from "@/components/game/game-header";
import { MaterialNavigation } from "@/components/game/material-navigation";
import { TutorialLaunchButton } from "@/components/tutorial/tutorial-launch-button";
import { TutorialRouteResume } from "@/components/tutorial/tutorial-route-resume";
import Link from "@/components/ui/app-link";
import { getEquipmentCategory } from "@/lib/game/equipment";
import { EQUIPMENT_PARTNER_CONTRACT_SEASONS } from "@/lib/game/equipment-partner";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EQUIPMENT_TUTORIAL_KEY,
  EQUIPMENT_TUTORIAL_PARTNER_ROUTE,
} from "@/lib/tutorial/equipment";
import { getAuthenticatedTutorialProgress } from "@/lib/tutorial/progress";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  getCurrentTeamEquipmentPartnerOverview,
  type EquipmentPartnerProduct,
  type EquipmentPartnerSupplierOption,
} from "@/services/team-equipment-partner";
import { signEquipmentPartnerAction } from "./actions";

export const metadata: Metadata = {
  title: "Équipementier",
  description: "Signez un équipementier et accédez à sa dotation technique.",
};

type EquipmentPartnerPageProps = {
  searchParams: Promise<{
    etat?: string | string[];
    erreur?: string | string[];
  }>;
};

export default async function EquipmentPartnerPage({
  searchParams,
}: EquipmentPartnerPageProps) {
  const query = await searchParams;
  const state = readQuery(query.etat);
  const errorMessage = readQuery(query.erreur);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const [headerData, overview, equipmentTutorialProgress] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamEquipmentPartnerOverview(user.id),
    getAuthenticatedTutorialProgress(supabase, EQUIPMENT_TUTORIAL_KEY).catch(
      (error: unknown) => {
        console.error(
          "Impossible de reprendre le didacticiel du matériel :",
          error,
        );
        return null;
      },
    ),
  ]);
  if (!overview) redirect("/jeu");

  const activeSupplier = overview.activeContract
    ? (overview.suppliers.find(
        (supplier) => supplier.key === overview.activeContract?.supplierKey,
      ) ?? null)
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      {equipmentTutorialProgress?.status === "in_progress" &&
      equipmentTutorialProgress.current_route ===
        EQUIPMENT_TUTORIAL_PARTNER_ROUTE &&
      equipmentTutorialProgress.current_step_key ? (
        <TutorialRouteResume
          tutorialKey={EQUIPMENT_TUTORIAL_KEY}
          currentStepKey={equipmentTutorialProgress.current_step_key}
        />
      ) : null}
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />

        <MaterialNavigation activeHref="/jeu/materiel/equipementier" />

        <header
          data-tutorial-id="equipment-partner-overview"
          className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17,#176951)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.2)] sm:px-10 sm:py-10"
        >
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-24 h-72 w-72 rounded-full border-[46px] border-white/5"
          />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                Partenariat technique · dotation
              </p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Équipementier
                </h1>
                <TutorialLaunchButton
                  tutorialKey={EQUIPMENT_TUTORIAL_KEY}
                  iconOnly
                />
              </div>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
                Accédez sans limite de stock aux équipements proposés par le
                partenaire pendant toute la durée du contrat. Les recherches et
                prototypes uniques sont désormais gérés par votre propre Labo
                R&D.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <HeroMetric
                label="Réputation"
                value={formatNumber(overview.reputationPoints)}
              />
              <HeroMetric
                label="Contrat"
                value={`${EQUIPMENT_PARTNER_CONTRACT_SEASONS} saisons`}
              />
            </div>
          </div>
        </header>

        {state ? <SuccessMessage state={state} /> : null}
        {errorMessage ? (
          <div className="mt-5 rounded-xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-900">
            {errorMessage.slice(0, 300)}
          </div>
        ) : null}

        <section
          data-tutorial-id="equipment-partner-rules"
          className="mt-7 grid gap-4 md:grid-cols-3"
        >
          <RuleCard
            eyebrow="Signature"
            title="Aucun coût"
            body="Le matériel est disponible sans achat ni stock à gérer pendant toute la durée du contrat."
          />
          <RuleCard
            eyebrow="Engagement"
            title="Deux saisons fermes"
            body="Le contrat est irrévocable et ne peut pas être prolongé avec la même marque."
          />
          <RuleCard
            eyebrow="Signature technique"
            title="Des profils vraiment différents"
            body="Chaque marque affiche sa philosophie et ses terrains de prédilection. Les bonus restent fixes pendant le contrat."
          />
        </section>

        <div data-tutorial-id="equipment-partner-workflow">
          {overview.activeContract && activeSupplier ? (
            <ActiveContractSection
              overview={overview}
              supplier={activeSupplier}
            />
          ) : (
            <ContractSelectionSection overview={overview} />
          )}
        </div>

        {overview.contractHistory.some(
          (contract) => contract.status === "completed",
        ) ? (
          <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-[0_16px_45px_rgba(19,60,46,0.08)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
              Archives techniques
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Contrats terminés
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {overview.contractHistory
                .filter((contract) => contract.status === "completed")
                .map((contract) => (
                  <div
                    key={contract.id}
                    className="rounded-2xl border border-[#315B3E]/12 bg-[#F6F8F5] px-5 py-4"
                  >
                    <p className="font-black text-[#183F37]">
                      {contract.supplierName}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#60756E]">
                      {contract.startSeasonName} → {contract.endSeasonName}
                    </p>
                    <p className="mt-3 text-xs font-bold leading-5 text-[#936A21]">
                      L’accès à la dotation de cette marque a été retiré.
                    </p>
                  </div>
                ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ContractSelectionSection({
  overview,
}: {
  overview: NonNullable<
    Awaited<ReturnType<typeof getCurrentTeamEquipmentPartnerOverview>>
  >;
}) {
  if (!overview.unlocked) {
    return (
      <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)]">
        <div className="grid gap-6 p-7 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-[#E8ECE8] text-[#60756E]">
            <LockIcon />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8A9A92]">
              Sous-rubrique verrouillée
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#183F37]">
              Développez d’abord la réputation de l’équipe
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#60756E]">
              Il faut atteindre {overview.reputationThreshold} points pour
              signer un équipementier. Votre réputation est actuellement de{" "}
              {formatNumber(overview.reputationPoints)}.
            </p>
            <div className="mt-5 h-2.5 max-w-xl overflow-hidden rounded-full bg-[#DDE5E0]">
              <div
                className="h-full rounded-full bg-[#42B99A]"
                style={{
                  width: `${Math.min(
                    100,
                    (overview.reputationPoints / overview.reputationThreshold) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const availableSuppliers = overview.suppliers.filter(
    (supplier) => !supplier.alreadyUsed,
  );

  return (
    <section className="mt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Appel d’offres technique
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37]">
            Choisir un partenaire pour deux saisons
          </h2>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#176951] shadow-sm">
          {availableSuppliers.length} partenaire
          {availableSuppliers.length > 1 ? "s" : ""} disponible
          {availableSuppliers.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {overview.suppliers.map((supplier) => (
          <SupplierContractCard key={supplier.key} supplier={supplier} />
        ))}
      </div>
    </section>
  );
}

function SupplierContractCard({
  supplier,
}: {
  supplier: EquipmentPartnerSupplierOption;
}) {
  const coreProducts = supplier.products;

  return (
    <article
      className={
        supplier.alreadyUsed
          ? "overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-[#F0F3F0] opacity-75"
          : "overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.09)]"
      }
    >
      <div
        className="flex min-h-36 items-center gap-5 p-6"
        style={{
          background: `linear-gradient(135deg, ${supplier.primaryColor}, ${supplier.secondaryColor})`,
        }}
      >
        <div className="relative h-20 w-40 shrink-0 overflow-hidden rounded-2xl bg-white shadow-lg">
          <Image
            src={supplier.logoPath}
            alt={`Logo ${supplier.name}`}
            fill
            sizes="160px"
            className="object-contain p-3"
          />
        </div>
        <div className="text-white">
          <h3 className="text-2xl font-black">{supplier.name}</h3>
          <p className="mt-2 line-clamp-3 text-xs font-bold leading-5 text-white/85">
            {supplier.positioning}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {supplier.strengths.map((strength) => (
              <span
                key={strength}
                className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white"
              >
                {strength}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#278B70]">
          Mise à disposition immédiate · accès illimité
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {coreProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-xl border border-[#315B3E]/12 bg-[#F7F9F7] p-3"
            >
              <p className="text-[10px] font-black uppercase text-[#60756E]">
                {getEquipmentCategory(product.slot).shortLabel}
              </p>
              <p className="mt-1 text-xs font-black text-[#183F37]">
                {product.name}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold leading-5 text-[#60756E]">
          Cette dotation peut équiper autant de coureurs que nécessaire pendant
          le contrat. Elle reste virtuelle et ne remplit jamais l’inventaire.
        </p>
        <form action={signEquipmentPartnerAction} className="mt-5">
          <input type="hidden" name="supplierKey" value={supplier.key} />
          <EquipmentPartnerSubmitButton
            label={
              supplier.alreadyUsed
                ? "Contrat déjà réalisé"
                : `Signer avec ${supplier.name}`
            }
            pendingLabel="Signature…"
            disabled={supplier.alreadyUsed}
          />
        </form>
        {!supplier.alreadyUsed ? (
          <p className="mt-3 text-[11px] font-bold text-[#936A21]">
            Signature définitive : aucune rupture ni prolongation possible.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ActiveContractSection({
  overview,
  supplier,
}: {
  overview: NonNullable<
    Awaited<ReturnType<typeof getCurrentTeamEquipmentPartnerOverview>>
  >;
  supplier: EquipmentPartnerSupplierOption;
}) {
  const contract = overview.activeContract!;

  return (
    <>
      <section className="mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_45px_rgba(19,60,46,0.09)]">
        <div
          className="grid gap-6 p-7 text-white sm:p-9 lg:grid-cols-[220px_1fr_auto] lg:items-center"
          style={{
            background: `linear-gradient(135deg, ${supplier.primaryColor}, ${supplier.secondaryColor})`,
          }}
        >
          <div className="relative h-24 overflow-hidden rounded-2xl bg-white shadow-lg">
            <Image
              src={supplier.logoPath}
              alt={`Logo ${supplier.name}`}
              fill
              sizes="220px"
              className="object-contain p-4"
            />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/75">
              Contrat actif · irrévocable
            </p>
            <h2 className="mt-2 text-3xl font-black">{supplier.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {supplier.strengths.map((strength) => (
                <span
                  key={strength}
                  className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide"
                >
                  {strength}
                </span>
              ))}
            </div>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/85">
              {contract.startSeasonName} à {contract.endSeasonName}. Les
              références de la dotation restent utilisables sans limite de
              stock, puis seront retirées au terme de la seconde saison.
            </p>
          </div>
          <div className="rounded-2xl border border-white/25 bg-black/15 px-5 py-4 text-center backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/70">
              Fin contractuelle
            </p>
            <p className="mt-1 text-xl font-black">{contract.endSeasonName}</p>
          </div>
        </div>
        {!overview.unlocked ? (
          <div className="border-t border-[#D7E3DC] bg-[#FFF8DF] px-6 py-4 text-xs font-bold leading-5 text-[#7A5A1D] sm:px-9">
            Votre réputation est retombée à{" "}
            {formatNumber(overview.reputationPoints)}, mais le contrat continue
            normalement jusqu’à son terme. Il faudra de nouveau atteindre{" "}
            {overview.reputationThreshold} pour signer le partenaire suivant.
          </div>
        ) : null}
      </section>

      <section className="mt-7">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#278B70]">
            Dotation de l’équipe
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#183F37]">
            Équipements disponibles
          </h2>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {overview.activeProducts
            .filter((product) => product.isAvailable)
            .map((product) => (
              <PartnerProductCard key={product.id} product={product} />
            ))}
        </div>
      </section>

    </>
  );
}

function PartnerProductCard({ product }: { product: EquipmentPartnerProduct }) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#315B3E]/12 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.09)]">
      <div className="relative aspect-[16/9] overflow-hidden bg-[#071A17]">
        <Image
          src={product.imagePath}
          alt={product.name}
          fill
          sizes="(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-4 pt-12 text-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#9BE0BC]">
            {getEquipmentCategory(product.slot).shortLabel}
          </p>
          <h3 className="mt-1 text-xl font-black">{product.name}</h3>
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase text-[#071A17]">
          Dotation
        </span>
      </div>
      <div className="p-5">
        <p className="text-xs font-bold leading-5 text-[#60756E]">
          {formatEffects(product)}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-bold text-[#60756E]">
          <span>Accès illimité pendant le contrat</span>
          <Link
            href="/jeu/materiel/equiper"
            className="text-[#176951] hover:underline"
          >
            Équiper
          </Link>
        </div>
      </div>
    </article>
  );
}

function RuleCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/12 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#278B70]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-black text-[#183F37]">{title}</h2>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#60756E]">
        {body}
      </p>
    </article>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-[#9BE0BC]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SuccessMessage({ state }: { state: string }) {
  const messages: Record<string, string> = {
    "contrat-signe":
      "Le contrat est signé. La dotation du partenaire est disponible sans limite de stock pendant le partenariat.",
  };
  const message = messages[state];
  return message ? (
    <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">
      {message}
    </div>
  ) : null;
}

function formatEffects(product: EquipmentPartnerProduct) {
  const values = [
    ...Object.entries(product.effects.ratingBonuses).map(
      ([key, value]) =>
        `${Number(value) >= 0 ? "+" : ""}${value} ${ratingLabel(key)}`,
    ),
    ...Object.entries(product.effects.timeTrialRatingBonuses).map(
      ([key, value]) =>
        `${Number(value) >= 0 ? "+" : ""}${value} ${ratingLabel(key)} en chrono`,
    ),
  ];
  if (product.effects.injuryRiskReductionPct) {
    values.push(
      `−${product.effects.injuryRiskReductionPct} % de risque de blessure`,
    );
  }
  if (product.effects.breakawayReputationBonus) {
    values.push(
      `+${formatNumber(product.effects.breakawayReputationBonus)} réputation en échappée`,
    );
  }
  if (product.effects.victoryReputationBonus) {
    values.push(
      `+${formatNumber(product.effects.victoryReputationBonus)} réputation sur victoire`,
    );
  }
  return values.join(" · ") || product.baseEffectSummary;
}

function ratingLabel(key: string) {
  const labels: Record<string, string> = {
    mountain: "Montagne",
    hills: "Vallons",
    flat: "Plaine",
    timeTrial: "Contre-la-montre",
    cobbles: "Pavés",
    sprint: "Sprint",
    acceleration: "Accélération",
    downhill: "Descente",
    endurance: "Endurance",
    resistance: "Résistance",
    recovery: "Récupération",
    breakaway: "Échappée",
    prologue: "Prologue",
  };
  return labels[key] ?? key;
}


function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-9 w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}
