import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { BackToOfficeLink } from "@/components/game/back-to-office-link";
import { GameHeader } from "@/components/game/game-header";
import Link from "@/components/ui/app-link";
import { getEquipmentCategory } from "@/lib/game/equipment";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";
import {
  estimateEquipmentRndResearch,
  getCurrentTeamEquipmentRndOverview,
} from "@/services/team-equipment-rnd";
import { startEquipmentRndAction } from "./actions";

export const metadata: Metadata = {
  title: "Laboratoire R&D",
  description: "Transformez un équipement de série en prototype unique.",
};

type PageProps = {
  searchParams: Promise<{ recherche?: string; erreur?: string }>;
};

const SPECIALTY_LABELS = {
  research_time: "temps de recherche",
  research_cost: "coût de recherche",
  research_success: "taux de réussite",
} as const;

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
        itemPrice: 0,
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
        <MaterialNavigation />

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
              <span className="rounded-full bg-white/10 px-3 py-2">
                1 recherche simultanée
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
                {overview.activeProject
                  ? "Recherche en cours"
                  : "Créer un prototype"}
              </h2>
              {overview.activeProject ? (
                <div className="mt-5 rounded-2xl bg-[#0B302B] p-6 text-white">
                  <p className="text-xl font-black">
                    {overview.activeProject.itemName}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#BFD1C6]">
                    {overview.activeProject.successRate} % de réussite ·
                    résultat dans{" "}
                    {Math.max(
                      0,
                      overview.activeProject.completesGameDayIndex -
                        overview.currentGameDayIndex,
                    )}{" "}
                    jour(s)
                  </p>
                  {overview.activeProject.engineerName ? (
                    <p className="mt-3 text-xs font-bold text-[#9BE0BC]">
                      Ingénieur : {overview.activeProject.engineerName}
                    </p>
                  ) : null}
                </div>
              ) : overview.researchableItems.length ? (
                <form
                  action={startEquipmentRndAction}
                  className="mt-5 space-y-5"
                >
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
                          {item.name} · {item.availableQuantity} libre(s)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wider text-[#60756E]">
                      Ingénieur R&D (facultatif)
                    </span>
                    <select
                      name="engineerContractId"
                      className="mt-2 w-full rounded-xl border border-[#315B3E]/20 bg-white px-4 py-3 text-sm font-bold"
                    >
                      <option value="">Aucun ingénieur</option>
                      {overview.engineers.map((engineer) => (
                        <option
                          key={engineer.contractId}
                          value={engineer.contractId}
                        >
                          {engineer.name} · N{engineer.level} ·{" "}
                          {engineer.specialty
                            ? SPECIALTY_LABELS[engineer.specialty]
                            : "généraliste"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-xl bg-[#F3F8F5] p-4 text-xs font-semibold leading-5 text-[#60756E]">
                    Le coût exact dépend de la valeur de la pièce et de
                    l’ingénieur. À ce niveau, la recherche dure de 4 à{" "}
                    {baseline?.durationDays ?? 18} jours et part de{" "}
                    {baseline?.successRate ?? 0} % de réussite.
                  </p>
                  <button className="w-full rounded-xl bg-[#176951] px-5 py-3 text-sm font-black text-white hover:bg-[#0B302B]">
                    Consommer la pièce et lancer la R&D
                  </button>
                </form>
              ) : (
                <p className="mt-5 rounded-xl bg-[#FFF3D6] p-4 text-sm font-bold text-[#74550B]">
                  Aucun exemplaire libre dans les catégories débloquées. Achetez
                  une pièce ou libérez-en une depuis l’écran d’équipement.
                </p>
              )}
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

function MaterialNavigation() {
  const links = [
    ["/jeu/materiel", "Matériel commercial"],
    ["/jeu/materiel/equipementier", "Équipementier"],
    ["/jeu/materiel/laboratoire", "Labo R&D"],
    ["/jeu/materiel/equiper", "Équiper les coureurs"],
  ];
  return (
    <nav
      aria-label="Rubriques du matériel"
      className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-[#315B3E]/12 bg-white p-2 shadow-sm"
    >
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={href.endsWith("laboratoire") ? "page" : undefined}
          className={`shrink-0 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider ${href.endsWith("laboratoire") ? "bg-[#0B302B] text-white" : "text-[#60756E] hover:bg-[#EAF5F3] hover:text-[#176951]"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
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
