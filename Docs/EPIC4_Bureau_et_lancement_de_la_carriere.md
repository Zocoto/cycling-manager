# EPIC 4 — Bureau et lancement de la carrière

## 1. Objectif de l’EPIC

L’EPIC 4 a pour objectif de transformer un compte authentifié en véritable carrière jouable dans Cyclostratège.

À l’issue de cette EPIC, un utilisateur peut :

- accéder à son bureau de Directeur Sportif ;
- compléter son profil ;
- choisir sa nationalité et son avatar ;
- créer automatiquement sa structure amateur ;
- recevoir un effectif initial de 7 coureurs ;
- consulter son équipe depuis une page dédiée ;
- retrouver sur son bureau les informations réelles de sa carrière.

---

## 2. Périmètre fonctionnel réalisé

### US10 — Bureau du Directeur Sportif

Création du tableau de bord principal accessible à l’adresse :

```text
/jeu
```

Fonctionnalités réalisées :

- accès direct au bureau après authentification ;
- affichage du profil du Directeur Sportif ;
- affichage des objectifs ;
- présentation des principaux modules du jeu ;
- navigation vers la modification du profil ;
- intégration du système de déconnexion ;
- prise en charge des états incomplets et des erreurs de récupération.

### US11 — Profil du Directeur Sportif

Création de la page :

```text
/jeu/directeur-sportif
```

Fonctionnalités réalisées :

- choix d’un avatar parmi 12 propositions ;
- choix de la nationalité ;
- nationalité rendue permanente après le premier enregistrement ;
- gestion du nom d’affichage ;
- gestion de la confidentialité de l’adresse e-mail ;
- ajout des points de réputation ;
- ajout d’un niveau cosmétique lié à la réputation ;
- affichage du profil sur le bureau ;
- contrôle d’accès lié au compte authentifié.

### US12 — Équipe amateur et effectif initial

L’US12 a absorbé le périmètre initialement prévu dans les anciennes US12 à US15.

Fonctionnalités réalisées :

- création transactionnelle de l’équipe amateur ;
- rattachement du Directeur Sportif à l’équipe comme manager général ;
- inscription de l’équipe dans la saison active ;
- création automatique de 7 coureurs ;
- création des contrats initiaux ;
- création des notes sportives de la saison ;
- génération de noms cohérents avec la nationalité du Directeur Sportif ;
- protection contre la création multiple d’une équipe ou d’un effectif ;
- affichage du nom réel de l’équipe sur le bureau ;
- affichage du nombre réel de coureurs ;
- création de la page Effectif ;
- navigation depuis la carte Effectif du bureau.

---

## 3. Règles métier retenues

### Équipe initiale

Chaque Directeur Sportif reçoit une structure amateur unique.

Le nom technique de l’équipe reste unique en base grâce à un suffixe interne. Ce suffixe n’est jamais affiché dans l’interface.

Exemple visible :

```text
Équipe amateur de Paul Paul
```

### Effectif initial

Chaque joueur reçoit exactement 7 coureurs.

Les âges sont toujours répartis ainsi :

```text
18, 19, 20, 21, 22, 23 et 24 ans
```

Chaque âge apparaît une seule fois.

Les sept profils sportifs sont fixes et équilibrés :

1. Grimpeur
2. Puncheur
3. Rouleur / spécialiste du contre-la-montre
4. Sprinteur
5. Spécialiste des pavés
6. Baroudeur
7. Polyvalent / équipier

Chaque joueur reçoit la même somme globale de statistiques afin de garantir l’équité de départ.

### Nationalité et noms

Les 7 coureurs initiaux utilisent la même nationalité que le Directeur Sportif.

Les noms sont générés côté serveur à partir de bibliothèques régionales.

Le projet contient :

- 39 profils régionaux ;
- 3 963 prénoms ;
- 3 957 noms de famille ;
- un validateur garantissant la cohérence et l’absence de doublons dans les bibliothèques.

L’Afghanistan dispose d’un profil dari/pachto distinct de l’Asie centrale turcique. La péninsule Arabique est également séparée du profil Levant–Mésopotamie afin de préserver des patronymes régionaux plus crédibles.

Le rattrapage conserve les identifiants, contrats et historiques des coureurs afghans déjà créés, mais remplace leurs anciennes identités centrasiatiques par des identités issues du nouveau profil.

### Contrats initiaux

Les 7 coureurs reçoivent un contrat :

- actif immédiatement ;
- valable uniquement pour la saison en cours ;
- avec un salaire initial de 0 EUR ;
- expirant à la fin de la saison active.

L’objectif est de laisser au joueur une saison complète pour préparer les premiers renouvellements.

### Idempotence et sécurité

La génération initiale est transactionnelle.

En cas d’erreur :

- aucune équipe partielle n’est conservée ;
- aucun coureur partiel n’est conservé ;
- aucun contrat partiel n’est conservé.

Une deuxième tentative après une génération réussie ne crée aucun doublon.

Les fonctions PostgreSQL utilisent `auth.uid()` et sont accessibles uniquement au rôle `authenticated`.

---

## 4. Écrans livrés

### Bureau du Directeur Sportif

Route :

```text
/jeu
```

Informations affichées :

- identité du Directeur Sportif ;
- avatar ;
- nationalité ;
- réputation ;
- visibilité de l’adresse e-mail ;
- équipe amateur ;
- saison active ;
- jour courant ;
- nombre réel de coureurs ;
- objectif initial ;
- cartes des futurs modules.

La carte Effectif est cliquable et ouvre la page dédiée.

### Profil du Directeur Sportif

Route :

```text
/jeu/directeur-sportif
```

Cette page permet de modifier les informations encore modifiables du profil.

### Effectif

Route :

```text
/jeu/effectif
```

Informations affichées :

- nom de l’équipe ;
- saison et jour courant ;
- nombre de coureurs ;
- tranche d’âge ;
- niveau moyen ;
- échéance des contrats ;
- identité de chaque coureur ;
- nationalité ;
- âge ;
- profil sportif ;
- 13 caractéristiques ;
- moyenne du coureur ;
- salaire ;
- échéance contractuelle.

---

## 5. Données et architecture ajoutées

### Bibliothèques de noms

Répertoire :

```text
data/rider-names/
```

Fichiers principaux :

- `profiles.json`
- 37 fichiers régionaux contenant chacun 100 prénoms et 100 noms.

### Générateur d’identités

Fichier :

```text
lib/rider-names/generate-rider-identities.ts
```

Responsabilités :

- sélectionner les bonnes bibliothèques ;
- générer 7 identités uniques ;
- créer une graine stable pour les futurs avatars ;
- ne jamais envoyer les statistiques depuis le client.

### Validation des bibliothèques

Script :

```text
scripts/validate-rider-names.mjs
```

Contrôles réalisés :

- correspondance entre profils et fichiers ;
- minimum de 100 prénoms ;
- minimum de 100 noms ;
- absence de doublons ;
- cohérence des codes de profils.

### Fonctions PostgreSQL principales

#### `initialize_sporting_director_career(jsonb)`

Crée atomiquement :

- l’équipe ;
- l’affectation du Directeur Sportif ;
- l’inscription en saison ;
- les 7 coureurs ;
- leurs contrats ;
- leurs notes ;
- le registre empêchant une seconde génération.

#### `get_current_rider_generation_profile()`

Retourne le profil de génération de noms et d’avatars lié à la nationalité du Directeur Sportif connecté.

#### `get_current_team_dashboard_summary()`

Retourne les informations nécessaires au bureau :

- équipe ;
- nom visible ;
- nombre de coureurs ;
- saison ;
- jour courant.

#### `get_current_team_roster()`

Retourne l’effectif courant et les données nécessaires à la page Effectif.

---

## 6. Migrations créées pendant l’EPIC 4

### US11

```text
20260716144126_restrict_countries_to_sovereign_states.sql
20260716145415_remove_low_relevance_sporting_nationalities.sql
20260716150544_add_sporting_director_avatar.sql
20260717043354_add_sporting_director_reputation.sql
20260717050536_add_sporting_director_email_visibility.sql
20260717054817_extend_sporting_director_avatar_choices.sql
```

### US12

```text
20260717061156_seed_initial_active_season.sql
20260717071446_prepare_initial_rider_generation.sql
20260717075900_seed_rider_name_profiles.sql
20260717121023_create_initial_career_generation_function.sql
20260717121839_expose_current_rider_generation_profile.sql
20260717123513_add_team_season_currency.sql
20260717124209_add_rider_contract_currency.sql
20260717124933_expose_current_team_dashboard_summary.sql
20260717125802_reapply_current_team_dashboard_summary.sql
20260717130659_fix_current_team_dashboard_summary_result_types.sql
20260717131852_hide_initial_team_technical_suffix.sql
20260717132431_expose_current_team_roster.sql
```

Les migrations déjà appliquées ne doivent jamais être réécrites. Toute correction future doit passer par une nouvelle migration.

---

## 7. Validation technique réalisée

Contrôles validés :

- `npm run lint`
- `npm run build`
- génération des 39 bibliothèques de noms ;
- validation de 3 963 prénoms et 3 957 noms ;
- création unique de l’équipe ;
- création des 7 coureurs ;
- création des contrats ;
- création des notes ;
- affichage sur le bureau ;
- accès à la page Effectif ;
- navigation depuis la carte Effectif ;
- seconde sauvegarde du profil sans duplication.

Commit principal de l’US12 :

```text
d7491bd feat: create initial amateur team and roster
```

Branche :

```text
feature/us12-equipe-amateur-effectif-initial
```

---

## 8. Étapes restantes avant livraison de l’EPIC 4

### 1. Rejouer les migrations sur une base locale vide

Commande :

```powershell
npx supabase db reset
```

Attention : cette commande supprime uniquement les données de la base Supabase locale.

Objectifs :

- vérifier que toutes les migrations se rejouent dans l’ordre ;
- vérifier qu’aucune migration ne dépend d’un état manuel ;
- détecter les éventuelles incohérences liées aux migrations correctives.

### 2. Refaire un parcours complet sur un compte local neuf

Scénario de recette :

1. créer un nouveau compte ;
2. confirmer le compte ;
3. se connecter ;
4. compléter le profil du Directeur Sportif ;
5. vérifier la création unique de l’équipe ;
6. vérifier les 7 coureurs ;
7. vérifier les âges de 18 à 24 ans ;
8. vérifier les contrats actifs ;
9. vérifier le bureau ;
10. ouvrir la page Effectif ;
11. enregistrer une seconde fois le profil ;
12. confirmer qu’aucun doublon n’est créé.

### 3. Pousser les migrations vers Supabase distant

À faire seulement après validation du reset local.

Contrôles recommandés :

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
```

### 4. Fusionner les branches de l’EPIC vers `main`

Les travaux US10, US11 et US12 doivent être fusionnés vers `main` uniquement après validation de la base distante.

### 5. Déployer sur Vercel

Le déploiement Vercel sera déclenché après la fusion dans `main`.

### 6. Recette de production

Contrôles minimaux :

- inscription ;
- confirmation par e-mail ;
- connexion ;
- accès à `/jeu` ;
- profil Directeur Sportif ;
- création de l’équipe ;
- création des 7 coureurs ;
- page Effectif ;
- absence de doublons ;
- déconnexion ;
- reconnexion ;
- persistance de toutes les données.

---

## 9. Évolutions volontairement repoussées

Les sujets suivants ne font pas partie de l’EPIC 4 finalisée :

- moteur d’avatars originaux et génératifs pour les coureurs ;
- fiche individuelle complète d’un coureur ;
- radar ou patatoïde des statistiques ;
- historique des équipes et des saisons ;
- rapports d’entraînement ;
- blessures et rapports médicaux ;
- gestion avancée des contrats ;
- renouvellements et négociations ;
- sponsoring ;
- stages ;
- centre de formation ;
- détection des jeunes ;
- gestion du staff ;
- ajustements UX détaillés de l’EPIC 3.

---

## 10. Procédure de lancement officiel à prévoir

La saison actuellement créée est une saison de développement.

Avant l’ouverture officielle du jeu, une procédure dédiée devra :

- supprimer les comptes et données de bêta ;
- supprimer les carrières de test ;
- réinitialiser les équipes et les coureurs ;
- créer la Saison 1 officielle ;
- positionner le calendrier au Jour 1 ;
- conserver les référentiels et les migrations ;
- ne jamais modifier les migrations historiques déjà appliquées.

Cette opération devra utiliser un script ou une procédure de reset dédiée, testée avant le lancement officiel.
