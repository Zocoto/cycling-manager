import type { TutorialDefinition } from "@/types/tutorial";

export const ROSTER_TUTORIAL_KEY = "roster-management";
export const ROSTER_TUTORIAL_VERSION = 1;
export const ROSTER_TUTORIAL_ROUTE = "/jeu/effectif";
export const ROSTER_TUTORIAL_RIDER_ROUTE =
  "/jeu/coureurs/[identifiant]";

export const rosterTutorialDefinition = {
  key: ROSTER_TUTORIAL_KEY,
  version: ROSTER_TUTORIAL_VERSION,
  type: "contextual",
  title: "Gérer son effectif",
  description:
    "Lisez les notes et les contrats, découvrez une fiche coureur complète et planifiez sa saison.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "roster-overview",
      route: ROSTER_TUTORIAL_ROUTE,
      targetId: "roster-overview",
      title: "Le poste de pilotage de votre effectif",
      content:
        "Cette rubrique rassemble tous les coureurs actuellement sous contrat. Les vues « Statistiques & contrats » et « Planning de saison » répondent à deux questions complémentaires : de quelles qualités dispose votre équipe, et quand chaque coureur sera-t-il disponible ?",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "roster-ratings",
      route: ROSTER_TUTORIAL_ROUTE,
      targetId: "roster-rating-table",
      title: "Comparez les notes sans perdre le profil de vue",
      content:
        "Les notes primaires décrivent les terrains décisifs : MO, HIL, FL, TT, COB et SP. Les notes secondaires — ACC, DH, STA, RES, REC, FTR et PRL — affinent le comportement du coureur.\n\nLe profil et la moyenne offrent un premier repère, mais le meilleur choix dépend toujours du parcours. Les bonus bleus proviennent de l’équipement et s’ajoutent aux notes de base pendant les courses compatibles.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "roster-contracts",
      route: ROSTER_TUTORIAL_ROUTE,
      targetId: "roster-rating-table",
      title: "Lisez le salaire et l’échéance ensemble",
      content:
        "Le salaire est affiché par semaine et par saison : il pèse sur le budget de l’équipe pendant toute la durée du contrat. L’échéance indique la dernière saison couverte.\n\nUn contrat garantit la présence du coureur jusqu’à son terme. Anticipez les fins de contrat : une prolongation sécurise le coureur pour la saison suivante, mais engage aussi le futur budget.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "open-first-rider",
      route: ROSTER_TUTORIAL_ROUTE,
      targetId: "roster-rating-table",
      title: "Passez de l’équipe au coureur",
      content:
        "Chaque nom ouvre une fiche détaillée. Pour poursuivre la visite sans vous faire choisir au hasard, le bouton « Suivant » ouvrira la fiche du premier coureur de votre effectif.\n\nDans votre gestion quotidienne, vous pourrez naturellement consulter n’importe quel coureur de la liste.",
      placement: "top",
      highlightPadding: 6,
    },
    {
      key: "rider-overview",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      routeTargetId: "roster-rating-table",
      targetId: "rider-profile-overview",
      title: "La carte d’identité sportive du coureur",
      content:
        "L’en-tête réunit son âge, sa nationalité, son équipe, son potentiel, son expérience et ses jours de course en carrière. Ces informations replacent ses notes dans leur contexte : un jeune talent et un vétéran de même niveau ne représentent pas le même projet sportif.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "rider-experience-potential",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-overview",
      title: "Expérience et talent façonnent le coureur",
      content:
        "Les JDC correspondent exclusivement aux jours de course réellement disputés pendant toute la carrière : une classique vaut 1 JDC et chaque étape courue d’un tour vaut 1 JDC. Un non-partant ne gagne aucun JDC. Les juniors et les coureurs générés pour les enchères commencent à 0. Chaque JDC apporte 0,2 point d’expérience, soit 100/100 après 500 JDC. L’expérience procure un bonus mesuré en course : un coureur expérimenté exploite un peu mieux ses qualités qu’un débutant.\n\nLe talent est représenté par le potentiel. Chaque demi-étoile augmente le plafond de moyenne du coureur de 5 points et améliore aussi l’efficacité de sa progression à l’entraînement. Un fort potentiel ne remplace donc pas les notes actuelles : il indique jusqu’où le coureur peut évoluer.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "rider-ratings",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-stats",
      title: "Notes et patatoïde racontent le même profil",
      content:
        "Le détail reprend toutes les caractéristiques du coureur. Le patatoïde les traduit visuellement : ses pointes révèlent immédiatement les domaines dominants et ses creux les faiblesses à protéger.\n\nUtilisez les valeurs exactes pour comparer deux coureurs proches, et le graphique pour comprendre rapidement leur équilibre général.",
      placement: "right",
      highlightPadding: 8,
    },
    {
      key: "rider-naturalization",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-naturalization",
      title: "La naturalisation obéit à des règles strictes",
      content:
        "Un professionnel devient naturalisable après trois saisons complètes — 84 jours de jeu — passées sans interruption dans la structure. Sa nationalité devient alors celle du pays d’affiliation de l’équipe.\n\nLa naturalisation est impossible s’il a déjà été champion national sur route ou en contre-la-montre : ce titre l’attache définitivement à son pays d’origine. Le bouton affiche le décompte restant tant que l’ancienneté requise n’est pas atteinte.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "rider-form",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-form",
      title: "La forme mesure l’état du moment",
      content:
        "La forme complète les qualités permanentes du coureur : elle indique dans quel état il abordera ses prochains objectifs. Surveillez-la avant une course importante et utilisez repos, entraînement et stages avec discernement.\n\nLe fonctionnement détaillé de la progression et de la forme sera présenté dans le didacticiel consacré à l’entraînement.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "rider-special-abilities",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-abilities",
      title: "Les capacités spéciales complètent les notes",
      content:
        "Les médaillons représentent les capacités spéciales connues ou débloquées par le coureur. Elles apportent des effets particuliers sans remplacer ses caractéristiques.\n\nNous ne les détaillons pas toutes ici : survolez un médaillon sur ordinateur, ou sélectionnez-le sur téléphone, pour découvrir son effet lorsque vous en avez besoin.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "rider-season-program",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-planning",
      title: "Cadencez toute la saison du coureur",
      content:
        "Le programme de la saison rassemble courses, stages, reconnaissances, blessures et autres indisponibilités sur les 28 jours. Il permet de visualiser les enchaînements, d’éviter les chevauchements et de préparer les pics de forme.\n\nPlanifiez les objectifs majeurs, puis ménagez assez de temps pour l’entraînement, la récupération et les stages nécessaires.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "rider-contract",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-contract",
      title: "Gérez le contrat avant l’échéance",
      content:
        "La fiche privée rappelle le salaire, le début et la fin du contrat. Lorsque la prolongation est disponible, elle indique la demande du coureur pour la saison suivante.\n\nRenouveler sécurise sa présence mais réserve une place et un budget futurs. Laisser expirer le contrat expose au départ du coureur : prenez la décision en fonction de son rôle, de son évolution et de vos finances.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "rider-history",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-history",
      title: "Relisez toute sa carrière",
      content:
        "L’historique présente saison par saison les équipes passées, les victoires, les points, les titres, les résultats notables et le classement UCI. Les noms d’équipes encore actives donnent accès à leur fiche.\n\nCette vue permet de distinguer une belle note théorique d’un coureur qui a déjà prouvé sa valeur dans les résultats.",
      placement: "right",
      highlightPadding: 8,
    },
    {
      key: "rider-equipment",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      targetId: "rider-profile-equipment",
      title: "Équipez le coureur pièce par pièce",
      content:
        "Chaque emplacement accepte une catégorie précise : casque, lunettes, gants, cuissard, cadre, roues ou chaussures. Choisissez une pièce disponible dans l’inventaire, puis glissez-la vers le bon slot ou utilisez le bouton de remplissage.\n\nLes bonus actifs sont récapitulés sous le cycliste et s’ajoutent aux caractéristiques concernées pendant les courses compatibles.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: ROSTER_TUTORIAL_RIDER_ROUTE,
      title: "Votre effectif est prêt à être piloté",
      content:
        "Vous savez maintenant lire les notes et les contrats, évaluer l’expérience et le talent, consulter la forme et les capacités, planifier la saison, retracer la carrière et équiper un coureur.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera disponible à tout moment depuis les points d’interrogation de l’Effectif et de la fiche coureur.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
