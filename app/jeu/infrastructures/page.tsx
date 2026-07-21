import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { redirect } from "next/navigation";

import { GameHeader } from "@/components/game/game-header";
import { calculateSportingDirectorProgression } from "@/lib/game/sporting-director-progression";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGameHeaderData } from "@/services/game-header-data";

export const metadata: Metadata = {
  title: "Infrastructures de l’équipe",
  description:
    "Préparez les futurs bâtiments et investissements structurants de votre équipe.",
};

const INFRASTRUCTURE_UNLOCK_LEVEL = 10;

type DirectorProgressionRow = {
  experience_points: number | string;
};

type InfrastructureConcept = {
  name: string;
  domain: string;
  icon: ConceptIconName;
  promise: string;
  tradeoff: string;
};

type ConceptIconName =
  | "altitude"
  | "data"
  | "health"
  | "logistics"
  | "staff"
  | "wind";

const infrastructureConcepts: InfrastructureConcept[] = [
  {
    name: "Soufflerie & Bike Fit Lab",
    domain: "Matériel · Chrono",
    icon: "wind",
    promise:
      "Optimiser les positions, tester les équipements et créer des gains ciblés en contre-la-montre.",
    tradeoff:
      "Coût énergétique élevé et nombre de sessions limité par saison.",
  },
  {
    name: "Centre d’altitude modulable",
    domain: "Entraînement · Forme",
    icon: "altitude",
    promise:
      "Programmer des blocs d’acclimatation sans déplacer toute l’équipe et préparer les grands objectifs.",
    tradeoff:
      "Bénéfices progressifs, fatigue temporaire et maintenance très coûteuse.",
  },
  {
    name: "Clinique de récupération avancée",
    domain: "Soins · Récupération",
    icon: "health",
    promise:
      "Réunir cryothérapie, réathlétisation et diagnostic pour mieux gérer blessures et enchaînements de courses.",
    tradeoff:
      "Places limitées : il faudra choisir les coureurs prioritaires.",
  },
  {
    name: "Data Room du recrutement",
    domain: "Scouting · Transferts",
    icon: "data",
    promise:
      "Croiser rapports, trajectoires et données de course pour réduire l’incertitude sur le potentiel des recrues.",
    tradeoff:
      "N’améliore pas les coureurs : elle rend surtout les décisions plus fiables.",
  },
  {
    name: "Académie des métiers du cyclisme",
    domain: "Staff · Expertise",
    icon: "staff",
    promise:
      "Former le staff en interne, développer des spécialités secondaires et préparer une relève maison.",
    tradeoff:
      "Mobilise temporairement les spécialistes pendant leur formation.",
  },
  {
    name: "Hub logistique itinérant",
    domain: "Courses · Logistique",
    icon: "logistics",
    promise:
      "Prépositionner matériel, nutrition et véhicules pour mieux absorber les calendriers très dispersés.",
    tradeoff:
      "Rentable uniquement pour une équipe qui voyage et court beaucoup.",
  },
];

export default async function InfrastructuresPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const [headerData, progressionResult] = await Promise.all([
    getGameHeaderData(supabase, user.id),
    supabase
      .from("sporting_directors")
      .select("experience_points")
      .eq("auth_user_id", user.id)
      .maybeSingle<DirectorProgressionRow>(),
  ]);

  if (progressionResult.error) {
    console.error(
      "Impossible de charger le niveau du Directeur Sportif pour les infrastructures :",
      progressionResult.error
    );
  }

  const experiencePoints = Number(
    progressionResult.data?.experience_points ?? 0
  );
  const progression = calculateSportingDirectorProgression(
    Number.isFinite(experiencePoints) ? experiencePoints : 0
  );
  const isUnlockLevelReached =
    progression.level >= INFRASTRUCTURE_UNLOCK_LEVEL;
  const unlockProgress = Math.min(
    100,
    (progression.level / INFRASTRUCTURE_UNLOCK_LEVEL) * 100
  );

  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader
        displayName={headerData.displayName}
        sponsor={headerData.teamSponsorIdentity?.sponsor ?? null}
        maxWidth="wide"
      />

      <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          href="/jeu"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-[#176951] transition hover:text-[#0B302B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#278B70]"
        >
          <span aria-hidden="true">←</span>
          Retour au bureau du DS
        </Link>

        <header className="relative mt-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#071A17_0%,#0B302B_48%,#176951_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(19,60,46,0.22)] sm:px-10 sm:py-11">
          <BlueprintGrid />

          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(290px,0.42fr)] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9BE0BC]">
                  Direction technique · Domaine stratégique
                </p>
                <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#071A17] shadow-sm">
                  En construction
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Infrastructures
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#D6DFD2] sm:text-base">
                À partir du niveau 10, les équipes pourront engager des fonds
                très importants pour bâtir des avantages durables. Chaque
                chantier devra apporter un vrai choix de gestion, avec un coût,
                un délai et une contrepartie.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#9BE0BC]">
                    Seuil d’accès
                  </p>
                  <p className="mt-2 text-3xl font-black text-[#F2C94C]">
                    Niveau {INFRASTRUCTURE_UNLOCK_LEVEL}
                  </p>
                </div>
                <LockIcon unlocked={isUnlockLevelReached} />
              </div>

              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#42B99A,#F2C94C)]"
                  style={{ width: `${unlockProgress}%` }}
                  role="progressbar"
                  aria-label="Progression vers le déblocage des infrastructures"
                  aria-valuemin={1}
                  aria-valuemax={INFRASTRUCTURE_UNLOCK_LEVEL}
                  aria-valuenow={Math.min(
                    progression.level,
                    INFRASTRUCTURE_UNLOCK_LEVEL
                  )}
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 text-xs font-bold text-[#BFD1C6]">
                <span>Niveau actuel : {progression.level}</span>
                <span>
                  {isUnlockLevelReached ? "Palier atteint" : "Accès verrouillé"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="relative mt-7 overflow-hidden rounded-[2rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_18px_50px_rgba(19,60,46,0.1)] sm:p-9">
          <div
            aria-hidden="true"
            className="absolute -right-16 -top-20 h-72 w-72 rounded-full border-[44px] border-[#42B99A]/8"
          />

          <div className="relative grid gap-7 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-[#0B302B] text-[#F2C94C] shadow-[0_16px_36px_rgba(7,26,23,0.2)]">
              <ConstructionIcon />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
                Chantier fonctionnel
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#183F37]">
                Le permis de construire est en préparation.
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#60756E]">
                Aucun achat ni bonus n’est encore actif. Cette page pose le
                futur cadre : bâtiments disponibles, coûts de construction,
                délais, entretien et interactions avec le staff.
              </p>
            </div>

            <div className="grid gap-2 text-xs font-extrabold text-[#48665F] sm:grid-cols-3 lg:grid-cols-1">
              <ConstructionCheck label="Aucun fonds débité" />
              <ConstructionCheck label="Aucun bonus actif" />
              <ConstructionCheck label="Règles à arbitrer" />
            </div>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="infrastructure-concepts-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
                Laboratoire d’idées
              </p>
              <h2
                id="infrastructure-concepts-title"
                className="mt-2 text-3xl font-black tracking-tight text-[#183F37]"
              >
                Pistes à étudier ensemble
              </h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-[#60756E] sm:text-right">
              Ces concepts sont volontairement non définitifs : ils illustrent
              des choix possibles, pas des bonus déjà décidés.
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {infrastructureConcepts.map((concept) => (
              <ConceptCard key={concept.name} concept={concept} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function ConceptCard({ concept }: { concept: InfrastructureConcept }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_16px_42px_rgba(7,26,23,0.14)] transition hover:-translate-y-0.5 hover:border-[#42B99A]/45 hover:shadow-[0_22px_48px_rgba(7,26,23,0.2)]">
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full border-[20px] border-white/[0.025] transition group-hover:scale-110"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#42B99A]/15 text-[#9BE0BC]">
            <ConceptIcon icon={concept.icon} />
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#BFD1C6]">
            Concept
          </span>
        </div>

        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#F2C94C]">
          {concept.domain}
        </p>
        <h3 className="mt-2 text-xl font-black text-white">{concept.name}</h3>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
          {concept.promise}
        </p>
        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs font-bold leading-5 text-[#8FB1A4]">
            <span className="text-[#F2C94C]">Contrepartie :</span>{" "}
            {concept.tradeoff}
          </p>
        </div>
      </div>
    </article>
  );
}

function ConstructionCheck({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-[#EAF5F3] px-3 py-2">
      <span
        aria-hidden="true"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D7E9E2] text-[#176951]"
      >
        ✓
      </span>
      {label}
    </span>
  );
}

function BlueprintGrid() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:32px_32px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-96 w-96 rounded-full border-[58px] border-[#F2C94C]/5"
      />
    </>
  );
}

function LockIcon({ unlocked }: { unlocked: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center rounded-xl ${
        unlocked
          ? "bg-[#42B99A]/20 text-[#9BE0BC]"
          : "bg-white/10 text-[#F2C94C]"
      }`}
      aria-label={unlocked ? "Niveau requis atteint" : "Accès verrouillé"}
      role="img"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d={unlocked ? "M8 10V7a4 4 0 0 1 7.5-2" : "M8 10V7a4 4 0 0 1 8 0v3"} />
        <path d="M12 15v2" />
      </svg>
    </span>
  );
}

function ConstructionIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-14 w-14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 42h34M11 42V20l13-9 13 9v22" />
      <path d="M18 42V30h12v12M17 23h4M27 23h4" />
      <path d="M5 11h16M9 7v8M17 7v8" />
    </svg>
  );
}

function ConceptIcon({ icon }: { icon: ConceptIconName }) {
  const paths: Record<ConceptIconName, React.ReactNode> = {
    altitude: (
      <>
        <path d="m3 20 6-10 4 6 3-5 5 9" />
        <path d="M8 15h8M12 4v5M9 6l3-2 3 2" />
      </>
    ),
    data: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 16v-3M12 16V8M17 16v-6" />
      </>
    ),
    health: (
      <>
        <path d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z" />
        <path d="M8 12h2l1-2 2 4 1-2h2" />
      </>
    ),
    logistics: (
      <>
        <path d="M3 6h12v12H3zM15 10h4l2 3v5h-6" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    staff: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c.5-4.5 2.5-7 6-7s5.5 2.5 6 7" />
        <path d="M18 7v8M14 11h8" />
      </>
    ),
    wind: (
      <>
        <path d="M3 8h11c3 0 3-4 0-4" />
        <path d="M3 12h16c3 0 3 4 0 4" />
        <path d="M3 16h8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[icon]}
    </svg>
  );
}
