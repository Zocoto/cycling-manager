import type { TutorialDefinition } from "@/types/tutorial";

export const TRAINING_TUTORIAL_KEY = "training";
export const TRAINING_TUTORIAL_VERSION = 1;
export const TRAINING_TUTORIAL_ROUTE = "/jeu/entrainement";
export const TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE =
  "/jeu/entrainement?onglet=reconnaissance";

export const trainingTutorialDefinition = {
  key: TRAINING_TUTORIAL_KEY,
  version: TRAINING_TUTORIAL_VERSION,
  type: "contextual",
  title: "Entraînement et reconnaissance",
  description:
    "Réglez la progression et la forme de vos coureurs, analysez leurs rapports puis préparez une course par une reconnaissance.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "training-overview",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-overview",
      title: "Pilotez la séance quotidienne",
      content:
        "L’onglet Entraînements regroupe les réglages appliqués chaque jour à 8 h. Une modification enregistrée avant la séance agit dès le jour même ; après 8 h, elle est programmée pour la séance suivante et reste active les jours suivants.\n\nUne blessure, un stage de forme ou une reconnaissance suspend la séance du coureur concerné.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "training-threshold",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-threshold",
      title: "Protégez la forme avec le seuil minimal",
      content:
        "Si la forme d’un coureur est strictement inférieure à ce seuil au moment de la séance, il ne s’entraîne pas : il ne gagne aucune statistique et récupère automatiquement 2 points de forme.\n\nUn seuil élevé protège davantage l’effectif mais ralentit sa progression. Enregistrez toujours le seuil après l’avoir déplacé.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "training-staff",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-staff",
      title: "Lisez les bonus et les quotas du staff",
      content:
        "La rubrique Staff technique présente vos entraîneurs, leur niveau, leur spécialité et leur capacité d’encadrement. Un entraîneur augmente la progression des statistiques qui correspondent à sa spécialité ; une affinité nationale avec le coureur apporte encore 5 %.\n\nLe quota indique combien de coureurs peuvent lui être confiés simultanément.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "training-rider-setup",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-plan-setup",
      title: "Chaque coureur possède son propre programme",
      content:
        "Prenons le premier coureur de la liste. Son programme associe une intensité, un domaine et éventuellement un entraîneur. Ces réglages restent actifs jusqu’à leur prochaine modification : adaptez-les à son âge, à son potentiel, à ses qualités et à ses objectifs de saison.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "training-intensity",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-plan-intensity",
      title: "L’intensité échange de la forme contre de la progression",
      content:
        "Plus l’intensité est élevée, plus les millipoints de progression gagnés pendant la séance sont importants. En contrepartie, la forme diminue au-delà de 50 % : 60 % coûte 5 points, 80 % en coûte 15 et 100 % en coûte 25.\n\nÀ 50 %, la forme reste stable. En dessous, la séance est plus lente mais peut rendre jusqu’à 2 points de forme à intensité nulle.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "training-domain",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-plan-domain",
      title: "Le domaine oriente les gains",
      content:
        "Le domaine choisit les caractéristiques principalement travaillées : grimpeur, puncheur, rouleur, sprinteur, classiques du Nord (pavés), baroudeur ou courses par étapes.\n\nLes autres notes peuvent encore progresser, mais beaucoup plus lentement. Faites correspondre le domaine au profil que vous voulez développer, pas seulement au point fort actuel du coureur.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "training-trainer",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-plan-trainer",
      title: "Assignez le bon entraîneur",
      content:
        "Un entraîneur renforce les gains des statistiques relevant de sa spécialité. Son niveau détermine l’ampleur du bonus et son quota limite le nombre de coureurs suivis.\n\nLa mention « affinité nationale » signale le bonus supplémentaire de 5 % lorsque le coureur et l’entraîneur partagent la même nationalité.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "training-save",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-plan-save",
      title: "Validez tous vos changements en une fois",
      content:
        "Vous pouvez modifier l’intensité, le domaine ou l’entraîneur de plusieurs coureurs sans interrompre votre paramétrage. Dès qu’un réglage change, une barre de validation apparaît en bas de l’écran, indique le nombre de programmes concernés et suit votre défilement.\n\nValidez-les ensemble lorsque tout est prêt, ou utilisez Annuler pour retrouver tous les réglages initiaux. Sans validation, les anciens programmes restent actifs.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "training-latest-report",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-report",
      title: "Contrôlez la dernière séance",
      content:
        "Le bouton Rapports ouvre d’abord la dernière séance. Vous y retrouvez son statut, le domaine, l’intensité, l’évolution de la forme, l’entraîneur et le kiné, puis les millipoints gagnés et les éventuels passages de notes entières.\n\nVous pouvez ouvrir ce rapport pendant la visite pour examiner les valeurs réelles du coureur.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "training-season-report",
      route: TRAINING_TUTORIAL_ROUTE,
      targetId: "training-report",
      title: "Prenez du recul avec le bilan de saison",
      content:
        "Dans la fenêtre Rapports, l’onglet Saison compare les notes de J1 aux valeurs actuelles. Il totalise les séances réalisées ou manquées, l’impact cumulé sur la forme, les notes gagnées ou perdues et le solde décimal encore conservé.\n\nUtilisez cette vue pour vérifier qu’un programme produit bien l’évolution attendue sur plusieurs jours.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 6,
    },
    {
      key: "reconnaissance-overview",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      targetId: "reconnaissance-overview",
      title: "Préparez précisément une future épreuve",
      content:
        "Le stage de reconnaissance étudie une étape ou une classique avant sa tenue. Il coûte de l’argent mais accorde aux coureurs sélectionnés un bonus dédié à cette épreuve.\n\nLa durée est de deux jours par défaut ; certains préparateurs peuvent la réduire à un jour, augmenter le bonus ou accueillir davantage de coureurs.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "reconnaissance-riders",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      targetId: "reconnaissance-rider-selection",
      title: "Commencez par sélectionner les coureurs",
      content:
        "Tous les coureurs restent sélectionnables même s’ils sont indisponibles aujourd’hui. Le planificateur croise ensuite leurs courses, blessures et stages futurs.\n\nAvec plusieurs coureurs, seules les épreuves autorisées pour l’équipe et possédant une période commune à toute la délégation sont conservées. Respectez aussi la capacité du préparateur choisi.",
      placement: "right",
      highlightPadding: 8,
    },
    {
      key: "reconnaissance-race",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      targetId: "reconnaissance-course-selection",
      title: "Choisissez l’épreuve réellement visée",
      content:
        "Le calendrier n’affiche que les courses futures auxquelles votre équipe est autorisée à participer et que tous les coureurs sélectionnés peuvent préparer. Choisissez une étape précise d’un tour, ou la classique concernée.\n\nLors de cette seule épreuve, chaque participant au stage reçoit le bonus affiché sur ses 13 caractéristiques de course, dans la limite de 100. Le coût dépend de la catégorie et du format.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "reconnaissance-dates",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      targetId: "reconnaissance-date-planning",
      title: "Bloquez une période commune avant la course",
      content:
        "Après le choix de l’épreuve, sélectionnez la période de préparation proposée. Le moteur exclut automatiquement les jours déjà occupés par chacun des coureurs et tout chevauchement avec le tour ciblé.\n\nPendant ces dates, les participants sont indisponibles : ils ne peuvent pas courir, ne suivent pas leur entraînement quotidien et ne récupèrent pas les 2 points de forme du repos sous le seuil.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "reconnaissance-validation",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      targetId: "reconnaissance-validation",
      title: "Vérifiez puis validez la reconnaissance",
      content:
        "Le récapitulatif final rappelle la course, l’étape, les dates, le bonus et le coût. Le bouton devient disponible lorsque la délégation respecte la capacité, qu’une période commune existe et que la trésorerie est suffisante.\n\nLa validation enregistre définitivement la mission et l’indisponibilité des coureurs sur le calendrier.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "complete",
      route: TRAINING_RECONNAISSANCE_TUTORIAL_ROUTE,
      title: "Entraînement et reconnaissance maîtrisés",
      content:
        "Vous savez désormais régler le seuil collectif, préparer plusieurs programmes individuels puis les valider ensemble, mesurer leurs résultats dans les rapports, puis organiser un stage de reconnaissance compatible avec toute une délégation.\n\nCliquez sur « Terminer » pour valider cet apprentissage dans le Centre des didacticiels. Vous pourrez le relancer à tout moment depuis le point d’interrogation de la rubrique Entraînement.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
