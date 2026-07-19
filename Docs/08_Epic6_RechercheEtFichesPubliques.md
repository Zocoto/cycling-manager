# EPIC 6 — Recherche et fiches publiques

## Périmètre livré

### US18 — Recherche globale

- Champ de recherche présent dans le header du jeu.
- Recherche insensible à la casse à partir de 2 caractères.
- Recherche des Directeurs Sportifs par nom affiché, identifiant public, pays ou équipe actuelle.
- Recherche des équipes par nom, pays, sponsor ou Directeur Sportif.
- Recherche des nations par nom, nationalité ou code ISO.
- Résultats regroupés par catégorie.
- États dédiés pour une recherche vide, trop courte, sans résultat ou indisponible.

La fonction Supabase `search_game_directory` est accessible uniquement aux utilisateurs authentifiés. Elle utilise `security definer` pour traverser les politiques RLS, mais ne retourne que les champs explicitement publics. Aucune adresse e-mail ni donnée de compte privée n’est exposée.

### US19 — Première version des fiches publiques

Routes disponibles :

- `/jeu/directeurs-sportifs/[identifiantPublic]`
- `/jeu/equipes/[identifiant]`
- `/jeu/nations/[codePays]`

La navigation est croisée :

- la fiche d’un Directeur Sportif mène vers sa nation et son équipe actuelle ;
- la fiche d’une équipe mène vers sa nation et son Directeur Sportif ;
- la fiche d’une nation présente ses Directeurs Sportifs et ses équipes, avec un lien vers chaque fiche.

Les fiches n’affichent que les informations déjà disponibles. Des emplacements identifient les futurs blocs sportifs : effectifs, résultats, palmarès, classements, points saisonniers et historique des sponsors.

## Périmètre différé

La rubrique `/jeu/monde`, son entrée dans le header et les classements mondiaux ne font pas partie de cet EPIC. Ils seront développés avec les résultats, points internationaux et compétitions internationales.

Les sponsors et les coureurs pourront rejoindre la recherche lorsque leurs fiches publiques disposeront de suffisamment de contenu.
