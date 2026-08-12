import type { TutorialDefinition } from "@/types/tutorial";

export const STAFF_TUTORIAL_KEY = "staff";
export const STAFF_TUTORIAL_VERSION = 1;
export const STAFF_TUTORIAL_ROUTE = "/jeu/staff";
export const STAFF_TUTORIAL_MARKET_ROUTE = `${STAFF_TUTORIAL_ROUTE}?onglet=marche`;
export const STAFF_TUTORIAL_TEAM_ROUTE = `${STAFF_TUTORIAL_ROUTE}?onglet=equipe`;

export function isStaffTutorialRoute(
  route: string | null | undefined,
): boolean {
  return (
    route === STAFF_TUTORIAL_ROUTE ||
    Boolean(route?.startsWith(`${STAFF_TUTORIAL_ROUTE}?`))
  );
}

export const STAFF_TUTORIAL_MARKET_STEP_KEYS = [
  "staff-market",
  "staff-market-filters",
  "staff-professions",
] as const;

export const STAFF_TUTORIAL_TEAM_STEP_KEY = "staff-team";

export const staffTutorialDefinition = {
  key: STAFF_TUTORIAL_KEY,
  version: STAFF_TUTORIAL_VERSION,
  type: "contextual",
  title: "Constituer son staff",
  description:
    "Comprenez les places disponibles, les métiers, le marché mondial et les effets actifs de vos spécialistes.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "staff-overview",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-overview",
      title: "Votre équipe derrière l’équipe",
      content:
        "La rubrique Staff rassemble les spécialistes qui améliorent durablement votre structure et vos coureurs. Leurs effets interviennent sur l’entraînement, la détection, les soins, la course, les infrastructures ou encore la réputation.\n\nChaque recrutement engage immédiatement une prime de signature puis un salaire réparti sur les quatre échéances de la saison.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "staff-capacity",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-capacity",
      title: "Votre niveau de DS ouvre des places",
      content:
        "Le niveau du Directeur Sportif fixe le nombre maximal de contrats de staff actifs. Vous disposez d’une place au niveau 1, puis de 2, 3, 5, 7 et 10 places aux niveaux 2 à 6. Les paliers continuent ensuite à progresser jusqu’à un maximum de 45.\n\nMonter de niveau ne recrute personne automatiquement : cela ouvre seulement de nouvelles places que vous choisissez comment utiliser.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "staff-tabs",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-tabs",
      title: "Deux vues complémentaires",
      content:
        "Le « Marché de l’emploi » sert à découvrir et recruter les profils disponibles aujourd’hui. L’onglet « Staff de l’équipe » récapitule ensuite vos contrats, votre masse salariale et tous les effets déjà actifs.\n\nLe didacticiel va commencer par le marché avant d’ouvrir automatiquement votre propre staff.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "staff-market",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-market-overview",
      title: "Un marché mondial partagé",
      content:
        "Chaque jour, 25 spécialistes identiques sont proposés à tous les Directeurs Sportifs. Le marché est renouvelé quotidiennement et fonctionne sur le principe du premier arrivé : dès qu’un profil signe ailleurs, il disparaît pour toutes les autres équipes.\n\nSurveillez donc vos places libres, la prime immédiate et le budget nécessaire pour couvrir toute la saison.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "staff-market-filters",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-market-filters",
      title: "Isolez le spécialiste recherché",
      content:
        "Les filtres permettent d’isoler un métier, un niveau, une nationalité ou une spécialité d’entraîneur. Les noms ne sont révélés que tant que le profil reste disponible, et un profil recruté disparaît immédiatement du marché. Combinez les critères et utilisez « Réinitialiser » pour retrouver tous les profils encore disponibles du jour.\n\nLe niveau va de 1 à 5 : plus il est élevé, plus l’effet est puissant, mais plus le salaire et la prime de signature augmentent.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "staff-professions",
      route: STAFF_TUTORIAL_MARKET_ROUTE,
      targetId: "staff-market-listings",
      title: "Dix métiers, dix leviers de progression",
      content:
        "L’entraîneur accélère la progression dans sa spécialité ; le scout améliore la détection des jeunes ; le médecin réduit la récupération des blessures ; le kiné protège la forme après les courses ; le nutritionniste améliore la récupération et les compléments ; le mécanicien limite les pertes dues aux avaries.\n\nLe préparateur de parcours renforce les reconnaissances, l’architecte réduit coûts et délais des infrastructures, le community manager augmente les gains de réputation et l’ingénieur R&D fiabilise les prototypes du laboratoire.\n\nChaque personne est unique : lisez sa nationalité, son niveau, ses spécialités, ses talents et toutes ses lignes d’effets. Deux profils du même métier ne constituent pas nécessairement le même investissement.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: STAFF_TUTORIAL_TEAM_STEP_KEY,
      route: STAFF_TUTORIAL_TEAM_ROUTE,
      targetId: "staff-team-overview",
      title: "Pilotez les effets déjà actifs",
      content:
        "Cet onglet rassemble la capacité utilisée, les places encore libres, la masse salariale et les spécialistes sous contrat. Les effets compatibles de plusieurs membres peuvent se cumuler ; les affinités de nationalité apportent aussi un bonus d’efficacité.\n\nVous pouvez licencier un membre depuis sa fiche. La rupture est immédiate et coûte uniquement les échéances salariales restant à régler pendant la saison en cours. Pour une nouvelle équipe, cette vue peut être vide : c’est normal.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: STAFF_TUTORIAL_TEAM_ROUTE,
      title: "Vous savez constituer votre encadrement",
      content:
        "Vous savez maintenant combien de spécialistes votre niveau autorise, comment filtrer le marché, comparer les métiers et leurs effets, puis contrôler le staff déjà recruté.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera disponible depuis le point d’interrogation de la rubrique Staff.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
