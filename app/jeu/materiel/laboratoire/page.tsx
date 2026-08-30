import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import { MaterialNavigation } from "@/components/game/material-navigation";
import Link from "@/components/ui/app-link";
import { getEquipmentCategory } from "@/lib/game/equipment";
import {
  describeEquipmentRndEngineerEffects,
  EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH,
  EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH,
  estimateEquipmentRndResearch,
} from "@/lib/game/equipment-rnd";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import { getCurrentTeamEquipmentRndOverview } from "@/services/team-equipment-rnd";
import { startEquipmentRndAction } from "./actions";

export const metadata: Metadata = {
  title: "Laboratoire R&D",
  description: "Transformez un équipement de série en prototype unique.",
};

export const maxDuration = 300;

type PageProps = {
  searchParams: Promise<{ recherche?: string; erreur?: string }>;
};

export default async function EquipmentLaboratoryPage({
  searchParams,
}: PageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await getAuthenticatedUser(supabase);
  if (error || !user) redirect("/connexion");

  const [headerData, overview] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    getCurrentTeamEquipmentRndOverview(user.id),
  ]);
  if (!overview) redirect("/jeu");

  const baseline = overview.labLevel
    ? estimateEquipmentRndResearch({
        labLevel: overview.labLevel,
        labEfficiencyBonusPercentage:
          overview.labEfficiencyBonusPercentage,
      })
    : null;

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        simulatorEmail={user.email}
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />
      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <BackToOfficeLink />
        <MaterialNavigation activeHref="/jeu/materiel/laboratoire" />

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[#071A17] text-white shadow-[0_24px_70px_rgba(19,60,46,.2)]">
          <Image
            src="/images/infrastructure/research-lab.webp"
            alt="Laboratoire de recherche cycliste"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071A17] via-[#071A17]/85 to-transparent" />
          <div className="relative p-7 sm:p-10">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#9BE0BC]">
              {overview.teamName} · Laboratoire niveau {overview.labLevel}
            </p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Labo R&D</h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2]">
              Un exemplaire est consommé pour créer un prototype strictement
              réservé à votre équipe. L’expérience peut apporter un bonus inédit
              de +1, exceptionnellement +2 à haut niveau, ou un malus de −1.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-white/10 px-3 py-2">
                {baseline
                  ? `${baseline.successRate} % de réussite de base`
                  : "Installation non construite"}
              </span>
              {overview.labEfficiencyBonusPercentage > 0 ? (
                <span className="rounded-full bg-[#9BE0BC]/20 px-3 py-2 text-[#C9F0E4]">
                  Conception haute performance · +
                  {overview.labEfficiencyBonusPercentage} % d’efficacité
                </span>
              ) : null}
              <span className="rounded-full bg-white/10 px-3 py-2">
                Capacité R&D · {overview.activeProjects.length}/
                {overview.researchCapacity}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2">
                R&D gratuite
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2">
                Objet unique et équipable
              </span>
            </div>
          </div>
        </header>

        {query.recherche ? (
          <Alert tone="success">
            La recherche est lancée. L’équipement a été confié au laboratoire.
          </Alert>
        ) : null}
        {query.erreur ? (
          <Alert tone="error">{query.erreur.slice(0, 300)}</Alert>
        ) : null}

        {overview.labLevel < 1 ? (
          <section className="mt-7 rounded-[2rem] border border-amber-300 bg-amber-50 p-7">
            <h2 className="text-2xl font-black text-amber-950">
              Laboratoire requis
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-amber-900">
              Construisez le Laboratoire R&D dans Infrastructures. Le niveau 1
              débloque les cadres, puis une nouvelle famille de matériel à
              chaque niveau.
            </p>
            <Link
              href="/jeu/infrastructures"
              className="mt-5 inline-flex rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white"
            >
              Voir les infrastructures
            </Link>
          </section>
        ) : (
          <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#278B70]">
                Banc d’essai
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Recherches et prototypes
              </h2>
              {overview.activeProjects.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                  {overview.activeProjects.map((project) => {
                    const remainingDays = Math.max(
                      0,
                      project.completesGameDayIndex -
                        overview.currentGameDayIndex,
                    );
                    return (
                      <article
                        key={project.id}
                        className="rounded-2xl bg-[#0B302B] p-5 text-white"
                      >
                        <p className="text-lg font-black">
                          {project.requestedPrototypeName ?? project.itemName}
                        </p>
                        {project.requestedPrototypeName ? (
                          <p className="mt-1 text-xs font-semibold text-[#9BE0BC]">
                            Créé à partir de {project.itemName}
                          </p>
                        ) : null}
                        <p className="mt-2 text-sm font-semibold text-[#BFD1C6]">
                          {project.successRate} % de réussite · résultat dans{" "}
                          {remainingDays} jour{remainingDays === 1 ? "" : "s"}
                        </p>
                        <p className="mt-3 text-xs font-bold text-[#9BE0BC]">
                          Ingénieur :{" "}
                          {project.engineerName ?? "projet historique"}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-[#F3F8F5] p-4 text-sm font-semibold text-[#60756E]">
                  Aucune recherche en cours. Chaque ingénieur R&D peut piloter
                  un projet à la fois.
                </p>
              )}

              <div className="mt-6 border-t border-[#315B3E]/12 pt-6">
                <h3 className="text-lg font-black text-[#183F37]">
                  Créer un prototype
                </h3>
                {overview.engineers.length < 1 ? (
                  <div className="mt-4 rounded-xl bg-[#FFF3D6] p-4 text-sm font-bold text-[#74550B]">
                    Un ingénieur R&D actif est requis pour lancer une recherche.
                    Le laboratoire rend ensuite la recherche entièrement
                    gratuite.
                    <Link
                      href="/jeu/staff?metier=research_engineer"
                      className="mt-3 block text-[#176951] underline"
                    >
                      Recruter un ingénieur R&D
                    </Link>
                  </div>
                ) : overview.availableEngineers.length < 1 ? (
                  <p className="mt-4 rounded-xl bg-[#FFF3D6] p-4 text-sm font-bold text-[#74550B]">
                    Tous vos ingénieurs pilotent déjà une recherche. Une
                    nouvelle place se libérera à la fin d’un projet ou avec le
                    recrutement d’un ingénieur supplémentaire.
                  </p>
                ) : overview.researchableItems.length ? (
                  <form
                    action={startEquipmentRndAction}
                    className="mt-4 space-y-5"
                  >
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wider text-[#60756E]">
                      Nom du prototype
                    </span>
                    <input
                      name="prototypeName"
                      type="text"
                      required
                      minLength={EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH}
                      maxLength={EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH}
                      autoComplete="off"
                      placeholder="Ex. Aquila RS-X"
                      className="mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wider text-[#60756E]">
                      Équipement libre à sacrifier
                    </span>
                    <select
                      name="equipmentItemId"
                      required
                      className="mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
                    >
                      <option value="">Choisir une référence</option>
                      {overview.researchableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {getEquipmentCategory(item.slot).shortLabel} ·{" "}
                          {item.name} · bonus +{item.bonusTotal} ·{" "}
                          {item.baseDurationDays} j de base ·{" "}
                          {item.availableQuantity} libre(s)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wider text-[#60756E]">
                      Ingénieur R&D disponible
                    </span>
                    <select
                      name="engineerContractId"
                      required
                      className="mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
                    >
                      <option value="">Choisir un ingénieur</option>
                      {overview.availableEngineers.map((engineer) => (
                        <option
                          key={engineer.contractId}
                          value={engineer.contractId}
                        >
                          {engineer.name} · N{engineer.level} ·{" "}
                          {describeEquipmentRndEngineerEffects(engineer).join(
                            " · ",
                          ) || "aucun talent actif"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-xl bg-[#F3F8F5] p-4 text-xs font-semibold leading-5 text-[#60756E]">
                    La recherche est gratuite : seul l’exemplaire choisi est
                    consommé. La durée de base est de 2 jours par point jusqu’à
                    +6 : 10 jours à +5 et 12 jours à +6. Chaque point suivant
                    ajoute 4 jours ; +10 demande 28 jours et constitue le
                    plafond. Les talents de l’ingénieur réduisent cette durée.
                    La même référence peut être recherchée plusieurs fois tant
                    qu’un exemplaire reste libre. Un prototype peut lui-même
                    repasser au laboratoire jusqu’au plafond de +10. La réussite
                    part de {baseline?.successRate ?? 0} %.
                  </p>
                  <button className="w-full rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white hover:bg-[#0B302B]">
                    Consommer la pièce et lancer gratuitement la R&D
                  </button>
                  </form>
                ) : (
                  <p className="mt-5 rounded-xl bg-[#FFF3D6] p-4 text-sm font-bold text-[#74550B]">
                    {overview.cappedItemCount > 0
                      ? "Tous vos équipements disponibles ont atteint le plafond R&D de +10."
                      : "Aucun exemplaire libre dans les catégories débloquées. Achetez une pièce ou libérez-en une depuis l’écran d’équipement."}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.18em] text-[#278B70]">
                Progression du labo
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#183F37]">
                Catégories débloquées
              </h2>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
                {[
                  [1, "Cadres"],
                  [2, "Roues"],
                  [3, "Casques"],
                  [4, "Chaussures"],
                  [5, "Cuissards"],
                  [6, "Gants"],
                  [7, "Lunettes"],
                ].map(([level, label]) => (
                  <div
                    key={level}
                    className={`rounded-xl border p-3 ${overview.labLevel >= Number(level) ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-[#315B3E]/10 bg-[#F5F7F6] text-[#82918C]"}`}
                  >
                    N{level} · {label}
                  </div>
                ))}
              </div>
              {overview.engineers.length < 1 ? (
                <Link
                  href="/jeu/staff?metier=research_engineer"
                  className="mt-5 block rounded-xl border border-dashed border-[#176951]/30 p-4 text-sm font-black text-[#176951]"
                >
                  Recruter un ingénieur R&D
                </Link>
              ) : null}
            </section>
          </div>
        )}

        {overview.recentProjects.length ? (
          <section className="mt-7 rounded-[2rem] border border-[#315B3E]/12 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black text-[#183F37]">
              Prototypes récemment créés
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {overview.recentProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl bg-[#F3F8F5] p-4"
                >
                  <p className="font-black text-[#183F37]">
                    {project.prototypeName ?? project.itemName}
                  </p>
                  <p className="mt-2 text-xs font-bold text-[#60756E]">
                    {project.ratingKey ?? "Statistique"}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${project.outcome === "improvement" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
                  >
                    {(project.ratingDelta ?? 0) > 0 ? "+" : ""}
                    {project.ratingDelta ?? 0}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-5 rounded-xl border px-5 py-4 text-sm font-bold ${tone === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
    >
      {children}
    </div>
  );
}
