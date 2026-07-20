export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  description: string;
  features: readonly string[];
};

export const releases = [
  {
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