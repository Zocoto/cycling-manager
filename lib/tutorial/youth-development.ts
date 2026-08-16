import type { TutorialDefinition } from "@/types/tutorial";

export const YOUTH_DEVELOPMENT_TUTORIAL_KEY = "youth-development";
export const YOUTH_DEVELOPMENT_TUTORIAL_VERSION = 1;
export const YOUTH_DEVELOPMENT_TUTORIAL_DEMO_VALUE = "centre-formation";
export const YOUTH_DEVELOPMENT_SCOUTING_ROUTE =
  "/jeu/centre-de-formation?didacticiel=centre-formation&onglet=scouting";
export const YOUTH_DEVELOPMENT_ACADEMY_ROUTE =
  "/jeu/centre-de-formation?didacticiel=centre-formation&onglet=ecole";

export const youthDevelopmentTutorialDefinition = {
  key: YOUTH_DEVELOPMENT_TUTORIAL_KEY,
  version: YOUTH_DEVELOPMENT_TUTORIAL_VERSION,
  type: "contextual",
  title: "Former les talents de demain",
  description:
    "Explorez le réseau mondial, simulez une mission de scouting, analysez un rapport puis découvrez l’école et l’entraînement junior.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "youth-overview",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-development-overview",
      title: "De la détection au passage chez les professionnels",
      content:
        "Le Centre de formation suit tout le parcours d’un jeune : détection par un scout, lecture du rapport, signature à l’école, entraînement quotidien puis recrutement dans l’équipe première.\n\nCette visite utilise uniquement des données fictives. Vous pouvez essayer les éléments indiqués sans engager votre budget, votre staff ou vos juniors.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "youth-tabs",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-development-tabs",
      title: "Trois espaces pour trois moments du parcours",
      content:
        "La détection regroupe la carte, les missions et les rapports. L’École de cyclisme accueille les jeunes signés et permet de régler leur entraînement. L’équipe de développement forme à J1–J7 un effectif junior qui dispute ensuite son propre calendrier sans course en direct.\n\nLe didacticiel commence par la détection puis ouvrira automatiquement l’école.",
      placement: "bottom",
      highlightPadding: 6,
    },
    {
      key: "youth-world-map",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-map",
      title: "La mappemonde ouvre un réseau mondial",
      content:
        "Chaque point représente un pays explorable. Sélectionnez-le sur la carte ou dans la liste pour consulter sa réputation, ses installations locales et ses traditions de formation.\n\nCes spécialités augmentent les chances de rencontrer certains profils, mais ne garantissent jamais le contenu d’un rapport.",
      placement: "top",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "youth-country-filter",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-filters",
      title: "Filtrez avant de choisir votre zone",
      content:
        "La recherche accepte le nom ou le code d’un pays. Les raccourcis sous la carte reprennent les premiers résultats et permettent de changer rapidement de zone.\n\nEssayez le filtre ou sélectionnez un autre point : la fiche du pays se met à jour immédiatement, sans lancer de mission.",
      placement: "bottom",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "youth-fake-mission",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-mission-launch",
      title: "Lancez une mission entièrement fictive",
      content:
        "La visite met Camille Moreau, scout de démonstration, à votre disposition même si votre staff ne possède aucun scout. Choisissez une durée puis cliquez sur « Simuler le départ ».\n\nDans le jeu réel, il faut assigner un scout disponible. Son niveau améliore la qualité des jeunes détectés et une nationalité commune avec le pays ciblé ajoute 15 % d’efficacité.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 8,
    },
    {
      key: "youth-delays",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-deadlines",
      title: "Le délai se compte en jours de saison",
      content:
        "Une mission dure de 3 à 7 jours complets. Lancée en J12 pour trois jours, elle livre donc son rapport en J15. Elle ne peut pas dépasser le J28 et le scout reste indisponible jusqu’au retour.\n\nUne durée plus longue améliore légèrement les chances de potentiel, mais immobilise le scout davantage. Le rapport final contient entre un et quatre jeunes.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "youth-report",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-report",
      title: "Analysez les certitudes et les zones d’ombre",
      content:
        "Le rapport fictif présente une projection globale, un potentiel et les 13 caractéristiques. Une valeur exacte est connue ; une fourchette reste une estimation ; « ? » signifie que le scout n’a pas obtenu assez d’informations.\n\nCommencez par le potentiel et les notes majeures du profil, puis vérifiez les faiblesses, la prime d’accueil et les frais annuels. Un rapport prometteur n’est pas une garantie de progression.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "youth-signing",
      route: YOUTH_DEVELOPMENT_SCOUTING_ROUTE,
      targetId: "youth-tutorial-signing",
      title: "La signature ouvre les portes de l’école",
      content:
        "Signer un jeune débite immédiatement sa prime d’accueil puis ajoute ses frais de scolarité à chaque saison passée à l’école. Dans une vraie mission, le bouton transfère aussitôt le candidat vers l’onglet École de cyclisme.\n\nIci, aucune dépense n’est enregistrée. Cliquez sur « Suivant » pour suivre ce jeune fictif dans l’école de démonstration.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "youth-academy",
      route: YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
      targetId: "youth-tutorial-academy",
      title: "L’école rassemble toute la relève",
      content:
        "Chaque fiche rappelle l’âge, la nationalité, le potentiel, la projection des notes, la scolarité et le statut du junior. Les notifications signalent les promotions, expirations et décisions administratives.\n\nÀ partir de 17 ans, un jeune peut être programmé pour rejoindre l’équipe première la saison suivante si une place reste disponible.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "youth-training-settings",
      route: YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
      targetId: "youth-tutorial-training-settings",
      title: "Choisissez le mode et le profil travaillés",
      content:
        "Le mode automatique déclenche une séance chaque matin à 8 h, sans entraîneur assignable et avec l’efficacité junior ×2. Le mode manuel ouvre deux créneaux : minuit–midi et midi–minuit.\n\nLe profil travaillé détermine les statistiques visées et le type de minijeu. Une modification est programmée pour la prochaine journée puis reste active. Un créneau manuel manqué n’est jamais remplacé automatiquement.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "youth-minigame",
      route: YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
      targetId: "youth-tutorial-minigame",
      title: "Essayez le minijeu correspondant au réglage",
      content:
        "Chaque profil dispose de son propre défi : Cadence pour les grimpeurs, La bosse pour les puncheurs, Tape-taupe pour les classiques du Nord, L’échappée pour les baroudeurs, Gauche / droite pour les sprinteurs et Zone aéro pour les rouleurs.\n\nL’aperçu ci-dessous reprend le réglage du premier junior de votre école, ou un exemple grimpeur si elle est vide. La vraie séance dure 30 secondes et produit un score sur 1000, ensuite transformé en progression selon le potentiel et le niveau actuel des statistiques. Cette démonstration ne sauvegarde rien.",
      placement: "top",
      allowTargetInteraction: true,
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: YOUTH_DEVELOPMENT_ACADEMY_ROUTE,
      title: "Votre filière de formation est prête",
      content:
        "Vous savez maintenant filtrer la carte, lancer et temporiser une mission, lire un rapport, signer un candidat puis choisir entre entraînement automatique et minijeux manuels à l’école.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera disponible depuis le point d’interrogation du Centre de formation.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
