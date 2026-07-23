import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

export const metadata: Metadata = {
  title: "Guide complet du Directeur Sportif",
  description:
    "Le manuel complet de Cyclo Stratège : calendrier, courses, entraînement, forme, staff, transferts, finances, objectifs et progression.",
};

const guideNavigation = [
  { href: "#demarrage", label: "Bien démarrer" },
  { href: "#journee", label: "Une journée" },
  { href: "#coureurs", label: "Coureurs" },
  { href: "#courses", label: "Courses" },
  { href: "#equipe", label: "Équipe" },
  { href: "#progression", label: "Progression" },
  { href: "#pages", label: "Toutes les pages" },
  { href: "#etat", label: "État des fonctions" },
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
    text: "Cinq nouveaux coureurs apparaissent aux enchères jusqu’à 18 h.",
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
  ["PRL", "Prologue"],
] as const;

const trainingDomains = [
  "Grimpeur",
  "Puncheur",
  "Courses par étapes",
  "Classiques du Nord",
  "Rouleur",
  "Baroudeur",
  "Sprinteur",
] as const;

const staffRoles = [
  {
    title: "Entraîneur",
    text: "Améliore la séance du coureur auquel il est affecté : +4 % par niveau sur sa spécialité, plus +5 % si les nationalités correspondent.",
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
] as const;

const pageDirectory = [
  {
    group: "Pilotage",
    pages: [
      ["Bureau du DS", "/jeu", "Vue d’ensemble, actualités, raccourcis et alertes."],
      ["Profil du DS", "/jeu/directeur-sportif", "Identité, réputation, niveau et équipe fondatrice."],
      ["Objectifs", "/jeu/objectifs", "Progression et récupération manuelle des récompenses."],
      ["Finances", "/jeu/finances", "Solde, opérations et projection de fin de saison."],
    ],
  },
  {
    group: "Sportif",
    pages: [
      ["Effectif", "/jeu/effectif", "Coureurs, contrats, forme et planning saisonnier."],
      ["Entraînements", "/jeu/entrainement", "Séance quotidienne, intensité, domaine et entraîneur."],
      ["Centre de soin", "/jeu/centre-de-soin", "Blessures, kinés, nutrition et stages de forme."],
      ["Calendrier", "/jeu/calendrier", "Courses AM/PM, filtres et inscriptions."],
      ["Résultats / Live", "/jeu/resultats", "Répertoire des directs, replays et résultats officiels."],
      ["Classements UCI", "/jeu/classements", "Équipes, coureurs, nations et projection des divisions."],
    ],
  },
  {
    group: "Développement",
    pages: [
      ["Staff", "/jeu/staff", "Marché de l’emploi et membres sous contrat."],
      ["Transferts", "/jeu/transferts", "Enchères quotidiennes, ventes des DS et agents libres."],
      ["Matériel", "/jeu/materiel", "Catalogue commercial et achats d’équipement."],
      ["Inventaire", "/jeu/inventaire", "Objets, consommables et matériel disponible."],
      ["Sponsoring", "/jeu/sponsoring", "Offres, contrat principal, budget et maillot."],
      ["Infrastructures", "/jeu/infrastructures", "Data Room et centres internationaux à partir du niveau 10."],
      ["Centre de formation", "/jeu/centre-de-formation", "Scouting, école de cyclisme et jeunes talents."],
    ],
  },
  {
    group: "Univers",
    pages: [
      ["Recherche", "/jeu/recherche", "Retrouver un DS, une équipe ou une nation."],
      ["Sélections internationales", "/jeu/selections-internationales", "Répondre aux convocations continentales et mondiales."],
      ["Maillot", "/jeu/maillot", "Consulter les identités visuelles de l’équipe."],
    ],
  },
] as const;

const activeFeatures = [
  "Création du DS, équipe amateur et effectif initial",
  "Calendrier à deux courses par jour et inscriptions",
  "Lives dédiés, chat, replays et résultats officiels",
  "Entraînement, forme, blessures et soins",
  "Staff, transferts et contrats",
  "Matériel commercial, équipement et inventaire",
  "Finances, récompenses de course et objectifs de carrière",
  "Classements UCI et divisions de saison suivante",
  "Scouting, école de cyclisme et infrastructures",
] as const;

const partialFeatures = [
  "Le suivi sportif détaillé des objectifs de sponsor est encore indiqué comme incomplet dans l’interface.",
  "La Development Team du centre de formation est affichée comme étant en construction.",
  "Le partenariat avec un équipementier n’a pas encore sa rubrique fonctionnelle dédiée ; seul le matériel commercial est actif.",
  "Le laboratoire de simulation est réservé aux comptes autorisés. Les joueurs utilisent normalement la page Résultats / Live.",
] as const;

export default function GuidePage() {
  return (
    <>
      <GuideHero />
      <GuideNavigation />
      <QuickStartSection />
      <DaySection />
      <RidersSection />
      <RacingSection />
      <TeamManagementSection />
      <ProgressionSection />
      <PagesSection />
      <FeatureStatusSection />
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
            Manuel utilisateur · juillet 2026
          </span>
          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
            Le guide complet du
            <span className="mt-2 block text-[#42B99A]">Directeur Sportif.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg font-medium leading-8 text-[#25443F]">
            Comprendre les pages, organiser une journée de jeu, préserver la
            forme, faire progresser les coureurs et construire une équipe
            durable : tout le fonctionnement actuel de Cyclo Stratège est
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
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] !text-[#071A17] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#FFD968]"
            >
              Commencer le tutoriel
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
      introduction="La saison dure 28 jours. Chaque journée est divisée en deux demi-journées : AM pour la course de 14 h et PM pour celle de 18 h."
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
              text="L’ancien champ séparé n’est plus utilisé dans l’interface : la gestion quotidienne repose sur la forme, tandis que le live suit l’énergie propre à chaque coureur."
            />
          </dl>
          <div className="mt-5 rounded-xl border border-[#C94F4F]/20 bg-[#FFF3F0] px-4 py-3 text-sm font-bold leading-6 text-[#8A3830]">
            Si une perte devait faire passer la forme sous 0, elle reste à 0 et
            le coureur subit une blessure de fatigue de trois jours.
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
            {trainingDomains.map((domain) => (
              <span
                key={domain}
                className="rounded-full bg-[#EAF5F3] px-3 py-2 text-xs font-extrabold text-[#176951]"
              >
                {domain}
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

      <StrategyNote title="Plan de gestion recommandé">
        Réservez les fortes intensités aux périodes sans objectif immédiat,
        placez le seuil de repos assez haut avant un grand tour et affectez vos
        meilleurs entraîneurs aux coureurs dont la spécialité correspond.
      </StrategyNote>
    </GuideSection>
  );
}

function RacingSection() {
  return (
    <GuideSection
      id="courses"
      eyebrow="Compétition"
      title="Du calendrier au résultat officiel"
      introduction="Chaque course suit une chaîne précise : inscription, gel de la startlist, live, classement d’étape ou de classique, puis récompenses et mise à jour des classements."
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

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] bg-[#0B302B] p-6 text-white sm:p-8">
          <SectionLabel light>Ce que simule le live</SectionLabel>
          <h3 className="mt-2 text-2xl font-black">
            Une course individuelle au sein de groupes
          </h3>
          <ul className="mt-6 grid gap-3 text-sm font-semibold leading-6 text-[#D6DFD2] sm:grid-cols-2">
            <li>• Départ sans échappée préformée</li>
            <li>• Attaques, contre-attaques et chasse</li>
            <li>• Peloton, groupes et coureurs lâchés</li>
            <li>• Énergie propre à chaque coureur</li>
            <li>• Crevaisons, chutes et abandons</li>
            <li>• Vent, bordures et pluie visible</li>
            <li>• Routes, pavés et biotopes cohérents</li>
            <li>• GPM, SI et ligne d’arrivée</li>
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
          Les écarts sont toujours calculés depuis la tête. Les coureurs d’un
          même groupe d’arrivée reçoivent le même temps, noté MT.
        </RuleCard>
        <RuleCard title="Abandon">
          Un coureur qui abandonne reste dans le résultat, placé en fin de
          classement avec la mention « Abandon ». Sur un tour, il ne repart pas.
        </RuleCard>
        <RuleCard title="Primes d’étape">
          Les tops d’étape rapportent de l’argent. Sur un tour, toutes ces primes
          sont comptabilisées et versées au jour de la dernière étape.
        </RuleCard>
      </div>

      <StrategyNote title="Catégories et wildcards">
        Les équipes Élite accèdent normalement aux courses Élite. Quatre
        wildcards sont réservées aux équipes World, Continentales ou Nationales,
        avec priorité à la division la mieux classée, puis à l’adéquation du
        leader et aux points UCI.
      </StrategyNote>
    </GuideSection>
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
            "5 enchères quotidiennes, de 9 h à 18 h",
            "Ventes entre DS pendant 24 heures",
            "Agents libres sans indemnité de transfert",
            "Contrats couvrant la saison actuelle et la suivante",
            "Un nouveau recruté ne peut pas être revendu la même saison",
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
            "Stages classiques : +5 forme par jour",
            "Stages premium : +10 forme par jour",
          ]}
        />
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
    </GuideSection>
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
          value="30 pts"
          text="Elle mesure l’attractivité de la structure. À 30 points, le marché du sponsoring se débloque."
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

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <SectionLabel>Objectifs de carrière</SectionLabel>
          <h3 className="mt-2 text-2xl font-black text-[#082A2A]">
            Des récompenses à réclamer
          </h3>
          <p className="mt-4 text-sm font-medium leading-7 text-[#60756E]">
            Les objectifs primaires accompagnent l’introduction : profil du DS,
            équipe amateur, première inscription, puis recrutement d’un membre
            du staff et d’un coureur. Les objectifs secondaires suivent les
            victoires, l’effectif, le matériel, le staff, les niveaux, les
            maillots, les participations et les wildcards.
          </p>
          <p className="mt-4 rounded-xl bg-[#FFF9DF] px-4 py-3 text-sm font-bold leading-6 text-[#705B00]">
            Un objectif ne peut être validé qu’une fois. Une fois terminé,
            ouvrez sa fiche et cliquez sur « Récompense » : argent, XP,
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

      <StrategyNote title="Sponsoring">
        Les offres apparaissent à partir de 30 points de réputation. Leur origine
        tient compte du pays de l’équipe, mais aussi des nationalités et du
        niveau des coureurs. Entre J21 et J28, vous préparez le sponsor de la
        saison suivante. Une rupture anticipée coûte 10 points de réputation.
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

function FeatureStatusSection() {
  return (
    <GuideSection
      id="etat"
      eyebrow="Revue fonctionnelle"
      title="Ce qui est actif et ce qui reste à venir"
      introduction="Ce guide décrit l’état réel de l’application au moment de sa mise à jour. Les fonctions partielles sont isolées ci-dessous pour éviter toute ambiguïté."
      tone="mint"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-[1.75rem] border border-[#278B70]/25 bg-white p-6 shadow-[0_16px_42px_rgba(19,60,46,0.08)] sm:p-8">
          <span className="inline-flex rounded-full bg-[#DDF3E7] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#176951]">
            Opérationnel
          </span>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#48665F]">
            {activeFeatures.map((feature) => (
              <li key={feature} className="flex gap-3">
                <span aria-hidden="true" className="text-[#278B70]">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[1.75rem] border border-[#D99A32]/30 bg-[#FFF9DF] p-6 shadow-[0_16px_42px_rgba(102,72,18,0.07)] sm:p-8">
          <span className="inline-flex rounded-full bg-[#F2C94C]/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#705B00]">
            Partiel ou en construction
          </span>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-[#715F2A]">
            {partialFeatures.map((feature) => (
              <li key={feature} className="flex gap-3">
                <span aria-hidden="true" className="text-[#B28514]">→</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
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
          Revenez dans ce guide à tout moment : il reste accessible depuis le
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
