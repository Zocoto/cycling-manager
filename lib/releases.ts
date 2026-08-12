export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  description: string;
  features: readonly string[];
};

export const releases = [
  {
    version: "Patch #4",
    date: "12 ao\u00fbt 2026",
    title: "Les infrastructures passent un cap",
    description:
      "Cinq jours de livraisons r\u00e9unis dans un patch centr\u00e9 sur le d\u00e9veloppement du club, avec de nouveaux b\u00e2timents, des championnats enrichis et de nombreux parcours de gestion fiabilis\u00e9s.",
    features: [
      "Centre d\u2019entra\u00eenement \u2014 dix niveaux pour augmenter le nombre d\u2019entra\u00eeneurs, l\u2019efficacit\u00e9 des s\u00e9ances et la protection de la forme ; deux programmes d\u00e8s le niveau 5 et deux entra\u00eeneurs par coureur d\u00e8s le niveau 7.",
      "Piste indoor \u2014 deux jours de pr\u00e9paration pour accorder des bonus temporaires croissants en sprint et en acc\u00e9l\u00e9ration.",
      "Centre de cryoth\u00e9rapie \u2014 de 10 \u00e0 50 % de protection suppl\u00e9mentaire sur la perte de forme apr\u00e8s-course, cumulable avec le travail du kin\u00e9.",
      "Soufflerie \u2014 deux jours de pr\u00e9paration cibl\u00e9e pour am\u00e9liorer temporairement le contre-la-montre, le prologue et l\u2019endurance.",
      "Laboratoire R&D \u2014 recherche risqu\u00e9e mais puissante sur un objet pr\u00e9cis, avec co\u00fbt, dur\u00e9e et taux de r\u00e9ussite modul\u00e9s par le niveau du laboratoire et le nouvel ing\u00e9nieur R&D.",
      "Centre d\u2019accueil international \u2014 naturalisations acc\u00e9l\u00e9r\u00e9es, affinit\u00e9s de staff \u00e9tendues aux pays voisins puis au continent, bonus de local de l\u2019\u00e9tape et traitement acc\u00e9l\u00e9r\u00e9 des juniors.",
      "Centre m\u00e9t\u00e9o \u2014 pr\u00e9visions de course accessibles de plus en plus t\u00f4t \u00e0 mesure que le b\u00e2timent progresse.",
      "Media Center \u2014 propositions d\u2019articles et publicit\u00e9s sponsors dans La Cyclogazette, avec davantage d\u2019impact pour les community managers, la r\u00e9putation, la popularit\u00e9 et les fans.",
      "Rubrique infrastructures \u2014 b\u00e2timents constructibles sans architecte obligatoire, visuels d\u00e9di\u00e9s, progression par niveau et classement permanent du moins cher au plus cher.",
      "Championnats nationaux \u2014 inscription automatique des 200 meilleurs mondiaux et des coureurs libres, retrait possible par le DS, simulation simultan\u00e9e sans live, r\u00e9sultats centralis\u00e9s et un point de r\u00e9putation par victoire.",
      "Championnats du monde \u2014 courses route et CLM visibles par tous, directs \u00e0 14 h et 18 h, s\u00e9lections nationales annonc\u00e9es quatre jours avant et huit meilleurs coureurs des nations qualifi\u00e9es.",
      "Championnats continentaux \u2014 arriv\u00e9e des CLM, s\u00e9lections nationales, maillots de champions, nouveaux bar\u00e8mes et r\u00e9gularisation des titres et gains de la premi\u00e8re saison.",
      "Palmar\u00e8s \u2014 courses majeures mieux mises en avant et nouveaux troph\u00e9es de champion national, continental et mondial.",
      "Calendrier \u2014 dates et cat\u00e9gories affich\u00e9es, courses tri\u00e9es chronologiquement et programmation des championnats fiabilis\u00e9e.",
      "Pr\u00e9paration de course \u2014 notes des coureurs visibles, r\u00f4les par \u00e9tape, planification du mat\u00e9riel et d\u00e9sactivation claire des consignes tactiques sur les contre-la-montre.",
      "Contrats et sponsoring \u2014 drapeau du pays du sponsor, dur\u00e9e active corrig\u00e9e, prolongations simplifi\u00e9es, renouvellement group\u00e9 et meilleure coh\u00e9rence des transitions de carri\u00e8re.",
      "March\u00e9 des coureurs \u2014 offres directes, licenciements encadr\u00e9s et historique conserv\u00e9 lors des transferts, retraites ou changements de statut.",
      "Bo\u00eete mail du DS \u2014 r\u00e9sultats majeurs, championnats, s\u00e9lections internationales et rapports de recrutement rassembl\u00e9s avec un suivi de lecture fiable.",
      "Nutrition \u2014 r\u00e9partition group\u00e9e s\u00e9curis\u00e9e par le contingent disponible, tarifs r\u00e9\u00e9quilibr\u00e9s et r\u00e9cup\u00e9ration quotidienne corrig\u00e9e.",
      "R\u00e9compenses quotidiennes \u2014 cycle complet de dix paliers, naturalisation imm\u00e9diate parmi les gains possibles, continuit\u00e9 entre les saisons et retour au palier 1 apr\u00e8s le dixi\u00e8me.",
      "Parrainage \u2014 lien personnel, objets de niveau 5 \u00e0 7, troph\u00e9es de parrain et tenue de c\u00e9r\u00e9monie d\u00e9bloqu\u00e9e \u00e0 cinq filleuls qualifi\u00e9s.",
      "Fan Club et communaut\u00e9 \u2014 nouveau si\u00e8ge, boutique, ventes, popularit\u00e9, likes et commentaires dans La Cyclogazette, ainsi que r\u00e9actions nomm\u00e9es dans le chat.",
      "\u00c9quipe de d\u00e9veloppement \u2014 structure junior, effectif d\u00e9di\u00e9, nouvelles comp\u00e9titions et r\u00e9compenses \u00e9largies pour faire progresser les jeunes.",
      "Confort de jeu \u2014 en-t\u00eate mobile regroup\u00e9, didacticiels compacts, profils responsives, compteur de DS restaur\u00e9 et changements de saison rendus atomiques pour supprimer retards et \u00e9tats incoh\u00e9rents.",
    ],
  },
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
  },
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
