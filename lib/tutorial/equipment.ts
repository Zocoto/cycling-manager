import type { TutorialDefinition } from "@/types/tutorial";

export const EQUIPMENT_TUTORIAL_KEY = "equipment";
export const EQUIPMENT_TUTORIAL_VERSION = 2;

export const EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE = "/jeu/materiel";
export const EQUIPMENT_TUTORIAL_PARTNER_ROUTE = "/jeu/materiel/equipementier";
export const EQUIPMENT_TUTORIAL_INVENTORY_ROUTE =
  "/jeu/inventaire?categorie=equipment";

export const EQUIPMENT_TUTORIAL_GLASSES_CATALOG_KEY =
  "tutorial-welcome-glasses";
export const EQUIPMENT_TUTORIAL_GLASSES_NAME = "Lunettes didactiques";

export const equipmentTutorialDefinition = {
  key: EQUIPMENT_TUTORIAL_KEY,
  version: EQUIPMENT_TUTORIAL_VERSION,
  type: "contextual",
  title: "Maîtriser le matériel",
  description:
    "Comparez le matériel commercial, découvrez les contrats équipementiers et apprenez à équiper vos coureurs depuis leur fiche.",
  autoStart: false,
  replayable: true,
  steps: [
    {
      key: "equipment-commercial-overview",
      route: EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
      targetId: "equipment-commercial-overview",
      title: "Le matériel transforme les qualités d’un coureur",
      content:
        "La boutique commerciale vend huit familles de matériel : casque, gants, cuissard, lunettes, chaussures, roues avant et arrière, puis cadre.\n\nChaque exemplaire rejoint l’inventaire de l’équipe. Une pièce ne peut être portée que par un seul coureur à la fois et ses effets s’ajoutent aux statistiques de base lorsqu’ils sont compatibles avec la course.",
      placement: "bottom",
      requirement: "team_created",
      highlightPadding: 8,
    },
    {
      key: "equipment-commercial-brands",
      route: EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
      targetId: "equipment-commercial-brands",
      title: "Comparez les philosophies des marques",
      content:
        "Les marques commerciales proposent des gammes et des prix différents. Filtrer par marque permet de comparer rapidement leur positionnement : polyvalence, montagne, sprint, chrono, protection ou prestige.\n\nAjoutez plusieurs références et quantités au panier : la trésorerie n’est débitée qu’au moment de régler l’ensemble, puis toutes les pièces rejoignent votre inventaire.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "equipment-commercial-filters",
      route: EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
      targetId: "equipment-commercial-filters",
      title: "Trouvez la bonne pièce avec les filtres",
      content:
        "Filtrez d’abord par emplacement, puis par effet recherché. Les abréviations MON, VAL, PLA, CLM, PAV, SPR, ACC, DES, END, RES, REC et PRO correspondent aux statistiques des coureurs ; d’autres filtres isolent la protection ou les gains de réputation.\n\nVous pouvez combiner une marque, une catégorie et un effet.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "equipment-commercial-products",
      route: EQUIPMENT_TUTORIAL_COMMERCIAL_ROUTE,
      targetId: "equipment-commercial-products",
      title: "Lisez les gains avant d’acheter",
      content:
        "Chaque fiche précise le prix, la rareté, l’emplacement et les gains exacts. Les bonus de statistiques s’ajoutent aux notes du coureur ; les effets conditionnels, comme ceux réservés au chrono, ne s’activent que dans la situation annoncée.\n\nPlusieurs pièces équipées sur un même coureur peuvent cumuler leurs effets.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "equipment-partner-overview",
      route: EQUIPMENT_TUTORIAL_PARTNER_ROUTE,
      targetId: "equipment-partner-overview",
      title: "L’équipementier est un partenariat d’équipe",
      content:
        "Une fois le seuil de réputation atteint, votre équipe peut signer gratuitement avec un équipementier. Chaque marque possède une philosophie et des terrains de prédilection différents ; sa dotation devient équipable sans contingent pendant toute la durée du contrat.\n\nCes références restent hors inventaire : elles constituent un droit d’usage temporaire lié au contrat. Les prototypes uniques sont développés séparément dans le Labo R&D de votre équipe.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "equipment-partner-rules",
      route: EQUIPMENT_TUTORIAL_PARTNER_ROUTE,
      targetId: "equipment-partner-rules",
      title: "Un engagement technique de deux saisons",
      content:
        "Le contrat ne coûte rien, mais il est irrévocable, dure deux saisons et ne peut pas être prolongé avec la même marque. Toute la dotation du partenaire est retirée à son terme.\n\nLa rubrique équipementier ne comporte plus de R&D ni d’offres aléatoires : les recherches se mènent uniquement dans votre propre laboratoire sur les pièces de votre stock.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "equipment-partner-workflow",
      route: EQUIPMENT_TUTORIAL_PARTNER_ROUTE,
      targetId: "equipment-partner-workflow",
      title: "Le contenu s’adapte à votre situation",
      content:
        "Avant 200 points de réputation, cette zone affiche votre progression vers le déblocage. Une fois le seuil atteint, elle compare la philosophie et les points forts des partenaires encore disponibles. Après signature, elle regroupe toute la dotation. Le Labo R&D dispose de son propre onglet dans la rubrique Matériel.\n\nUne marque déjà utilisée ne pourra pas être choisie une seconde fois.",
      placement: "top",
      highlightPadding: 8,
    },
    {
      key: "equipment-inventory-overview",
      route: EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
      targetId: "equipment-inventory-overview",
      title: "Tout votre matériel se retrouve dans l’inventaire",
      content:
        "L’inventaire réunit les achats commerciaux, les récompenses matérielles et les autres objets gagnés. Les compteurs distinguent les exemplaires possédés, disponibles, déjà équipés ou programmés.\n\nPour vous souhaiter la bienvenue, une paire de « Lunettes didactiques » vient d’être ajoutée gratuitement à votre inventaire. Elle apporte +1 en END au coureur qui la porte.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "equipment-inventory-categories",
      route: EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
      targetId: "equipment-inventory-categories",
      title: "Isolez le matériel disponible",
      content:
        "La catégorie Matériel affiche uniquement les pièces réellement détenues : achats et récompenses. Une fiche indique la quantité libre, les coureurs équipés et la valeur de reprise.\n\nLes références du partenaire ne chargent pas l’inventaire : elles restent accessibles sans contingent depuis la fiche de chaque coureur tant que le contrat est actif.",
      placement: "bottom",
      highlightPadding: 8,
    },
    {
      key: "equipment-welcome-gift",
      route: EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
      targetId: "equipment-welcome-gift",
      title: "Essayez vos Lunettes didactiques",
      content:
        "Pour essayer vos Lunettes didactiques, déroulez « Choisir dans l’effectif », comparez les notes affichées sous les noms, sélectionnez un coureur puis cliquez sur « Équiper ce matériel ». Si le slot Lunettes est déjà occupé, la ligne apparaît dans une couleur différente et précise la pièce remplacée.\n\nVous pouvez réaliser l’essai maintenant, puis revenir à l’infobulle pour poursuivre. Ce cadeau n’est accordé qu’une seule fois, même si vous rejouez le didacticiel.",
      placement: "left",
      allowTargetInteraction: true,
      highlightPadding: 8,
    },
    {
      key: "equipment-unequip",
      route: EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
      targetId: "equipment-welcome-gift",
      title: "Équipez ou retirez sans perdre l’objet",
      content:
        "Vous pouvez aussi gérer l’équipement depuis la fiche d’un coureur : glissez une pièce vers le slot surligné ou utilisez « Remplir ce slot ». Le bouton « Retirer le matériel » libère immédiatement l’emplacement et replace l’objet dans les disponibilités de l’inventaire.\n\nDe cinq minutes avant le départ jusqu’à la fin de la course du coureur, son équipement est figé afin de préserver la simulation.",
      placement: "left",
      highlightPadding: 8,
    },
    {
      key: "complete",
      route: EQUIPMENT_TUTORIAL_INVENTORY_ROUTE,
      title: "Votre atelier est prêt",
      content:
        "Vous savez désormais acheter et filtrer le matériel commercial, comprendre un contrat équipementier, lire les gains, retrouver les propriétaires d’une pièce, puis équiper ou déséquiper un coureur.\n\nCliquez sur « Terminer » pour valider ce didacticiel. Il apparaîtra comme réalisé dans le Centre des didacticiels et restera disponible depuis les points d’interrogation des rubriques Matériel, Équipementier et Inventaire.",
      placement: "center",
    },
  ],
} satisfies TutorialDefinition;
