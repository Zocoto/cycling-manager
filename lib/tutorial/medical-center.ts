import type { TutorialDefinition } from "@/types/tutorial";

export const MEDICAL_CENTER_TUTORIAL_KEY = "medical-center";
export const MEDICAL_CENTER_TUTORIAL_VERSION = 2;

export const MEDICAL_CENTER_TUTORIAL_ROUTES = {
  injuries: "/jeu/centre-de-soin?onglet=blessures",
  form: "/jeu/centre-de-soin?onglet=forme",
  nutrition: "/jeu/centre-de-soin?onglet=nutrition",
  physiotherapists: "/jeu/centre-de-soin?onglet=kines",
  staff: "/jeu/centre-de-soin?onglet=staff",
} as const;

export const medicalCenterTutorialDefinition = {
  key: MEDICAL_CENTER_TUTORIAL_KEY,
  version: MEDICAL_CENTER_TUTORIAL_VERSION,
  type: "contextual",
  title: "Maîtriser le centre de soins",
  description:
    "Gérez les blessures et la forme, utilisez la nutrition, organisez le suivi des kinés et contrôlez votre équipe médicale.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "medical-center-overview",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.injuries,
      targetId: "medical-center-overview",
      title: "Le tableau de bord de la santé",
      content:
        "Le Centre de soin rassemble toutes les décisions qui influencent la disponibilité et la forme de vos coureurs. Ses cinq onglets séparent les blessures, les stages de forme, la nutrition, les affectations des kinés et le résumé de l’équipe médicale.\n\nLes indicateurs de l’en-tête donnent immédiatement le nombre de blessés, les coureurs en stage, le jour courant et la trésorerie disponible.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "injury-management",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.injuries,
      targetId: "medical-center-injuries",
      title: "Suivez chaque blessure jusqu’à la reprise",
      content:
        "Une blessure rend automatiquement le coureur indisponible pour les courses et les entraînements. La fiche indique le diagnostic, la forme, la perte quotidienne, le temps restant et la date estimée de reprise.\n\nLes médecins réduisent automatiquement la durée initiale des nouvelles blessures. Une blessure de fatigue provoquée par une forme passée sous zéro impose toutefois trois jours de repos et ne peut pas être raccourcie.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "injury-protocols",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.injuries,
      targetId: "medical-center-protocols",
      title: "Choisissez un protocole de soins",
      content:
        "Les protocoles arbitrent entre coût et vitesse de reprise. Leur catalogue reste visible même lorsque l’infirmerie est vide afin de préparer votre budget.\n\nUn seul protocole peut être appliqué à une blessure, tant qu’il reste au moins 24 heures de convalescence. Le gain réel en heures est recalculé pour le diagnostic concerné avant la validation.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "form-management",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.form,
      targetId: "medical-center-form",
      title: "Construisez et protégez la forme",
      content:
        "La forme conditionne la fraîcheur du coureur. Sans course, blessure, entraînement exigeant ou stage, il récupère naturellement 2 points par jour. Une intensité d’entraînement basse, la nutrition et certains effets du staff peuvent aussi accélérer cette remontée.\n\nSurveillez le programme sportif avant d’investir dans un boost : la forme est plafonnée à 100 et doit surtout être disponible au moment des objectifs importants.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "form-camps",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.form,
      targetId: "medical-center-form-camps",
      title: "Programmez un stage de remise en forme",
      content:
        "Choisissez un stage classique (+10 forme par jour) ou premium (+20), puis sélectionnez librement une plage future de un à trois jours. Le niveau cumulé des médecins améliore encore ces gains.\n\nLe planning en ligne désactive les coureurs occupés par une course, une blessure ou un autre stage. Sélectionnez tous les coureurs libres souhaités, puis validez la programmation et son coût en une seule fois dans la barre flottante.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "nutrition-overview",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.nutrition,
      targetId: "medical-center-nutrition",
      title: "La nutrition soutient la récupération",
      content:
        "Les nutritionnistes apportent d’abord un bonus passif de récupération quotidienne à toute l’équipe. Ils débloquent aussi des interventions immédiates qui rendent de la forme à un coureur contre un coût en trésorerie.\n\nLe niveau requis, le gain et le prix diffèrent selon le complément. L’effet est immédiat, ne peut pas dépasser 100 de forme et chaque coureur ne peut recevoir qu’une intervention par jour.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "nutritionist-impact",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.nutrition,
      targetId: "medical-center-nutrition-options",
      title: "Le nutritionniste détermine coût, gain et capacité",
      content:
        "Chaque nutritionniste possède une capacité quotidienne propre. Son niveau réduit le prix des compléments et peut augmenter leur gain de forme ; plusieurs nutritionnistes cumulent en plus leur soutien passif à la récupération.\n\nChoisissez explicitement le spécialiste qui intervient, puis contrôlez son compteur du jour. Le catalogue des compléments reste consultable sans staff pour vous aider à anticiper un futur recrutement.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "physiotherapist-impact",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.physiotherapists,
      targetId: "medical-center-physiotherapists",
      title: "Les kinés économisent la forme",
      content:
        "Un kiné protège les coureurs qui lui sont affectés en course, à l’entraînement et pendant une journée de blessure. Son niveau fixe à la fois le nombre de coureurs suivis et le nombre maximal de points de forme préservés, tout en conservant toujours au moins 1 point de malus.\n\nMême sans kiné recruté, l’aperçu affiché ici présente la future fiche de suivi et ses principaux réglages.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "physiotherapist-assignments",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.physiotherapists,
      targetId: "medical-center-physiotherapist-assignments",
      title: "Constituez les listes de suivi",
      content:
        "Cochez les coureurs à confier au kiné sans dépasser sa capacité, puis enregistrez les affectations. Un coureur ne peut dépendre que d’un seul kiné à la fois, mais vous pouvez compléter ou modifier la sélection plus tard.\n\nL’aperçu reste visible en l’absence de staff : il est volontairement non interactif jusqu’au recrutement de votre premier kiné.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "medical-staff-summary",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.staff,
      targetId: "medical-center-staff",
      title: "Contrôlez toute l’équipe médicale",
      content:
        "Le dernier onglet résume les trois métiers médicaux actifs : les médecins, qui réduisent les convalescences et ajoutent 5 % d’efficacité aux stages par niveau, les nutritionnistes et leurs effets de récupération, puis les kinés et leur capacité de suivi.\n\nUtilisez ce bilan pour repérer un métier absent, consulter les effets cumulés et rejoindre rapidement le marché du staff ou l’onglet opérationnel correspondant.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: MEDICAL_CENTER_TUTORIAL_ROUTES.staff,
      title: "Votre pôle médical est prêt",
      content:
        "Vous savez désormais gérer une blessure et son protocole, reconstruire la forme, utiliser la nutrition, attribuer les coureurs aux kinés et lire le résumé de votre équipe médicale.\n\nCliquez sur « Terminer » pour marquer ce parcours comme réalisé dans le Centre des didacticiels. Il restera disponible à tout moment depuis le point d’interrogation du Centre de soin.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
