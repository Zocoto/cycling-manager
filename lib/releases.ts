export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  description: string;
  features: readonly string[];
};

export const releases = [
  {
    version: "Patch #1",
    date: "26 juillet 2026",
    title: "Livraison Patch#1",
    description:
      "Une livraison majeure qui consolide les parcours de jeu, corrige les blocages signalés et enrichit les courses, le matériel, la progression et l’identité visuelle des coureurs.",
    features: [
      "Correction des objets d’augmentation de potentiel, y compris les bonus fractionnaires auparavant considérés comme invalides.",
      "Poursuite du didacticiel avec le Critérium de la Découverte : inscription guidée, attribution des rôles, explication du comportement IA et course fictive sans gain ni perte de forme.",
      "Passerelle directe entre la prise en main initiale de l’équipe et le didacticiel de course.",
      "Nouvelle lecture horizontale des groupes en course live, ordonnés de la tête aux attardés avec tous les écarts calculés par rapport au leader.",
      "Résultats officiels, annuaire des directs, profils d’étape et actualités d’après-course fiabilisés.",
      "Gestion du matériel repensée : retrait d’un objet, attribution depuis l’inventaire, propriétaires visibles et maintien sur la page après équipement.",
      "Équipement façon RPG avec miniatures dans les slots, liste des objets disponibles, glisser-déposer, surbrillance de la destination et silhouette du coureur réactive.",
      "Déclin exponentiel à partir de 32 ans, résistance progressive via l’entraînement et nouvelle capacité spéciale « Santé de fer » pour les longévités exceptionnelles.",
      "Entraînements clarifiés avec une introduction plus concise et un « Seuil minimal de forme » immédiatement compréhensible.",
      "Maillots de champions nationaux reconstruits à partir des drapeaux réels, avec métadonnées de couleurs par pays, avatars dédiés et habillage cohérent des fiches coureurs.",
      "Calendrier enrichi, programmation nationale affinée et éligibilité des reconnaissances sécurisée.",
      "Nouveau parcours de wildcards pour les équipes Élite et objectifs de carrière plus nombreux et plus variés.",
      "Tableau de bord enrichi : fil d’événements paginé, actualités du peloton, aperçus coureurs et accès plus directs aux actions importantes.",
      "Corrections de suppression de compte, de classement, de tri d’effectif, de simulation et des parcours de navigation.",
      "Interface harmonisée sur mobile et ordinateur, avec visuels sponsors optimisés, navigation et accessibilité renforcées.",
    ],
  },  {
    version: "0.1.0",
    date: "Juillet 2026",
    title: "Les fondations de Cyclo Stratège",
    description:
      "Le projet prend forme avec ses premières fondations techniques, fonctionnelles et graphiques.",
    features: [
      "Création de l’architecture initiale de l’application",
      "Mise en place du design system Peloton UI v0.2",
      "Conception de la première ébauche du modèle de données",
      "Création du socle public et de la navigation",
    ],
  },
] as const satisfies readonly ReleaseNote[];

export const latestRelease = releases[0];