# Fiches coureurs

## Périmètre livré

Chaque coureur possède une fiche authentifiée accessible à l’adresse :

`/jeu/coureurs/[identifiant]`

L’identifiant permanent est l’UUID du coureur. La fiche s’ouvre dans un nouvel onglet depuis les autres écrans afin de préserver la navigation principale du joueur.

La première version présente :

- le grand portrait permanent du coureur avec le maillot de son équipe ;
- son pays, son âge, son équipe actuelle et la saison active ;
- ses treize caractéristiques sous forme de radar et de valeurs exactes ;
- sa forme et sa fatigue quotidiennes ;
- son historique de clubs par saison ;
- ses victoires, points et classement UCI lorsqu’ils existent ;
- six emplacements d’équipement préparés autour d’une silhouette cycliste ;
- un emplacement discret pour ses futures capacités spéciales ;
- un compte rendu d’entraînement verrouillé en attendant le rôle d’entraîneur.

Les informations contractuelles sont strictement réservées au Directeur Sportif qui dirige actuellement l’équipe du coureur. Elles ne sont ni affichées ni transmises à un autre joueur.

## Convention de navigation transverse

Le nom ou le portrait d’un coureur doit mener vers sa fiche partout où il apparaît. Le lien s’ouvre dans un nouvel onglet.

Cette livraison applique la convention à :

- l’effectif privé du Directeur Sportif ;
- l’effectif de la fiche publique d’une équipe ;
- la sélection des coureurs lors d’une inscription ;
- le résumé de l’équipe inscrite à une course ;
- la liste publique des coureurs engagés ;
- le palmarès des éditions passées.

La même convention est obligatoire pour les futurs classements, résultats détaillés, marchés des transferts, entraînements et sélections internationales.

## Fondations de gameplay

Les coureurs existants et nouvellement créés démarrent avec :

- une forme de `75` ;
- une fatigue de `0`.

Les états sont historisés par journée de saison pour préparer les entraînements, les courses et l’évolution dans le temps.

Les bilans saisonniers acceptent les victoires, les points et le classement UCI, mais restent vides tant que le moteur de simulation ne les alimente pas. L’interface affiche alors un tiret et n’invente aucun résultat.

Le catalogue d’équipement est volontairement vide. Les six emplacements sont structurés, mais l’acquisition, la rareté, les bonus et la modification de l’équipement seront définis dans une livraison dédiée. L’équipement sera visible par tous et modifiable uniquement par le DS de l’équipe actuelle.
