import type { Metadata } from "next";
import Link from "@/components/ui/app-link";
import { RiderWeightGuideTables } from "@/components/guide/rider-weight-tables";
import {
  calculateCombativityReward,
  calculateInternationalChampionshipReward,
  calculateNationalChampionshipReward,
  calculateRaceReward,
  calculateStageReward,
  type RaceReward,
  type RaceRewardScope,
} from "@/lib/game/economy";
import {
  FORM_CAMP_TYPES,
  MEDICAL_PROTOCOLS,
  NUTRITION_INTERVENTIONS,
} from "@/lib/game/health-center";
import {
  FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  INFRASTRUCTURE_SPECIALIZATION_TRANSITION_DAYS,
  TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
} from "@/lib/game/infrastructure-specializations";
import {
  getTeamInfrastructureCodesByStartingCost,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
} from "@/lib/game/infrastructure";
import {
  PRESS_REPUTATION_COMMITMENTS,
  REPUTATION_FEATURE_THRESHOLDS,
  REPUTATION_TIERS,
  SPONSOR_REPUTATION_INVESTMENTS,
  WILDCARD_REPUTATION_COMMITMENTS,
} from "@/lib/game/reputation";
import type { RaceCategoryCode } from "@/lib/game/race-calendar";
import {
  SECONDARY_SPONSOR_REPUTATION_THRESHOLD,
  getSecondarySponsorObjectiveCount,
} from "@/lib/game/secondary-sponsor";
import { PRE_RACE_AMBITION_DETAILS } from "@/lib/game/pre-race-press";
import {
  getRaceReconnaissanceCost,
  RACE_RECONNAISSANCE_BASE_BONUS,
  RACE_RECONNAISSANCE_DURATION_DAYS,
} from "@/lib/game/race-reconnaissance";
import {
  SPONSOR_MAIN_OBJECTIVE_START_GAME_YEAR,
} from "@/lib/game/sponsor-main-objective";
import {
  getTrainingDomainWeightGroups,
  TRAINING_DOMAIN_LABELS,
  TRAINING_DOMAINS,
} from "@/lib/game/training";

export const metadata: Metadata = {
  title: "Guide complet du Directeur Sportif",
  description:
    "Le manuel complet de Cyclo Stratège : calendrier, courses, entraînement, forme, staff, transferts, finances, objectifs et progression.",
  alternates: {
    canonical: "/guide",
  },
  openGraph: {
    url: "/guide",
    title: "Guide du jeu de management cycliste Cyclo Stratège",
    description:
      "Calendrier, courses, entraînement, staff, transferts, finances et progression : préparez votre carrière de directeur sportif.",
  },
};

const guideNavigation = [
  { href: "#demarrage", label: "Bien démarrer" },
  { href: "#journee", label: "Une journée" },
  { href: "#coureurs", label: "Coureurs" },
  { href: "#courses", label: "Courses" },
  { href: "#baremes", label: "Barèmes" },
  { href: "#equipe", label: "Équipe" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "#structures", label: "Structures" },
  { href: "#progression", label: "Progression" },
  { href: "#pages", label: "Toutes les pages" },
] as const;

const firstSteps = [
  {
    number: "01",
    title: "Finaliser votre profil",
    text: "Choisissez le nom public, la nationalité et l’avatar de votre Directeur Sportif. La nationalité est un choix structurant de la carrière.",
    href: "/jeu/directeur-sportif",
    linkLabel: "Profil du DS",
  },
  {
    number: "02",
    title: "Fonder l’équipe amateur",
    text: "Créez le nom, le pays et le maillot fondateur de l’équipe. Sept coureurs amateurs constituent ensuite votre premier effectif.",
    href: "/jeu/directeur-sportif#equipe-amateur",
    linkLabel: "Créer l’équipe",
  },
  {
    number: "03",
    title: "Étudier l’effectif",
    text: "Comparez les treize caractéristiques, la forme, le potentiel et les profils. Identifiez vos leaders et leurs meilleurs terrains.",
    href: "/jeu/effectif",
    linkLabel: "Voir l’effectif",
  },
  {
    number: "04",
    title: "Régler l’entraînement",
    text: "Définissez un seuil de forme, puis l’intensité, le domaine et l’éventuel entraîneur de chaque coureur avant la séance de 8 h.",
    href: "/jeu/entrainement",
    linkLabel: "Préparer la séance",
  },
  {
    number: "05",
    title: "Choisir une première course",
    text: "Filtrez le calendrier, ouvrez la fiche d’une épreuve et inscrivez uniquement des coureurs disponibles avant l’heure de gel.",
    href: "/jeu/calendrier",
    linkLabel: "Ouvrir le calendrier",
  },
  {
    number: "06",
    title: "Réclamer les objectifs",
    text: "Les objectifs terminés ne versent leur récompense qu’après un clic sur le bouton prévu. Pensez à récupérer les gains d’introduction.",
    href: "/jeu/objectifs",
    linkLabel: "Voir les objectifs",
  },
] as const;

const daySchedule = [
  {
    time: "Avant 8 h",
    title: "Préparation du matin",
    text: "Réglez l’entraînement et finalisez les inscriptions aux courses AM.",
  },
  {
    time: "8 h",
    title: "Séance et gel AM",
    text: "La séance quotidienne est traitée. Les inscriptions de la course de 14 h sont figées.",
  },
  {
    time: "9 h",
    title: "Marché quotidien",
    text: "De nouveaux coureurs apparaissent aux enchères jusqu’à 18 h.",
  },
  {
    time: "12 h",
    title: "Gel PM",
    text: "Les inscriptions de la course de 18 h sont figées.",
  },
  {
    time: "13 h 55",
    title: "Dernier réglage AM",
    text: "L’équipement reste modifiable jusqu’à cinq minutes avant le départ.",
  },
  {
    time: "14 h",
    title: "Course AM",
    text: "Le live démarre. Une course de 150 km dure généralement autour de 25 minutes.",
  },
  {
    time: "17 h 55",
    title: "Dernier réglage PM",
    text: "Dernière limite pour modifier l’équipement de la course du soir.",
  },
  {
    time: "18 h",
    title: "Course PM et enchères",
    text: "Le second live démarre et les enchères quotidiennes sont attribuées.",
  },
] as const;

const riderRatings = [
  ["MON", "Montagne"],
  ["VAL", "Vallons"],
  ["PLA", "Plaine"],
  ["CLM", "Contre-la-montre"],
  ["PAV", "Pavés"],
  ["SPR", "Sprint"],
  ["ACC", "Accélération"],
  ["DES", "Descente"],
  ["END", "Endurance"],
  ["RES", "Résistance"],
  ["REC", "Récupération"],
  ["ECH", "Échappée"],
  ["PRO", "Prologue"],
] as const;

const staffRoles = [
  {
    title: "Entraîneur",
    text: "Améliore la séance du coureur auquel il est affecté : +4 % par niveau sur sa spécialité, plus +10 % si les nationalités correspondent.",
  },
  {
    title: "Responsable de formation",
    text: "Encadre toute l’école de cyclisme : +2 % par niveau dans sa spécialité, +1 % par niveau via ses affixes et +5 % pour les juniors de sa nationalité. Un seul par équipe.",
  },
  {
    title: "Scout",
    text: "Explore son réseau mondial. Sa nationalité donne +15 % d’efficacité dans son propre pays.",
  },
  {
    title: "Médecin",
    text: "Raccourcit automatiquement la durée des nouvelles blessures de 6 % par niveau.",
  },
  {
    title: "Mécanicien",
    text: "Réduit le temps perdu lors des avaries techniques en course.",
  },
  {
    title: "Community manager",
    text: "Augmente les gains de réputation de 2 % par niveau.",
  },
  {
    title: "Nutritionniste",
    text: "Réduit le prix des compléments, améliore leur effet et soutient la récupération quotidienne.",
  },
  {
    title: "Kiné",
    text: "Protège uniquement les coureurs qui lui sont affectés contre les pertes de forme, notamment après la course.",
  },
  {
    title: "Préparateur de course",
    text: "Renforce le bonus temporaire obtenu lors d’une reconnaissance.",
  },
  {
    title: "Architecte",
    text: "Réduit le coût, le délai ou les deux lors du lancement d’un chantier d’infrastructure.",
  },
  {
    title: "Ingénieur R&D",
    text: "Pilote une recherche gratuite à la fois au laboratoire. Ses talents réduisent la durée ou améliorent les chances de réussite.",
  },
  {
    title: "Formateur",
    text: "Optimise les stages de l’Académie des métiers consacrés à la progression du staff.",
  },
] as const;

const pageDirectory = [
  {
    group: "Pilotage",
    pages: [
      ["Bureau du DS", "/jeu", "Vue d’ensemble, actualités, raccourcis et alertes."],
      ["Profil du DS", "/jeu/directeur-sportif", "Identité, réputation, niveau et équipe fondatrice."],
      ["Équipe", "/jeu/equipe", "Identité, effectif, contrats, palmarès et historique de l’équipe."],
      ["Objectifs", "/jeu/objectifs", "Progression et récupération manuelle des récompenses."],
      ["Finances", "/jeu/finances", "Solde, opérations et projection de fin de saison."],
      ["Messagerie", "/jeu/messagerie", "Discussions privées et négociations entre directeurs sportifs."],
    ],
  },
  {
    group: "Sportif",
    pages: [
      ["Effectif", "/jeu/effectif", "Coureurs, contrats, forme et planning saisonnier."],
      ["Entraînements", "/jeu/entrainement", "Séance quotidienne, intensité, domaine et entraîneur."],
      ["Centre de soin", "/jeu/centre-de-soin", "Blessures, kinés, nutrition et stages de forme."],
      ["Calendrier", "/jeu/calendrier", "Courses AM/PM, filtres et inscriptions."],
      ["Préparation course", "/jeu/preparation-course", "Rôles, matériel, ambitions publiques et reconnaissances."],
      ["Résultats / Live", "/jeu/resultats", "Répertoire des directs, replays et résultats officiels."],
      ["Classements UCI", "/jeu/classements", "Équipes, coureurs, nations et projection des divisions."],
      ["Championnats nationaux", "/jeu/championnats-nationaux", "Programme, sélection et résultats des titres nationaux."],
      ["Championnats internationaux", "/jeu/championnats-internationaux", "Courses continentales et mondiales, élites comme juniors."],
    ],
  },
  {
    group: "Développement",
    pages: [
      ["Staff", "/jeu/staff", "Marché de l’emploi et membres sous contrat."],
      ["Transferts", "/jeu/transferts", "Enchères quotidiennes, ventes des DS et recherche de coureurs."],
      ["Matériel", "/jeu/materiel", "Catalogue commercial et achats d’équipement."],
      ["Inventaire", "/jeu/inventaire", "Objets, consommables et matériel disponible."],
      ["Sponsoring", "/jeu/sponsoring", "Offres, contrat principal, budget et maillot."],
      ["Équipementier", "/jeu/materiel/equipementier", "Partenaire technique, contrat et équipement exclusif."],
      ["Infrastructures", "/jeu/infrastructures", "Data Room et centres internationaux à partir du niveau 10."],
      ["Centre de formation", "/jeu/centre-de-formation", "Scouting, école de cyclisme et jeunes talents."],
      ["Équipe de développement", "/jeu/centre-de-formation", "Effectif junior, calendrier simplifié et progression des espoirs."],
      ["Résultats juniors", "/jeu/calendrier", "Résultats officiels accessibles depuis le calendrier de développement."],
      ["Fan Club", "/jeu/fan-club", "Supporters, déplacements, ferveur et boutique du club."],
    ],
  },
  {
    group: "Univers",
    pages: [
      ["Recherche", "/jeu/recherche", "Retrouver un DS, une équipe ou une nation."],
      ["Chat du peloton", "/jeu/chat", "Discussions publiques, privées, fédérales et traductions."],
      ["Fédération", "/jeu/federation", "Vie fédérale, président, sélections, projets et finances nationales."],
      ["Sélections internationales", "/jeu/selections-internationales", "Répondre aux convocations continentales et mondiales."],
      ["Gazette", "/jeu/gazette", "Actualité éditoriale du peloton et jeux de chaque édition."],
      ["Palmarès d’équipe", "/jeu/equipe", "Titres, podiums, victoires d’étape et maillots distinctifs."],
      ["Rivalités", "/jeu/rivalites", "Confrontations sportives et histoire des duels entre équipes."],
      ["Parrainage", "/jeu/parrainage", "Invitations et suivi des filleuls."],
      ["Maillot", "/jeu/maillot", "Consulter les identités visuelles de l’équipe."],
    ],
  },
] as const;

const rewardCategories: ReadonlyArray<{
  code: RaceCategoryCode;
  label: string;
  note?: string;
}> = [
  { code: "local", label: "Locale", note: "Même barème que la catégorie Régionale." },
  { code: "regional", label: "Régionale" },
  { code: "national", label: "Nationale" },
  { code: "continental", label: "Continentale" },
  { code: "world", label: "World" },
  { code: "elite", label: "Élite" },
];

const rewardScopes: ReadonlyArray<{
  code: RaceRewardScope;
  label: string;
}> = [
  { code: "one_day", label: "Classique" },
  { code: "tour", label: "Classement général d’un tour" },
];

type GuideRewardRange = {
  firstRank: number;
  lastRank: number;
  reward: RaceReward;
};

export default function GuidePage() {
  return (
    <>
      <GuideHero />
      <GuideNavigation />
      <QuickStartSection />
      <DaySection />
      <RidersSection />
      <RacingSection />
      <RewardScalesSection />
      <TeamManagementSection />
      <SponsoringSection />
      <StructuresSection />
      <ProgressionSection />
      <PagesSection />
      <GuideCallToAction />
    </>
  );
}

function GuideHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3] text-[#082A2A]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-position-[68%_center] bg-no-repeat"
        style={{ backgroundImage: "url('/images/peloton-header.webp')" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,252,250,0.99)_0%,rgba(244,250,247,0.97)_38%,rgba(236,247,242,0.72)_65%,rgba(7,26,23,0.2)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(247,250,247,0.94)_100%)]"
      />
      <div className="relative mx-auto max-w-7xl px-5 py-18 sm:px-8 sm:py-24">
        <div className="max-w-4xl">
          <span className="inline-flex rounded-full bg-[#F2C94C] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#071A17] shadow-md">
            Manuel utilisateur · septembre 2026
          </span>
          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Le guide complet du
            <span className="mt-2 block text-[#42B99A]">Directeur Sportif.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg font-medium leading-8 text-[#25443F]">
            Comprendre les pages, organiser une journée de jeu, préserver la
            forme, faire progresser les coureurs et construire une équipe
            durable : tout le fonctionnement actuel de Cyclo Stratège est
            rassemblé ici.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <HeroMetric value="28" label="jours par saison" />
            <HeroMetric value="2" label="créneaux de course par jour" />
            <HeroMetric value="13" label="caractéristiques par coureur" />
            <HeroMetric value="1–5" label="niveaux de staff" />
          </div>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="#demarrage"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] !text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#FFD968]"
            >
              Commencer le tutoriel
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 10h13" />
                <path d="m11 5 5 5-5 5" />
              </svg>
            </Link>
            <Link
              href="/jeu"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-[#0B302B] bg-[#0B302B] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] !text-white transition hover:-translate-y-0.5 hover:bg-[#123f37]"
            >
              Ouvrir mon bureau
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideNavigation() {
  return (
    <nav
      aria-label="Sommaire du guide"
      className="z-30 border-y border-[#315B3E]/15 bg-[#FFFDF4]/95 px-5 py-3 text-[#082A2A] shadow-sm backdrop-blur-xl sm:px-8 lg:sticky lg:top-[89px]"
    >
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
        {guideNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-[#315B3E]/15 bg-white px-4 py-2 text-xs font-extrabold text-[#315B3E] transition hover:border-[#278B70] hover:bg-[#EAF5F3] hover:text-[#176951]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function QuickStartSection() {
  return (
    <GuideSection
      id="demarrage"
      eyebrow="La première heure"
      title="Lancer correctement votre carrière"
      introduction="Ces six actions installent les fondations de l’équipe. Elles débloquent aussi les premiers objectifs primaires et leurs récompenses."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {firstSteps.map((step) => (
          <article
            key={step.number}
            className="flex h-full flex-col rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)]"
          >
            <span className="text-sm font-black tracking-[0.18em] text-[#278B70]">
              {step.number}
            </span>
            <h3 className="mt-4 text-xl font-black tracking-tight text-[#082A2A]">
              {step.title}
            </h3>
            <p className="mt-3 flex-1 text-sm font-medium leading-6 text-[#60756E]">
              {step.text}
            </p>
            <Link
              href={step.href}
              className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-black text-[#176951] hover:text-[#0B302B]"
            >
              {step.linkLabel} <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </div>
      <StrategyNote title="Le bon réflexe">
        Ne remplissez pas le calendrier d’un leader dès le premier jour.
        Consultez son planning, sa forme et les profils de course avant chaque
        inscription.
      </StrategyNote>
    </GuideSection>
  );
}

function DaySection() {
  return (
    <GuideSection
      id="journee"
      eyebrow="Horloge de jeu"
      title="Une journée type dans Cyclo Stratège"
      introduction="La saison dure 28 jours. Chaque journée est divisée en deux demi-journées : AM pour la course de 14 h et PM pour celle de 18 h."
      tone="mint"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {daySchedule.map((entry) => (
          <article
            key={entry.time}
            className="rounded-[1.4rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.07)]"
          >
            <span className="inline-flex rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-black text-[#071A17]">
              {entry.time}
            </span>
            <h3 className="mt-4 text-lg font-black text-[#082A2A]">
              {entry.title}
            </h3>
            <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">
              {entry.text}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <RuleCard title="Tours">
          Les étapes s’enchaînent à raison d’une le matin et d’une l’après-midi.
          Un tour de 10 étapes occupe donc cinq jours de jeu.
        </RuleCard>
        <RuleCard title="Inscriptions">
          La startlist ne contient que les équipes et les coureurs réellement
          inscrits. Une course sans engagé n’est pas simulée, hors démonstration
          prévue pour le Critérium de Namur.
        </RuleCard>
        <RuleCard title="Équipement">
          Un changement reste possible jusqu’à cinq minutes avant le départ.
          La pièce choisie est ensuite figée pour la course concernée.
        </RuleCard>
      </div>
    </GuideSection>
  );
}

function RidersSection() {
  return (
    <GuideSection
      id="coureurs"
      eyebrow="Gestion sportive"
      title="Comprendre et faire progresser un coureur"
      introduction="Un bon profil ne se résume pas à sa moyenne. Le terrain, la forme du jour, le potentiel, l’équipement et le rôle tactique modifient sa capacité à performer."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[1.75rem] bg-[#0B302B] p-6 text-white shadow-[0_20px_50px_rgba(7,26,23,0.18)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9BE0BC]">
            Les 13 notes
          </p>
          <h3 className="mt-2 text-2xl font-black">Lire la fiche coureur</h3>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {riderRatings.map(([code, label]) => (
              <div
                key={code}
                className="rounded-xl border border-white/10 bg-white/8 px-3 py-3"
              >
                <strong className="block text-sm text-[#F2C94C]">{code}</strong>
                <span className="mt-1 block text-xs font-semibold text-[#D6DFD2]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#278B70]">
            Potentiel
          </p>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            De 0,5 à 4 étoiles
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Le potentiel plafonne la moyenne possible sur les treize
            caractéristiques. Chaque demi-étoile ajoute cinq points au plafond
            de base de 60.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-sm font-bold text-[#315B3E]">
            {[
              ["0,5 ★", "65 max."],
              ["1 ★", "70 max."],
              ["2 ★", "80 max."],
              ["3 ★", "90 max."],
              ["4 ★", "100 max."],
            ].map(([stars, cap]) => (
              <div
                key={stars}
                className="flex items-center justify-between rounded-xl bg-[#EAF5F3] px-3 py-2.5"
              >
                <span>{stars}</span>
                <span className="text-[#176951]">{cap}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Forme et énergie</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Deux indicateurs à ne pas confondre
          </h3>
          <dl className="mt-6 grid gap-4">
            <Definition
              term="Forme"
              text="État durable du coureur, de 0 à 100, avant une course. Elle varie avec l’entraînement, les courses, le repos, les soins et les stages."
            />
            <Definition
              term="Énergie"
              text="Réserve individuelle utilisée uniquement pendant la simulation. Un équipier qui roule ou un échappé dépense davantage ; un leader protégé peut se préserver."
            />
            <Definition
              term="Fatigue"
              text="L’ancien champ séparé n’est plus utilisé dans l’interface : la gestion quotidienne repose sur la forme, tandis que le live suit l’énergie propre à chaque coureur."
            />
          </dl>
          <div className="mt-5 rounded-xl border border-[#C94F4F]/20 bg-[#FFF3F0] px-4 py-3 text-sm font-bold leading-6 text-[#8A3830]">
            Si une perte devait faire passer la forme sous 0, elle reste à 0 et
            un coureur disponible subit une blessure de fatigue de trois jours.
            Cette règle ne se cumule jamais avec une blessure déjà active.
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Entraînement quotidien</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Progresser sans épuiser l’effectif
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            La séance est traitée à 8 h. Chaque coureur possède sa propre
            intensité, son domaine et, éventuellement, un entraîneur. Le seuil
            minimum de forme s’applique à toute l’équipe.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {TRAINING_DOMAINS.map((domain) => (
              <span
                key={domain}
                className="rounded-full bg-[#EAF5F3] px-3 py-2 text-xs font-extrabold text-[#176951]"
              >
                {TRAINING_DOMAIN_LABELS[domain]}
              </span>
            ))}
          </div>
          <ul className="mt-6 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• 50 % d’intensité est neutre pour la forme.</li>
            <li>• Au-dessus de 50 %, la progression coûte de la forme.</li>
            <li>• En dessous de 50 %, la séance peut rendre jusqu’à 2 points.</li>
            <li>
              • Sous le seuil décidé par le DS, le coureur se repose et récupère
              2 points au lieu de s’entraîner.
            </li>
            <li>
              • Une reconnaissance, une blessure ou un stage rend le coureur
              indisponible pour la séance.
            </li>
          </ul>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#315B3E]/10">
            <table className="w-full min-w-[420px] text-center text-xs">
              <thead className="bg-[#0B302B] text-white"><tr><th className="px-2 py-2.5">Intensité</th><th className="px-2 py-2.5">0 %</th><th className="px-2 py-2.5">25 %</th><th className="px-2 py-2.5">50 %</th><th className="px-2 py-2.5">60 %</th><th className="px-2 py-2.5">80 %</th><th className="px-2 py-2.5">100 %</th></tr></thead>
              <tbody className="bg-white font-bold text-[#48665F]"><tr><th className="px-2 py-2.5 text-left text-[#176951]">Forme</th><td className="px-2 py-2.5">+2</td><td className="px-2 py-2.5">+1</td><td className="px-2 py-2.5">0</td><td className="px-2 py-2.5">−5</td><td className="px-2 py-2.5">−15</td><td className="px-2 py-2.5">−25</td></tr></tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <RuleCard title="Repos naturel">
          Un jour complet sans course, blessure ni stage rend automatiquement 2
          points de forme.
        </RuleCard>
        <RuleCard title="Malus de course">
          Une classique coûte 10 points de forme. Sur un tour, la perte par
          étape dépend notamment de la récupération du coureur et reste comprise
          entre 5 et 10 avant protection.
        </RuleCard>
        <RuleCard title="Âge">
          La progression ralentit avec l’âge. À partir de 32 ans, l’entraînement
          sert surtout à limiter le déclin et ne permet plus de dépasser la note
          de début de saison.
        </RuleCard>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Poids et morphologie</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Le physique compte selon le terrain
          </h3>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• Un coureur léger est avantagé dans les longues montées ; l’effet augmente avec la pente et la longueur de l’ascension.</li>
            <li>• Un gabarit plus puissant est davantage valorisé sur le plat, les pavés et, plus légèrement, en contre-la-montre ou en descente.</li>
            <li>• Le poids ne remplace jamais les notes : il les nuance dans une limite bornée et ne peut pas transformer un mauvais grimpeur en leader de montagne.</li>
            <li>• Les jeunes grandissent jusqu’à leur morphologie adulte. Leur taille et leur poids projetés restent visibles au Centre de formation.</li>
          </ul>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#315B3E]/10">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="bg-[#0B302B] text-white">
                <tr><th className="px-3 py-2.5">Terrain</th><th className="px-3 py-2.5">Influence maximale du profil physique</th><th className="px-3 py-2.5">Lecture</th></tr>
              </thead>
              <tbody className="divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]">
                <tr><td className="px-3 py-2.5">Montagne</td><td className="px-3 py-2.5">±4,5</td><td className="px-3 py-2.5">Avantage au gabarit léger</td></tr>
                <tr><td className="px-3 py-2.5">Vallons</td><td className="px-3 py-2.5">±3</td><td className="px-3 py-2.5">Avantage modéré au gabarit léger</td></tr>
                <tr><td className="px-3 py-2.5">Pavés</td><td className="px-3 py-2.5">−3 à +2,2</td><td className="px-3 py-2.5">Puissance valorisée, excès de poids pénalisé</td></tr>
                <tr><td className="px-3 py-2.5">Plat / sprint</td><td className="px-3 py-2.5">−4 à +1,8</td><td className="px-3 py-2.5">Puissance valorisée, excès de poids pénalisé</td></tr>
                <tr><td className="px-3 py-2.5">Contre-la-montre</td><td className="px-3 py-2.5">−4 à +1,6</td><td className="px-3 py-2.5">Taille et puissance valorisées sans surpoids excessif</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs font-semibold leading-5 text-[#60756E]">
            Le tracé affine encore cet effet secteur par secteur : jusqu’à ±4,5
            sur une ascension difficile, de −3 à +2,2 sur pavés, de −2,2 à +2,2
            sur gravier, ±1,2 en descente et de −4 à +1 sur le plat.
            Ces valeurs sont des équivalents de note,
            pas des points ajoutés aux caractéristiques permanentes.
          </p>
          <div className="mt-5 rounded-xl bg-[#FFF9DF] px-4 py-3 text-sm font-bold leading-6 text-[#705B00]">
            Avec un nutritionniste actif, l’affûtage allège et l’athlétisation renforce le coureur de 0,2 à 1 kg. Les deux sens partagent un délai de cinq jours ; chaque tranche de 0,2 kg coûte 4 points de forme. Ces programmes restent optionnels dans la rubrique nutrition et se valident avec les compléments. La perte de poids est limitée par un poids de sécurité ; la prise de poids ne peut dépasser 120 kg.
          </div>
          <p className="mt-4 text-sm font-medium leading-6 text-[#60756E]">
            Les compléments nutritionnels rendent de la forme mais comportent un faible risque de prise de poids, clairement affiché avant validation. Un meilleur nutritionniste réduit ce risque.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Moral</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            De « Abattu » à « Euphorique »
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Le moral va de 0 à 100 et débute à 60. Il influence l’exécution en course, sans modifier les notes permanentes ni remplacer la forme. Un moral faible pénalise légèrement plus qu’un moral très élevé ne bonifie.
          </p>
          <p className="mt-4 rounded-xl bg-[#F3F8F6] px-4 py-3 text-xs font-bold leading-5 text-[#48665F]">
            Abattu : 0–24 · Fragile : 25–44 · Stable : 45–64 · Confiant : 65–79 · Euphorique : 80–100. En contre-la-montre, l’influence du moral est réduite de moitié.
          </p>
          <dl className="mt-5 grid gap-2">
            <Definition term="Résultats" text="Victoire d’étape : +4 ; autre podium d’étape : +2. Victoire finale d’un tour : +5 ; autre podium final : +3." />
            <Definition term="Blessure" text="−3, −6 ou −9 selon qu’elle est légère, modérée ou grave." />
            <Definition term="Surcharge" text="Les fortes intensités répétées avec une forme basse peuvent retirer 1 ou 2 points." />
            <Definition term="Collectif" text="L’ancienneté et la présence de compatriotes favorisent l’intégration ; l’isolement peut coûter 3 points." />
          </dl>
          <p className="mt-4 text-sm font-bold leading-6 text-[#176951]">
            Les décisions de zone mixte peuvent également faire évoluer le moral. L’historique de chaque variation est visible sur la fiche du coureur.
          </p>
        </article>
      </div>

      <RiderWeightGuideTables />

      <details className="group mt-7 overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.08)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 marker:content-none [&::-webkit-details-marker]:hidden sm:px-8">
          <div>
            <SectionLabel>Barème d’entraînement</SectionLabel>
            <h3 className="mt-1 text-xl font-black text-[#082A2A]">Poids exact de chaque domaine</h3>
          </div>
          <span aria-hidden="true" className="text-xl font-black text-[#278B70] transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-[#315B3E]/10 px-6 pb-7 pt-5 sm:px-8">
          <p className="text-sm font-medium leading-6 text-[#60756E]">
            Une note prioritaire reçoit 100 % du gain de base, une note secondaire 55 % et une note d’entretien 10 %. L’âge, le potentiel, la note actuelle, l’intensité, les infrastructures et l’entraîneur modulent ensuite ce gain.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#315B3E]/15 text-xs uppercase tracking-wide text-[#176951]">
                  <th className="px-3 py-3">Domaine</th>
                  <th className="px-3 py-3">Prioritaires · 100 %</th>
                  <th className="px-3 py-3">Secondaires · 55 %</th>
                  <th className="px-3 py-3">Autres · 10 %</th>
                </tr>
              </thead>
              <tbody>
                {TRAINING_DOMAINS.map((domain) => {
                  const groups = getTrainingDomainWeightGroups(domain);
                  return (
                    <tr key={domain} className="border-b border-[#315B3E]/10 align-top last:border-0">
                      <th className="px-3 py-3 font-black text-[#0B302B]">{TRAINING_DOMAIN_LABELS[domain]}</th>
                      {groups.map((group) => (
                        <td key={group.tier} className="px-3 py-3 font-medium leading-6 text-[#60756E]">
                          {group.stats.map((stat) => stat.shortLabel).join(" · ")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs font-bold leading-5 text-[#60756E]">
            L’entraîneur ajoute +4 % par niveau sur les notes de sa spécialité et +10 % sur toute la séance lorsqu’il partage la nationalité du coureur. Les deux bonus sont cumulables.
          </p>
        </div>
      </details>

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <RuleCard title="Statut dans l’effectif">
          Leader absolu, co-leader, capitaine de route, lieutenant, électron libre, chasseur d’étapes, espoir, équipier ou porteur de bidons : ce statut sert à organiser et trier l’effectif. Le rôle choisi pour une course reste indépendant.
        </RuleCard>
        <RuleCard title="Courses préférées">
          Chaque coureur peut posséder jusqu’à trois courses préférées par saison. Il y reçoit +2 sur ses treize notes de course, sans modifier ses caractéristiques permanentes, et gagne aussi du moral en y participant.
        </RuleCard>
        <RuleCard title="Palmarès durable">
          Les fiches conservent les victoires, podiums, titres, maillots distinctifs, victoires d’étape et saisons de Development Team, même après un transfert ou la retraite.
        </RuleCard>
      </div>

      <StrategyNote title="Plan de gestion recommandé">
        Réservez les fortes intensités aux périodes sans objectif immédiat,
        placez le seuil de repos assez haut avant un grand tour et affectez vos
        meilleurs entraîneurs aux coureurs dont la spécialité correspond.
      </StrategyNote>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <RuleCard title="Progression des coureurs libres">
          Les coureurs sans équipe suivent chaque matin un entraînement autonome
          modéré, orienté vers leurs points forts. Leur progression respecte
          leur potentiel, leur âge et les plafonds habituels, sans les bonus
          d’entraîneur ou de bâtiments d’une équipe. Une blessure ou une forme
          inférieure à 50 empêche la progression du jour ; le déclin lié à l’âge
          reste applicable. Dès leur recrutement, le programme de l’équipe prend
          le relais, sans double séance.
        </RuleCard>
        <RuleCard title="Retraite des coureurs libres">
          Un coureur libre peut partir à la retraite après deux saisons complètes
          et consécutives sans équipe. Une saison passée même partiellement sous
          contrat ne compte pas. Les coureurs ayant marqué des points UCI comme
          agents libres restent préservés. Les fiches et les palmarès des
          retraités demeurent consultables.
        </RuleCard>
      </div>
    </GuideSection>
  );
}

function RacingSection() {
  return (
    <GuideSection
      id="courses"
      eyebrow="Compétition"
      title="Du calendrier au résultat officiel"
      introduction="Chaque course suit une chaîne précise : inscription, gel de la startlist, live, classement d’étape ou de classique, puis récompenses et mise à jour des classements."
      tone="mint"
    >
      <div className="grid gap-5 lg:grid-cols-4">
        {[
          ["1", "Choisir", "Filtrez par catégorie et étudiez le profil tronçonné, les GPM, les sprints intermédiaires et les horaires."],
          ["2", "Inscrire", "Composez une startlist valide en respectant la taille d’effectif, la disponibilité et les critères de l’épreuve."],
          ["3", "Suivre", "Ouvrez la fenêtre dédiée du live. Les groupes, incidents, météo, énergie, attaques et commentaires évoluent en direct."],
          ["4", "Analyser", "Consultez le résultat d’étape, le général du tour, les classements secondaires et la liste des échappés."],
        ].map(([number, title, text]) => (
          <article
            key={number}
            className="rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_14px_38px_rgba(19,60,46,0.07)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B302B] text-sm font-black text-[#F2C94C]">
              {number}
            </span>
            <h3 className="mt-4 text-xl font-black text-[#082A2A]">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">
              {text}
            </p>
          </article>
        ))}
      </div>

      <details className="group mt-7 overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#082A2A] sm:px-6">
          <span>Reconnaître une course ou une étape</span>
          <span aria-hidden="true" className="text-xl text-[#278B70] group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-6 border-t border-[#315B3E]/10 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] sm:p-6">
          <div className="text-sm font-medium leading-7 text-[#60756E]">
            <p>
              La reconnaissance dure {RACE_RECONNAISSANCE_DURATION_DAYS} jours
              et doit se terminer avant le départ. Elle cible une classique ou
              une étape précise et donne temporairement +{RACE_RECONNAISSANCE_BASE_BONUS}
              sur les treize notes du coureur pour cette cible.
            </p>
            <p className="mt-3">
              Le préparateur de course améliore le bonus de 5 % par niveau. Sa
              spécialisation logistique négociée peut aussi réduire le prix de
              4 % par niveau.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#315B3E]/10">
            <table className="w-full min-w-[430px] text-left text-xs">
              <thead className="bg-[#0B302B] text-white"><tr><th className="px-3 py-2.5">Catégorie</th><th className="px-3 py-2.5">Classique</th><th className="px-3 py-2.5">Étape de tour</th></tr></thead>
              <tbody className="divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]">
                {rewardCategories.map((category) => (
                  <tr key={category.code}><td className="px-3 py-2.5 font-black text-[#176951]">{category.label}</td><td className="px-3 py-2.5">{formatGuideMoney(getRaceReconnaissanceCost({ categoryCode: category.code, raceFormat: "one_day" }))}</td><td className="px-3 py-2.5">{formatGuideMoney(getRaceReconnaissanceCost({ categoryCode: category.code, raceFormat: "stage_race" }))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] bg-[#0B302B] p-6 text-white sm:p-8">
          <SectionLabel light>Ce que simule le live</SectionLabel>
          <h3 className="mt-2 text-2xl font-black">
            Une course individuelle au sein de groupes
          </h3>
          <ul className="mt-6 grid gap-3 text-sm font-semibold leading-6 text-[#D6DFD2] sm:grid-cols-2">
            <li>• Départ sans échappée préformée</li>
            <li>• Attaques, contre-attaques et chasse</li>
            <li>• Peloton, groupes fusionnés et coureurs lâchés</li>
            <li>• Énergie propre à chaque coureur</li>
            <li>• Crevaisons, chutes et abandons</li>
            <li>• Vent, bordures et pluie visible</li>
            <li>• Routes, pavés et biotopes cohérents</li>
            <li>• Grupetto sur les longues ascensions</li>
            <li>• GPM, SI et ligne d’arrivée</li>
            <li>• Écarts réels sur les arrivées sélectives</li>
          </ul>
          <p className="mt-5 rounded-xl bg-white/8 px-4 py-3 text-sm font-semibold leading-6 text-[#BFD1C6]">
            Un coureur très attardé ne récupère pas artificiellement un écart
            énorme. Il peut profiter d’une descente, mais son retour dépend
            toujours de son niveau, de son énergie et de l’allure des groupes.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Résultats d’un tour</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Plusieurs classements, plusieurs enjeux
          </h3>
          <div className="mt-6 grid gap-3">
            <Definition term="Étape" text="Ordre d’arrivée et écarts par rapport au vainqueur de l’étape." />
            <Definition term="Général" text="Somme des temps après chaque étape, puis classement final du tour." />
            <Definition term="Montagne" text="Points gagnés aux GPM et sur les arrivées difficiles." />
            <Definition term="Sprint" text="Points gagnés aux SI et sur les arrivées plates." />
            <Definition term="Jeunes" text="Meilleur coureur âgé de moins de 25 ans." />
            <Definition term="Équipes" text="Classement calculé à partir des temps des coureurs de chaque équipe." />
          </div>
        </article>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <RuleCard title="Temps et écarts">
          Sur une arrivée massive, les coureurs du même groupe reçoivent le
          même temps, noté MT. Hors sprint massif, une seconde de séparation
          suffit pour afficher un écart réel : le dernier effort peut donc
          étirer fortement une arrivée vallonnée ou montagneuse.
        </RuleCard>
        <RuleCard title="Abandon">
          Un coureur qui abandonne reste dans le résultat, placé en fin de
          classement avec la mention « Abandon ». Sur un tour, il ne repart pas.
        </RuleCard>
        <RuleCard title="Primes d’étape">
          Les tops d’étape rapportent de l’argent. Sur un tour, toutes ces primes
          sont comptabilisées et versées au jour de la dernière étape.
        </RuleCard>
        <RuleCard title="Prix de la combativité">
          Chaque étape en ligne et chaque classique récompense le coureur qui a
          le plus animé la course. Les kilomètres à l’avant, les relais, les
          attaques et l’écart créé comptent ; un tour désigne aussi son
          super-combatif en cumulant toutes les étapes.
        </RuleCard>
      </div>

      <StrategyNote title="Catégories et wildcards">
        Les courses Continentales demandent 100 points de réputation et les
        Mondiales 200. Les équipes Élite s’inscrivent directement aux courses
        Élite ; les autres divisions peuvent demander une invitation avec huit
        à neuf coureurs. À J-1, l’organisateur départage les demandes selon la
        nationalité de l’équipe et du sponsor principal, la réputation, le
        niveau du meilleur coureur aligné pour le profil et, dès la saison 4,
        l’éventuel appui de réputation engagé.
      </StrategyNote>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Rôles en course</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">Une hiérarchie qui s’adapte au scénario</h3>
          <dl className="mt-5 grid gap-2">
            <Definition term="Leader" text="Protégé pour les secteurs décisifs et prioritaire lorsque des équipiers doivent ramener un groupe." />
            <Definition term="Sprinteur" text="Prioritaire pour le train, les sprints intermédiaires et une arrivée massive, sans protection énergétique de leader." />
            <Definition term="Leader / sprint" text="Cumule la protection pendant l’étape et la priorité au sprint final." />
            <Definition term="Protégé" text="Économise ses forces sans passer devant le leader dans la répartition des équipiers." />
            <Definition term="Poisson pilote" text="Travaille pour placer et lancer le sprinteur dans un final groupé." />
            <Definition term="Électron libre" text="Cherche davantage l’échappée et conserve une liberté tactique." />
            <Definition term="Équipier" text="Poursuit, protège ou accompagne un coureur en difficulté, avec une dépense d’énergie supérieure." />
          </dl>
          <p className="mt-4 text-sm font-bold leading-6 text-[#176951]">
            Un coureur protégé qui n’a pas les jambes pour suivre n’est jamais artificiellement sauvé. L’équipe peut lui laisser un accompagnateur pour limiter les dégâts ou rejoindre un grupetto, tandis que les autres équipiers se recentrent sur le leader.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Chronos</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">Effort individuel et cohésion collective</h3>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• En CLM et en prologue, « S’économiser » réduit le rythme et les coûts d’énergie et de forme ; « Tout donner » améliore le chrono mais augmente fortement ces coûts.</li>
            <li>• En CLM par équipes, les relais doivent totaliser exactement 100 %. Leur répartition fixe la contribution de chaque coureur au rythme collectif.</li>
            <li>• Le leader et le coureur protégé sont attendus par le collectif. Les autres peuvent cesser de relayer avant de décrocher réellement.</li>
            <li>• Une équipe complète peut sacrifier jusqu’à trois coureurs, mais le chrono conserve toujours un noyau minimal de quatre unités.</li>
            <li>• Perdre des équipiers réduit progressivement la cohésion : d’excellents rouleurs isolés ne conservent pas la puissance d’une formation complète.</li>
          </ul>
        </article>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <RuleCard title="Jonction des groupes">
          Lorsqu’un groupe en rejoint un autre, ils fusionnent réellement. Les coureurs partagent alors la même dynamique, les mêmes écarts et les nouvelles priorités collectives ; deux groupes superposés ne continuent pas à se concurrencer.
        </RuleCard>
        <RuleCard title="Grupetto et délais">
          En montagne, les coureurs trop faibles pour suivre les favoris cherchent à former un grupetto afin d’économiser leurs forces et de finir dans les délais. Les plus épuisés peuvent encore lâcher ce groupe et terminer hors délai.
        </RuleCard>
        <RuleCard title="Journal de course">
          La page de résultat propose un rapport repliable d’environ 20 à 30 lignes : échappées marquantes, pics d’écart, jonctions, attaques finales, reprises, avaries, chutes et victoire.
        </RuleCard>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <RuleCard title="Courses régionales et locales">
          Une Régionale est réservée aux équipes amateures de son continent. À partir de la saison 4, chaque pays actif reçoit quatre classiques locales et un mini-tour : seules les équipes de ce pays les voient dans leur calendrier et peuvent s’y inscrire. Leur page et leurs résultats restent consultables par tous.
        </RuleCard>
        <RuleCard title="Prologues et calendrier S4">
          Les prologues sont de très courts contre-la-montre placés au début de certains tours. Dès la saison 4, le calendrier accueille davantage de pays, des profils plus variés et moins de finales en CLM par équipes.
        </RuleCard>
      </div>
    </GuideSection>
  );
}

function RewardScalesSection() {
  return (
    <GuideSection
      id="baremes"
      eyebrow="Récompenses officielles"
      title="Tous les barèmes de course"
      introduction="Les barèmes de résultat ci-dessous sont ceux de la saison 4 et des saisons suivantes ; les saisons 1 à 3 conservent leurs montants historiques. Le prix de la combativité s’applique dès son introduction. La catégorie Locale reprend exactement le barème Régional."
      tone="mint"
    >
      <div className="grid gap-5 md:grid-cols-3">
        <RuleCard title="Ce que rapporte un résultat">
          La réputation revient au Directeur Sportif, l’XP fait progresser son
          niveau, l’argent alimente l’équipe et les points UCI classent le
          coureur, l’équipe et sa nation. Une valeur absente vaut zéro.
        </RuleCard>
        <RuleCard title="Tours et étapes">
          Le classement général et chaque étape possèdent leur propre barème.
          Les classements de la montagne, des sprints, des jeunes et par équipes
          ajoutent une récompense distincte.
        </RuleCard>
        <RuleCard title="Contre-la-montre par équipes">
          La récompense d’un résultat collectif est créditée une seule fois à
          l’équipe. Elle n’est pas multipliée par le nombre de coureurs classés.
        </RuleCard>
        <RuleCard title="Combatif et super-combatif">
          Le prix rapporte une petite prime à l’équipe et de l’XP au coureur,
          sans réputation ni points UCI. Sur une classique, le prix d’étape est
          le trophée de la course ; sur un tour, le super-combatif ajoute un
          second gain au cumul des trophées d’étape.
        </RuleCard>
      </div>

      <div className="mt-7 space-y-4">
        {rewardCategories.map((category) => {
          const scopes =
            category.code === "elite"
              ? [...rewardScopes, { code: "grand_tour" as const, label: "Grand Tour" }]
              : rewardScopes;

          return (
            <details
              key={category.code}
              className="group overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#082A2A] sm:px-6">
                <span>
                  Catégorie {category.label}
                  {category.note ? (
                    <span className="ml-3 text-xs font-bold text-[#60756E]">
                      {category.note}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden="true" className="text-xl text-[#278B70] group-open:rotate-45">+</span>
              </summary>
              <div className="grid gap-6 border-t border-[#315B3E]/10 p-5 xl:grid-cols-2 sm:p-6">
                {scopes.map((scope) => (
                  <RewardTable
                    key={scope.code}
                    title={scope.label}
                    ranges={buildGuideRewardRanges(
                      (rank) =>
                        calculateRaceReward({
                          gameYear: 4,
                          tier: category.code,
                          scope: scope.code,
                          finalRank: rank,
                        }),
                      scope.code === "grand_tour" ? 60 : 50,
                    )}
                  />
                ))}
                <RewardTable
                  title="Résultat d’étape"
                  ranges={buildGuideRewardRanges(
                    (rank) =>
                      calculateStageReward({
                        gameYear: 4,
                        tier: category.code,
                        finalRank: rank,
                      }),
                    20,
                  )}
                />
                <RaceBonusesTable tier={category.code} />
                <CombativityRewardsTable tier={category.code} />
              </div>
            </details>
          );
        })}
      </div>

      <details className="group mt-7 overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#082A2A] sm:px-6">
          <span>Championnats nationaux, continentaux et mondiaux</span>
          <span aria-hidden="true" className="text-xl text-[#278B70] group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-6 border-t border-[#315B3E]/10 p-5 xl:grid-cols-3 sm:p-6">
          <RewardTable
            title="Championnat national"
            ranges={buildGuideRewardRanges(
              (rank) =>
                calculateNationalChampionshipReward({ gameYear: 4, finalRank: rank }),
              30,
            )}
          />
          <RewardTable
            title="Championnat continental"
            ranges={buildGuideRewardRanges(
              (rank) =>
                calculateInternationalChampionshipReward({
                  gameYear: 4,
                  competitionType: "continental_championship",
                  finalRank: rank,
                }),
              40,
            )}
          />
          <RewardTable
            title="Championnat du monde"
            ranges={buildGuideRewardRanges(
              (rank) =>
                calculateInternationalChampionshipReward({
                  gameYear: 4,
                  competitionType: "world_championship",
                  finalRank: rank,
                }),
              50,
            )}
          />
        </div>
      </details>
    </GuideSection>
  );
}

function RewardTable({
  title,
  ranges,
}: {
  title: string;
  ranges: readonly GuideRewardRange[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-lg font-black text-[#082A2A]">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-[#315B3E]/10">
        <table className="w-full min-w-[470px] text-left text-xs">
          <thead className="bg-[#0B302B] text-white">
            <tr>
              <th className="px-3 py-2.5">Place</th>
              <th className="px-3 py-2.5">Rép.</th>
              <th className="px-3 py-2.5">XP</th>
              <th className="px-3 py-2.5">Prime</th>
              <th className="px-3 py-2.5">UCI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]">
            {ranges.map((range) => (
              <tr key={`${range.firstRank}-${range.lastRank}`}>
                <td className="px-3 py-2.5 font-black text-[#176951]">
                  {formatGuideRankRange(range)}
                </td>
                <td className="px-3 py-2.5">{formatGuideNumber(range.reward.reputation)}</td>
                <td className="px-3 py-2.5">{formatGuideNumber(range.reward.experience)}</td>
                <td className="px-3 py-2.5">{formatGuideMoney(range.reward.cashPrize)}</td>
                <td className="px-3 py-2.5">{formatGuideNumber(range.reward.uciPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RaceBonusesTable({ tier }: { tier: RaceCategoryCode }) {
  const secondary = calculateRaceReward({
    gameYear: 4,
    tier,
    scope: "tour",
    finalRank: null,
    secondaryClassifications: ["mountain"],
  });
  const prime = calculateRaceReward({
    gameYear: 4,
    tier,
    scope: "tour",
    finalRank: null,
    mountainPrimesWon: 1,
  });

  return (
    <div className="min-w-0">
      <h3 className="text-lg font-black text-[#082A2A]">Bonus d’un tour</h3>
      <div className="mt-3 space-y-3 rounded-xl border border-[#315B3E]/10 bg-[#F3F8F6] p-4 text-sm font-semibold leading-6 text-[#48665F]">
        <p>
          <strong className="text-[#176951]">Classement distinctif :</strong>{" "}
          {formatGuideReward(secondary)} pour chacun des classements montagne,
          sprints, jeunes et équipes remporté.
        </p>
        <p>
          <strong className="text-[#176951]">Prime GPM ou SI :</strong>{" "}
          {formatGuideReward(prime)} par grand prix de la montagne ou sprint
          intermédiaire remporté.
        </p>
      </div>
    </div>
  );
}

function CombativityRewardsTable({ tier }: { tier: RaceCategoryCode }) {
  const stageReward = calculateCombativityReward({ tier, scope: "stage" });
  const tourReward = calculateCombativityReward({ tier, scope: "tour" });

  return (
    <div className="min-w-0">
      <h3 className="text-lg font-black text-[#082A2A]">Combativité</h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-[#315B3E]/10">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B302B] text-white">
            <tr>
              <th className="px-3 py-2.5">Trophée</th>
              <th className="px-3 py-2.5">XP</th>
              <th className="px-3 py-2.5">Prime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]">
            <tr>
              <td className="px-3 py-2.5 font-black text-[#176951]">
                Étape / classique
              </td>
              <td className="px-3 py-2.5">
                {formatGuideNumber(stageReward.experience)}
              </td>
              <td className="px-3 py-2.5">
                {formatGuideMoney(stageReward.cashPrize)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 font-black text-[#176951]">
                Super-combatif du tour
              </td>
              <td className="px-3 py-2.5">
                {formatGuideNumber(tourReward.experience)}
              </td>
              <td className="px-3 py-2.5">
                {formatGuideMoney(tourReward.cashPrize)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamManagementSection() {
  return (
    <GuideSection
      id="equipe"
      eyebrow="Construire l’équipe"
      title="Staff, transferts, matériel et santé"
      introduction="La performance vient de l’ensemble de la structure. Les bonus compatibles se cumulent ; entraîneurs et kinés n’agissent toutefois que sur les coureurs auxquels ils sont affectés."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {staffRoles.map((role) => (
          <article
            key={role.title}
            className="rounded-[1.4rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.06)]"
          >
            <h3 className="text-lg font-black text-[#082A2A]">{role.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">
              {role.text}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <FeatureCard
          eyebrow="Transferts"
          title="Trois façons de recruter"
          href="/jeu/transferts"
          bullets={[
            "Enchères quotidiennes, de 9 h à 18 h",
            "Ventes entre DS pendant 24 heures",
            "Recherche de coureurs libres ou sous contrat",
            "Contrats couvrant la saison actuelle et la suivante",
            "Un seul changement et deux équipes maximum par coureur et par saison",
          ]}
        />
        <FeatureCard
          eyebrow="Matériel"
          title="Huit emplacements"
          href="/jeu/materiel"
          bullets={[
            "Casque, gants, cuissard et lunettes",
            "Chaussures, roue avant et roue arrière",
            "Cadre",
            "Bonus de notes, de chrono, de protection ou de réputation",
            "Un exemplaire ne peut équiper qu’un seul coureur",
          ]}
        />
        <FeatureCard
          eyebrow="Centre de soin"
          title="Prévenir plutôt que subir"
          href="/jeu/centre-de-soin"
          bullets={[
            "Diagnostic et date de reprise",
            "Protocoles médicaux payants",
            "Compléments nutritionnels",
            "Stages classiques : +10 forme par jour",
            "Stages premium : +20 forme par jour",
            "Bonus d’efficacité des médecins et programmation groupée",
          ]}
        />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Soins et convalescence</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Trois protocoles médicaux
          </h3>
          <div className="mt-5 space-y-3">
            {Object.entries(MEDICAL_PROTOCOLS).map(([code, protocol]) => (
              <div key={code} className="rounded-xl bg-[#F3F8F6] px-4 py-3">
                <p className="font-black text-[#176951]">
                  {protocol.label} · {formatGuideMoney(protocol.price)}
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[#60756E]">
                  {protocol.description}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#48665F]">
            Le diagnostic détermine la durée de base et le risque d’abandon. Le
            médecin réduit automatiquement les nouvelles blessures de 6 % par
            niveau ; un protocole choisi agit ensuite sur la durée ou la perte
            de forme indiquée.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Forme et nutrition</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Recharger sans ignorer le poids
          </h3>
          <div className="mt-5 space-y-3">
            {Object.entries(FORM_CAMP_TYPES).map(([code, camp]) => (
              <p key={code} className="rounded-xl bg-[#FFF9DF] px-4 py-3 text-sm font-semibold leading-6 text-[#715F2A]">
                <strong>{camp.label} :</strong> +{camp.formGainPerDay} forme et {formatGuideMoney(camp.pricePerDay)} par jour, pendant 1 à 3 jours.
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#48665F]">
            Les niveaux cumulés des médecins améliorent les stages de 5 % par
            niveau, avec un maximum de +50 %. Une programmation groupée ne
            permet jamais à un même coureur de dépasser 100 de forme.
          </p>
          <div className="mt-5 space-y-3">
            {Object.entries(NUTRITION_INTERVENTIONS).map(([code, intervention]) => (
              <div key={code} className="rounded-xl bg-[#F3F8F6] px-4 py-3 text-sm font-medium leading-6 text-[#60756E]">
                <p className="font-black text-[#176951]">
                  {intervention.label} · niveau {intervention.minimumNutritionistLevel}
                </p>
                <p>
                  +{intervention.baseFormGain} forme de base, {formatGuideMoney(intervention.basePrice)} avant réduction du nutritionniste ; faible risque affiché de +{String(intervention.possibleWeightGainKg).replace(".", ",")} kg.
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <RuleCard title="Capacité de l’effectif">
          Une équipe dispose de 35 places professionnelles. Le Pôle de gestion
          sportive en ajoute cinq par niveau ; sa spécialisation Passerelle
          espoirs réserve en plus 3, 4 puis 5 places aux coureurs formés au club.
        </RuleCard>
        <RuleCard title="Contrats et salaires">
          Les contrats portent sur deux saisons. Le salaire d’un professionnel
          dépend de son niveau global et de ses résultats de la saison
          précédente ; un amateur ne perçoit pas de salaire.
        </RuleCard>
        <RuleCard title="Équipe de développement">
          L’effectif junior se construit de J1 à J7 puis se verrouille à J8. Son
          calendrier se simule sans live ; les podiums font progresser les
          coureurs selon leur profil, en favorisant leurs notes les plus basses.
        </RuleCard>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-[#FFF9DF] p-6 sm:p-8">
          <SectionLabel>Inventaire</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Les récompenses ne sont pas toujours automatiques
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            L’inventaire regroupe le matériel acheté, les objets de capacité
            spéciale, les boosts de potentiel et les boosts de statistique. Un
            consommable doit être attribué au coureur choisi avant d’appliquer
            son effet.
          </p>
          <Link
            href="/jeu/inventaire"
            className="mt-5 inline-flex font-black text-[#176951] hover:text-[#0B302B]"
          >
            Gérer l’inventaire →
          </Link>
        </article>
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-[#EAF5F3] p-6 sm:p-8">
          <SectionLabel>Capacités spéciales</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Des médaillons à effet unique
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Flahute, Panache, Porteur de bidon, Locomotive, Giclette, Chasse
            patate et Homme Sandwich modifient le comportement ou les gains du
            coureur. Survolez leur médaillon dans la fiche pour lire l’effet.
          </p>
          <p className="mt-4 text-sm font-bold leading-6 text-[#176951]">
            Homme Sandwich accorde +0,5 réputation après une échappée ou une
            victoire.
          </p>
        </article>
      </div>
      <div className="mt-7">
        <RuleCard title="Laboratoire R&D et prototypes">
          Un ingénieur disponible peut rechercher une pièce libre dans les
          catégories débloquées par le laboratoire. La recherche est gratuite ;
          la pièce est indisponible jusqu’au résultat. Un prototype peut être
          retravaillé plusieurs fois et conserve son nom. La durée dépend de sa
          note globale actuelle, soit la somme de ses bonus et malus : 2 jours
          par point jusqu’à +6, puis 4 jours par point supplémentaire, jusqu’au
          plafond de +10. Un revers raccourcit la prochaine recherche et une
          amélioration l’allonge ; les talents de l’ingénieur réduisent la durée,
          avec un minimum d’un jour. L’assistant du DS signale lorsqu’un
          ingénieur et une pièce éligible sont disponibles.
        </RuleCard>
      </div>
    </GuideSection>
  );
}

function SponsoringSection() {
  return (
    <GuideSection
      id="sponsors"
      eyebrow="Partenariats"
      title="Sponsor principal, sponsor secondaire et équipementier"
      introduction="Le sponsor principal finance la saison et suit la satisfaction. À partir de la saison 4, la réputation ouvre aussi des investissements commerciaux, un sponsor secondaire et un équipement exclusif."
      tone="mint"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <FeatureCard
          eyebrow="Sponsor principal"
          title="Le socle financier"
          href="/jeu/sponsoring"
          bullets={[
            "Marché débloqué à 30 points de réputation",
            "Négociations de J21 à J28 pour la saison suivante",
            "Budget saisonnier, identité, philosophie et objectifs",
            "Catégorie des courses cohérente avec le prestige du sponsor",
            "Satisfaction alimentée par les objectifs, les résultats et les engagements publics",
          ]}
        />
        <FeatureCard
          eyebrow="Sponsor secondaire"
          title={`Débloqué à ${formatGuideNumber(SECONDARY_SPONSOR_REPUTATION_THRESHOLD)} de réputation`}
          href="/jeu/sponsoring"
          bullets={[
            "Trois offres distinctes dans un onglet dédié",
            `${getSecondarySponsorObjectiveCount(1)} objectifs aux prestiges 1–2, ${getSecondarySponsorObjectiveCount(3)} aux prestiges 3–4 et ${getSecondarySponsorObjectiveCount(5)} au prestige 5`,
            "Prime immédiate pour chaque objectif accompli, sans budget annuel ni satisfaction",
            "Nom de l’équipe composé du sponsor principal et du secondaire",
            "Logo positionnable, redimensionnable et orientable sur le maillot",
          ]}
        />
        <FeatureCard
          eyebrow="Équipementier"
          title="Un partenariat de deux saisons"
          href="/jeu/materiel/equipementier"
          bullets={[
            "Accessible à partir de 200 points de réputation",
            "Cadre, roue avant et roue arrière propres au partenaire",
            `À ${formatGuideNumber(REPUTATION_FEATURE_THRESHOLDS.equipmentPartnerExtra)} points, dépense définitive de 200 points pour un quatrième équipement`,
            "L’équipement exclusif n’est pas revendable",
            "Les pièces du partenaire sont retirées à la fin du contrat",
          ]}
        />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Satisfaction du sponsor principal</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">Un score sur 100</h3>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• Les objectifs peuvent fournir jusqu’à 100 points de satisfaction.</li>
            <li>• Les résultats de course ajoutent au maximum 25 points.</li>
            <li>• Les engagements publics renforcés ajoutent au maximum 8 points.</li>
            <li>• Le score final reste plafonné à 100.</li>
            <li>• Au renouvellement, l’enveloppe peut évoluer de −25 % à +10 % selon la satisfaction.</li>
            <li>• Si moins de la moitié des objectifs sont réussis, chaque objectif manquant jusqu’à ce seuil coûte 10 points de réputation.</li>
            <li>• Rompre le contrat avant son terme coûte 25 points de réputation.</li>
          </ul>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-[#FFF9DF] p-6 sm:p-8">
          <SectionLabel>À partir de la saison {SPONSOR_MAIN_OBJECTIVE_START_GAME_YEAR}</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">L’objectif principal</h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Environ une offre sur trois peut comporter un objectif principal :
            un résultat précis sur une course importante pour la marque. Sa
            réussite verse immédiatement une prime conséquente ; son échec fait
            perdre la quantité de réputation annoncée dans l’offre.
          </p>
          <p className="mt-4 text-sm font-bold leading-6 text-[#705B00]">
            La prime et la pénalité varient selon le prestige du sponsor, la
            catégorie de l’épreuve et le rang demandé. Les deux valeurs sont
            toujours affichées avant la signature.
          </p>
        </article>
      </div>

      <StrategyNote title="Investir sa réputation dans le contrat">
        À partir de {formatGuideNumber(REPUTATION_FEATURE_THRESHOLDS.sponsorInvestment)} points,
        vous pouvez dépenser définitivement {SPONSOR_REPUTATION_INVESTMENTS[1].cost} points
        pour +{SPONSOR_REPUTATION_INVESTMENTS[1].budgetBonusPercent} % de budget annuel,
        ou {SPONSOR_REPUTATION_INVESTMENTS[2].cost} points pour +{SPONSOR_REPUTATION_INVESTMENTS[2].budgetBonusPercent} %.
        Cette dépense n’est pas une caution et n’est donc pas rendue.
      </StrategyNote>
    </GuideSection>
  );
}

function StructuresSection() {
  const infrastructureCodes = getTeamInfrastructureCodesByStartingCost();

  return (
    <GuideSection
      id="structures"
      eyebrow="Investissements durables"
      title="Infrastructures, formation, supporters et fédération"
      introduction="Les bâtiments transforment durablement une équipe. Le catalogue se débloque au niveau 10 du Directeur Sportif ; chaque niveau de bâtiment exige ensuite les niveaux 10, 20, 30, 40 puis 50."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <RuleCard title="Un chantier à la fois">
          Une équipe ne peut mener qu’une construction simultanée. Au lancement,
          l’architecte choisi fixe définitivement la réduction de coût, de durée
          ou leur équilibre.
        </RuleCard>
        <RuleCard title="Spécialisation au niveau 3">
          Chaque bâtiment concerné choisit une orientation parmi trois. Son
          effet atteint 60 % au niveau 3, 80 % au niveau 4 et 100 % au niveau 5 ;
          la Data Room applique immédiatement 100 %.
        </RuleCard>
        <RuleCard title="Changer d’orientation">
          Une réorientation prend {INFRASTRUCTURE_SPECIALIZATION_TRANSITION_DAYS} jours
          et coûte 50 000 € par niveau du bâtiment. Pendant la transition,
          l’ancienne orientation reste active jusqu’au basculement.
        </RuleCard>
      </div>

      <details className="group mt-7 overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#082A2A] sm:px-6">
          <span>Catalogue complet des bâtiments d’équipe</span>
          <span aria-hidden="true" className="text-xl text-[#278B70] group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-5 border-t border-[#315B3E]/10 p-5 lg:grid-cols-2 sm:p-6">
          {infrastructureCodes.map((code) => {
            const building = TEAM_INFRASTRUCTURE_DEFINITIONS[code];
            return (
              <article key={code} className="rounded-xl bg-[#F3F8F6] p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">
                  {building.domain}
                </p>
                <h3 className="mt-1 text-lg font-black text-[#082A2A]">{building.name}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">{building.summary}</p>
                <ul className="mt-3 space-y-2 text-xs font-semibold leading-5 text-[#48665F]">
                  {building.levels.map((level) => (
                    <li key={level.level}>
                      <strong className="text-[#176951]">Niv. {level.level}</strong>
                      {" · "}{formatGuideMoney(level.cost)} · {level.durationDays} jour{level.durationDays > 1 ? "s" : ""}
                      {" — "}{level.effect}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </details>

      <InfrastructureSpecializations
        title="Spécialisations des bâtiments d’équipe"
        proposals={TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS}
      />

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <FeatureCard
          eyebrow="Centre de formation"
          title="Former sur plusieurs saisons"
          href="/jeu/centre-de-formation"
          bullets={[
            "Scouting de jeunes selon les pays et réseaux disponibles",
            "Écoles de cyclisme nationales et internationales",
            "Potentiel, profil et éventuelle capacité spéciale révélés progressivement",
            "Historique junior conservé lors du passage professionnel",
          ]}
        />
        <FeatureCard
          eyebrow="Fan Club"
          title="Mobiliser la ferveur"
          href="/jeu/fan-club"
          bullets={[
            "Popularité issue des résultats, échappées, fidélité et actualité",
            "40 % des supporters peuvent voyager selon les places de cars",
            "Bonus maximal de +3 sur la note principale, réduit de moitié sur ACC, END et RES",
            "Boutique soumise au stock, au prix et à la demande",
          ]}
        />
        <FeatureCard
          eyebrow="Fédération"
          title="Agir pour son pays"
          href="/jeu/federation"
          bullets={[
            "Président affiché sur la page publique du pays",
            "Sélections nationales et internationales",
            "Trésorerie, solidarité, objectifs et projets nationaux",
            "Équipements, préparation, organisation de courses et bâtiments fédéraux",
          ]}
        />
      </div>

      <InfrastructureSpecializations
        title="Spécialisations des bâtiments fédéraux"
        proposals={FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS}
      />
    </GuideSection>
  );
}

function InfrastructureSpecializations({
  title,
  proposals,
}: {
  title: string;
  proposals: readonly (typeof TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS)[number][];
}) {
  return (
    <details className="group mt-7 overflow-hidden rounded-[1.5rem] border border-[#315B3E]/15 bg-white shadow-[0_12px_34px_rgba(19,60,46,0.06)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-black text-[#082A2A] sm:px-6">
        <span>{title}</span>
        <span aria-hidden="true" className="text-xl text-[#278B70] group-open:rotate-45">+</span>
      </summary>
      <div className="grid gap-5 border-t border-[#315B3E]/10 p-5 lg:grid-cols-2 sm:p-6">
        {proposals.map((proposal) => (
          <article key={proposal.buildingCode} className="rounded-xl bg-[#F3F8F6] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#278B70]">{proposal.domain}</p>
            <h3 className="mt-1 text-lg font-black text-[#082A2A]">{proposal.buildingName}</h3>
            <p className="mt-1 text-xs font-bold text-[#60756E]">{proposal.unlockRule}</p>
            <div className="mt-3 space-y-3">
              {proposal.options.map((option) => (
                <div key={option.code} className="rounded-lg bg-white px-3 py-2.5 text-xs font-medium leading-5 text-[#60756E]">
                  <p className="font-black text-[#176951]">{option.name}</p>
                  <p>{option.primaryEffect}</p>
                  {option.secondaryEffect ? <p>{option.secondaryEffect}</p> : null}
                  {option.guardrail ? <p className="mt-1 font-semibold text-[#715F2A]">Limite : {option.guardrail}</p> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </details>
  );
}

function ProgressionSection() {
  return (
    <GuideSection
      id="progression"
      eyebrow="Carrière"
      title="XP, réputation, UCI, objectifs et finances"
      introduction="Ces quatre progressions répondent à des logiques différentes. Les confondre conduit souvent à de mauvais choix de calendrier ou de dépenses."
      tone="mint"
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <ProgressCard
          title="Expérience du DS"
          value="Niveau 1+"
          text="L’XP fait monter le niveau du Directeur Sportif. Le palier suivant coûte 100 XP, puis 50 XP de plus à chaque niveau."
        />
        <ProgressCard
          title="Réputation"
          value="Sans plafond"
          text="Elle mesure l’influence disponible du DS. Dès la saison 4, elle peut être réservée pour un engagement ou dépensée pour un avantage durable."
        />
        <ProgressCard
          title="Points UCI"
          value="Saison"
          text="Ils alimentent les classements des coureurs, équipes et nations et déterminent la hiérarchie sportive."
        />
        <ProgressCard
          title="Division"
          value="Saison +1"
          text="La division ne change jamais en direct. Le classement final de la saison fixe celle de la saison suivante."
        />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Paliers de réputation</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">De Amateur à Légende</h3>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {REPUTATION_TIERS.map((tier) => (
              <div key={tier.minimum} className="rounded-xl bg-[#F3F8F6] px-3 py-3">
                <strong className="block text-[#176951]">{formatGuideNumber(tier.minimum)}</strong>
                <span className="text-xs font-bold text-[#60756E]">{tier.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#48665F]">
            La réputation disponible correspond au total possédé moins les
            points temporairement engagés. Les points dépensés ou perdus quittent
            définitivement le total.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Fonctionnalités haute réputation · Saison 4</SectionLabel>
          <div className="mt-5 space-y-3">
            <Definition term={`${REPUTATION_FEATURE_THRESHOLDS.reinforcedPress}`} text="Renforcer un engagement de conférence de presse." />
            <Definition term={`${REPUTATION_FEATURE_THRESHOLDS.wildcardSupport}`} text="Appuyer une candidature à une wildcard." />
            <Definition term={`${formatGuideNumber(REPUTATION_FEATURE_THRESHOLDS.sponsorInvestment)}`} text="Dépenser de la réputation pour majorer le budget du sponsor principal." />
            <Definition term={`${formatGuideNumber(REPUTATION_FEATURE_THRESHOLDS.equipmentPartnerExtra)}`} text="Acheter le quatrième équipement exclusif du partenaire technique." />
            <Definition term={`${formatGuideNumber(SECONDARY_SPONSOR_REPUTATION_THRESHOLD)}`} text="Négocier avec un sponsor secondaire." />
          </div>
        </article>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Conférence de presse</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">Renforcer l’engagement</h3>
          <div className="mt-5 space-y-3">
            {PRESS_REPUTATION_COMMITMENTS.map((commitment) => (
              <div key={commitment.amount} className="rounded-xl bg-[#F3F8F6] px-4 py-3 text-sm font-medium leading-6 text-[#60756E]">
                <p className="font-black text-[#176951]">
                  {commitment.label} · {commitment.amount} point{commitment.amount > 1 ? "s" : ""}
                  {commitment.sponsorBonus > 0 ? ` · +${commitment.sponsorBonus} satisfaction sponsor` : ""}
                </p>
                <p>{commitment.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#315B3E]/10">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="bg-[#0B302B] text-white"><tr><th className="px-3 py-2.5">Promesse</th><th className="px-3 py-2.5">Réussite</th><th className="px-3 py-2.5">Échec</th></tr></thead>
              <tbody className="divide-y divide-[#315B3E]/10 bg-white font-semibold text-[#48665F]">
                {Object.values(PRE_RACE_AMBITION_DETAILS).map((ambition) => (
                  <tr key={ambition.label}><td className="px-3 py-2.5">{ambition.label} · {ambition.target}</td><td className="px-3 py-2.5">+{ambition.success}</td><td className="px-3 py-2.5">{ambition.failure}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#48665F]">
            Le bonus de satisfaction lié au renfort s’ajoute aux gains normaux
            de résultat, dans la limite générale du sponsor.
          </p>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Wildcards</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">Appuyer la candidature</h3>
          <div className="mt-5 space-y-3">
            {WILDCARD_REPUTATION_COMMITMENTS.map((commitment) => (
              <div key={commitment.amount} className="rounded-xl bg-[#F3F8F6] px-4 py-3 text-sm font-medium leading-6 text-[#60756E]">
                <p className="font-black text-[#176951]">
                  {commitment.label} · {commitment.amount} point{commitment.amount > 1 ? "s" : ""}
                  {commitment.selectionBonus > 0 ? ` · +${commitment.selectionBonus} au dossier` : ""}
                </p>
                <p>{commitment.description}</p>
              </div>
            ))}
          </div>
          <ul className="mt-5 space-y-2 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• Invitation acceptée : tous les points engagés sont rendus.</li>
            <li>• Candidature refusée : 40 % des points engagés sont perdus.</li>
            <li>• Retrait volontaire avant la date limite : 25 % sont perdus.</li>
            <li>• Course annulée : tous les points sont rendus.</li>
          </ul>
        </article>
      </div>

      <StrategyNote title="Maintien de la notoriété en fin de saison">
        Au-dessus de 300 points, une retenue s’applique uniquement à l’excédent :
        3 % sous 750, 5 % entre 750 et 1 249, puis 7 % à partir de 1 250, avec un
        maximum de 75 points. Chaque victoire World ou Élite réduit cette retenue
        de 5 points, jusqu’à 50 points compensés.
      </StrategyNote>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Objectifs de carrière</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Des récompenses à réclamer
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Les objectifs primaires accompagnent l’introduction : profil du DS,
            équipe amateur, première inscription, puis recrutement d’un membre
            du staff et d’un coureur. Les objectifs secondaires suivent les
            victoires, l’effectif, le matériel, le staff, les niveaux, les
            maillots, les participations et les wildcards.
          </p>
          <p className="mt-4 rounded-xl bg-[#FFF9DF] px-4 py-3 text-sm font-bold leading-6 text-[#705B00]">
            Un objectif ne peut être validé qu’une fois. Une fois terminé,
            ouvrez sa fiche et cliquez sur « Récompense » : argent, XP,
            réputation ou objet sont alors versés.
          </p>
          <Link
            href="/jeu/objectifs"
            className="mt-5 inline-flex font-black text-[#176951] hover:text-[#0B302B]"
          >
            Consulter mes objectifs →
          </Link>
        </article>

        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Finances</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Lire le solde réel et le solde projeté
          </h3>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            <li>• Les achats et primes de signature sont débités immédiatement.</li>
            <li>• Les salaires des coureurs et du staff alourdissent la saison.</li>
            <li>• Les opérations les plus récentes apparaissent en premier.</li>
            <li>• Les résultats rapportent argent, XP, réputation et points UCI selon la catégorie et le rang.</li>
            <li>• Les GPM, SI et classements secondaires ajoutent leurs propres gains.</li>
          </ul>
          <Link
            href="/jeu/finances"
            className="mt-5 inline-flex font-black text-[#176951] hover:text-[#0B302B]"
          >
            Ouvrir les finances →
          </Link>
        </article>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Élite", "Rangs 1–20", "+15 réputation / saison"],
          ["World", "Rangs 21–50", "+8 réputation / saison"],
          ["Continentale", "Rangs 51–100", "+4 réputation / saison"],
          ["Nationale", "Rangs 101–200", "+1 réputation / saison"],
        ].map(([title, ranks, bonus]) => (
          <article
            key={title}
            className="rounded-[1.4rem] bg-[#0B302B] p-5 text-white"
          >
            <h3 className="text-xl font-black text-[#F2C94C]">{title}</h3>
            <p className="mt-3 text-sm font-bold text-white">{ranks}</p>
            <p className="mt-1 text-xs font-semibold text-[#BFD1C6]">{bonus}</p>
          </article>
        ))}
      </div>

      <StrategyNote title="Origine des offres de sponsoring">
        Leur origine tient compte du pays de l’équipe, des nationalités et du
        niveau des coureurs. Une école de cyclisme internationale ajoute 30 à
        70 % de chance, selon son niveau, de faire émerger au maximum une offre
        de son pays dans le lot annuel. Plusieurs écoles se cumulent jusqu’à 85
        %, sans contourner les seuils de réputation.
      </StrategyNote>
    </GuideSection>
  );
}

function PagesSection() {
  return (
    <GuideSection
      id="pages"
      eyebrow="Répertoire"
      title="À quoi sert chaque page ?"
      introduction="Le bureau est le point de départ. Toutes les rubriques ci-dessous restent accessibles directement avec leur adresse et disposent d’un retour vers le bureau du DS."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {pageDirectory.map((section) => (
          <article
            key={section.group}
            className="overflow-hidden rounded-[1.75rem] border border-[#315B3E]/15 bg-white shadow-[0_16px_42px_rgba(19,60,46,0.08)]"
          >
            <div className="bg-[#0B302B] px-6 py-4">
              <h3 className="text-xl font-black text-white">{section.group}</h3>
            </div>
            <div className="divide-y divide-[#315B3E]/10">
              {section.pages.map(([label, href, description]) => (
                <div
                  key={href}
                  className="grid gap-2 px-6 py-4 sm:grid-cols-[170px_minmax(0,1fr)]"
                >
                  <Link
                    href={href}
                    className="font-black text-[#176951] hover:text-[#0B302B]"
                  >
                    {label} →
                  </Link>
                  <p className="text-sm font-medium leading-6 text-[#60756E]">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <RuleCard title="Fiches publiques">
          Les fiches des DS, équipes, nations et coureurs sont consultables par
          les autres joueurs. Les données privées de contrat ou de planning ne
          sont visibles que par le DS concerné.
        </RuleCard>
        <RuleCard title="Maillot automatique">
          Le visage d’un coureur reste stable. Son buste adopte automatiquement
          le maillot de sa nouvelle équipe après un transfert ou le maillot du
          sponsor actif.
        </RuleCard>
        <RuleCard title="Actualités du peloton">
          Le bureau relaie les événements importants après les courses, ainsi
          que les évolutions de l’équipe, sans reproduire chaque action du live.
        </RuleCard>
      </div>
    </GuideSection>
  );
}

function GuideCallToAction() {
  return (
    <section className="bg-[#F7FAF7] px-5 pb-20 pt-4 text-[#082A2A] sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#0B302B] px-6 py-10 text-center text-white shadow-[0_24px_70px_rgba(7,26,23,0.2)] sm:px-10 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE0BC]">
          Le meilleur apprentissage reste la course
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          Préparez une équipe, choisissez un objectif et prenez le départ.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#D6DFD2]">
          Revenez dans ce guide à tout moment : il reste accessible depuis le
          site public et depuis l’en-tête de votre espace de jeu.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/jeu"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#F2C94C] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] transition hover:-translate-y-0.5 hover:bg-[#FFD968]"
          >
            Retourner au bureau
          </Link>
          <Link
            href="#demarrage"
            className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-white/10"
          >
            Reprendre au début
          </Link>
        </div>
      </div>
    </section>
  );
}

function GuideSection({
  id,
  eyebrow,
  title,
  introduction,
  tone = "paper",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  introduction: string;
  tone?: "paper" | "mint";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-36 px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24 ${
        tone === "mint" ? "bg-[#EAF5F3]" : "bg-[#F7FAF7]"
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 max-w-4xl border-b border-[#315B3E]/15 pb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#278B70]">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-[#60756E]">
            {introduction}
          </p>
        </header>
        {children}
      </div>
    </section>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-32 rounded-xl border border-[#315B3E]/15 bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
      <strong className="block text-xl font-black text-[#176951]">{value}</strong>
      <span className="mt-1 block text-xs font-bold text-[#60756E]">{label}</span>
    </div>
  );
}

function RuleCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[1.4rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_12px_34px_rgba(19,60,46,0.06)]">
      <h3 className="text-lg font-black text-[#082A2A]">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">
        {children}
      </p>
    </article>
  );
}

function StrategyNote({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="mt-7 flex gap-4 rounded-[1.5rem] border border-[#F2C94C]/40 bg-[#FFF9DF] p-5 sm:p-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F2C94C] font-black text-[#071A17]">
        !
      </span>
      <div>
        <h3 className="font-black text-[#705B00]">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#715F2A]">
          {children}
        </p>
      </div>
    </aside>
  );
}

function SectionLabel({
  light = false,
  children,
}: {
  light?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`text-xs font-black uppercase tracking-[0.18em] ${
        light ? "text-[#9BE0BC]" : "text-[#278B70]"
      }`}
    >
      {children}
    </p>
  );
}

function Definition({ term, text }: { term: string; text: string }) {
  return (
    <div className="grid gap-1 rounded-xl bg-[#F3F8F6] px-4 py-3 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4">
      <dt className="font-black text-[#176951]">{term}</dt>
      <dd className="text-sm font-medium leading-6 text-[#60756E]">{text}</dd>
    </div>
  );
}

function FeatureCard({
  eyebrow,
  title,
  href,
  bullets,
}: {
  eyebrow: string;
  title: string;
  href: string;
  bullets: readonly string[];
}) {
  return (
    <article className="flex h-full flex-col rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)]">
      <SectionLabel>{eyebrow}</SectionLabel>
      <h3 className="mt-2 text-2xl font-black text-[#082A2A]">{title}</h3>
      <ul className="mt-5 flex-1 space-y-2 text-sm font-semibold leading-6 text-[#48665F]">
        {bullets.map((bullet) => (
          <li key={bullet}>• {bullet}</li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-6 inline-flex w-fit font-black text-[#176951] hover:text-[#0B302B]"
      >
        Ouvrir la rubrique →
      </Link>
    </article>
  );
}

function ProgressCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[#315B3E]/15 bg-white p-5 shadow-[0_14px_38px_rgba(19,60,46,0.07)]">
      <span className="text-2xl font-black text-[#278B70]">{value}</span>
      <h3 className="mt-3 text-lg font-black text-[#082A2A]">{title}</h3>
      <p className="mt-2 text-sm font-medium leading-6 text-[#60756E]">{text}</p>
    </article>
  );
}

function buildGuideRewardRanges(
  getReward: (rank: number) => RaceReward,
  maximumRank: number,
): GuideRewardRange[] {
  const ranges: GuideRewardRange[] = [];

  for (let rank = 1; rank <= maximumRank; rank += 1) {
    const reward = getReward(rank);
    if (!hasGuideReward(reward)) continue;

    const previous = ranges.at(-1);
    if (
      previous &&
      previous.lastRank === rank - 1 &&
      sameGuideReward(previous.reward, reward)
    ) {
      previous.lastRank = rank;
      continue;
    }

    ranges.push({ firstRank: rank, lastRank: rank, reward });
  }

  return ranges;
}

function sameGuideReward(left: RaceReward, right: RaceReward) {
  return (
    left.reputation === right.reputation &&
    left.experience === right.experience &&
    left.cashPrize === right.cashPrize &&
    left.uciPoints === right.uciPoints
  );
}

function hasGuideReward(reward: RaceReward) {
  return (
    reward.reputation !== 0 ||
    reward.experience !== 0 ||
    reward.cashPrize !== 0 ||
    reward.uciPoints !== 0
  );
}

function formatGuideRankRange(range: GuideRewardRange) {
  if (range.firstRank === range.lastRank) {
    return range.firstRank === 1 ? "1er" : `${range.firstRank}e`;
  }

  return `${range.firstRank}e–${range.lastRank}e`;
}

function formatGuideNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatGuideMoney(value: number) {
  return value === 0
    ? "—"
    : `${new Intl.NumberFormat("fr-FR").format(value)} €`;
}

function formatGuideReward(reward: RaceReward) {
  const parts = [
    reward.reputation ? `${formatGuideNumber(reward.reputation)} rép.` : null,
    reward.experience ? `${formatGuideNumber(reward.experience)} XP` : null,
    reward.cashPrize ? formatGuideMoney(reward.cashPrize) : null,
    reward.uciPoints ? `${formatGuideNumber(reward.uciPoints)} pts UCI` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}
