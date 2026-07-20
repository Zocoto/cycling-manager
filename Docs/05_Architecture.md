# Architecture

## Stack technique

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase
- Vercel

---

## Structure du projet

```text
app/          → Pages et routage Next.js
Docs/         → Documentation du projet
lib/          → Bibliothèques partagées (Supabase...)
public/       → Ressources statiques
services/     → Services métier
types/        → Types TypeScript
# Architecture

## Objectif

Cyclo Stratège est une application web de gestion cycliste construite autour d’une architecture progressive, documentée et versionnée.

L’application sépare clairement :

- l’interface utilisateur ;
- la logique métier ;
- l’accès aux données ;
- le schéma PostgreSQL ;
- la documentation ;
- le déploiement.

---

## Stack technique

- **Next.js** : framework web
- **React** : interface utilisateur
- **TypeScript** : typage du code
- **Tailwind CSS v4** : styles et Design System
- **Supabase** : backend et accès à PostgreSQL
- **PostgreSQL** : base de données relationnelle
- **Git et GitHub** : versionnement
- **Vercel** : hébergement et déploiement continu
- **Supabase CLI** : gestion des migrations de base de données

---

## Structure principale du projet

```text
cycling-manager/
├── app/
├── Docs/
├── lib/
├── public/
├── services/
├── supabase/
│   ├── migrations/
│   └── config.toml
├── types/
├── .env.example
├── .env.local
├── package.json
└── ...
```

### `app/`

Contient les pages et le routage Next.js utilisant l’App Router.

### `Docs/`

Contient la documentation fonctionnelle et technique du projet.

### `lib/`

Contient les bibliothèques et clients techniques partagés.

Le client Supabase est centralisé dans :

```text
lib/supabase.ts
```

### `services/`

Contiendra progressivement les services métier.

Exemples futurs :

```text
services/
├── rider-service.ts
├── team-service.ts
├── race-service.ts
├── sponsor-service.ts
└── season-service.ts
```

Les composants React ne devront pas contenir directement la logique métier complexe.

### `types/`

Contiendra les types TypeScript partagés entre les pages, composants et services.

### `supabase/`

Contient la configuration locale du Supabase CLI et les migrations SQL versionnées.

```text
supabase/
├── config.toml
└── migrations/
```

---

## Connexion à Supabase

L’application communique avec Supabase grâce au SDK :

```text
@supabase/supabase-js
```

Une instance partagée du client est créée dans :

```text
lib/supabase.ts
```

Les informations de connexion sont fournies par les variables d’environnement :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Les vraies valeurs sont stockées dans :

```text
.env.local
```

Ce fichier n’est pas versionné.

Le fichier suivant documente les variables nécessaires sans contenir de valeur réelle :

```text
.env.example
```

La clé secrète Supabase et la clé `service_role` ne doivent jamais être exposées dans le navigateur ni ajoutées au dépôt Git.

---

## Gestion du schéma PostgreSQL

Le schéma de la base n’est pas construit manuellement depuis le Table Editor.

Chaque évolution est enregistrée dans une migration SQL située dans :

```text
supabase/migrations/
```

Exemple :

```text
20260714144346_create_reference_tables.sql
20260714195812_create_team_core_tables.sql
20260714202027_create_rider_core_tables.sql
```

Cette approche permet :

- de versionner le schéma dans Git ;
- de connaître l’ordre des évolutions ;
- de reproduire la base sur un autre environnement ;
- d’identifier précisément les tables créées par chaque US ;
- d’éviter les modifications manuelles non documentées.

---

## Cycle d’une migration

La procédure appliquée est la suivante :

```text
1. Créer une migration
2. Écrire et sauvegarder le SQL
3. Exécuter un dry-run
4. Appliquer la migration
5. Vérifier la synchronisation
6. Contrôler les tables dans Supabase
```

Commandes principales :

```powershell
npx supabase migration new nom_de_la_migration
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
npx supabase db lint --linked --level warning
```

Le `dry-run` est toujours exécuté avant le véritable `db push`.

---

## Migrations initiales

### Référentiels

```text
create_reference_tables
```

Tables concernées :

- `countries`
- `seasons`
- `season_days`
- `divisions`
- `race_categories`

### Équipes et sponsors

```text
create_team_core_tables
```

Tables concernées :

- `sporting_directors`
- `sponsors`
- `sponsor_offers`
- `teams`
- `team_manager_assignments`
- `team_sponsor_contracts`
- `team_seasons`

### Coureurs

```text
create_rider_core_tables
```

Tables concernées :

- `riders`
- `rider_contracts`
- `rider_season_ratings`

### Courses

```text
create_race_core_tables
```

Tables concernées :

- `races`
- `race_editions`
- `stages`
- `stage_segments`
- `race_registrations`
- `race_rosters`

### Objectifs des sponsors

```text
create_sponsor_objective_tables
```

Tables concernées :

- `sponsor_objectives`
- `race_result_objectives`
- `nationality_objectives`
- `season_win_objectives`
- `objective_progress`

### Résultats et points

```text
create_race_result_tables
```

Tables concernées :

- `stage_results`
- `race_results`
- `team_points_events`

---

## Principes d’architecture métier

### Identité permanente et état saisonnier

Les entités permanentes sont séparées de leurs données évoluant chaque saison.

Exemples :

```text
teams
└── team_seasons
```

```text
riders
└── rider_season_ratings
```

```text
races
└── race_editions
```

Cela permet de conserver l’historique sans écraser les anciennes valeurs.

---

### Relations historisées

Les relations temporaires sont représentées par des tables dédiées.

Exemples :

```text
rider_contracts
team_sponsor_contracts
team_manager_assignments
```

Un coureur ne possède donc pas directement un `team_id` permanent.

Une équipe ne possède pas directement un unique `sponsor_id`.

---

### Séparation entre inscription et participation

L’inscription d’une équipe à une course est enregistrée dans :

```text
race_registrations
```

La sélection des coureurs est enregistrée séparément dans :

```text
race_rosters
```

Cette séparation permettra de gérer :

- les invitations ;
- les demandes d’inscription ;
- les refus ;
- les listes de départ ;
- les remplacements ;
- les abandons avant le départ.

---

### Journalisation des points

Le total des points d’une équipe est enregistré dans :

```text
team_seasons.points
```

Chaque mouvement détaillé est conservé dans :

```text
team_points_events
```

Cette table constitue la source permettant d’expliquer le classement d’une équipe et d’éviter les attributions de points en double.

---

## Sécurité de la base

La Row Level Security est activée sur toutes les tables métier du schéma `public`.

Aucune politique permissive n’est encore définie.

Par conséquent, les tables sont fermées par défaut pour les requêtes utilisant la clé publique.

Les politiques RLS seront ajoutées progressivement lorsque les fonctionnalités d’authentification et les écrans métier seront développés.

Les règles devront notamment garantir qu’un directeur sportif ne puisse modifier que :

- son propre profil ;
- son équipe ;
- ses contrats autorisés ;
- ses inscriptions ;
- ses sélections de coureurs.

---

## Responsabilités futures des services

La logique impliquant plusieurs tables ne sera pas placée uniquement dans PostgreSQL.

Des services métier devront notamment contrôler :

### Service des saisons

- création des 28 journées ;
- activation d’une seule saison ;
- passage au jour suivant ;
- vieillissement des coureurs ;
- clôture des contrats ;
- calcul des divisions suivantes.

### Service des équipes

- création d’une équipe après acceptation d’une offre ;
- association du directeur sportif ;
- création du contrat sponsor ;
- création de `team_seasons` ;
- contrôle du budget.

### Service des coureurs

- recrutement ;
- vérification des contrats actifs ;
- statut de coureur libre ;
- création des statistiques de la saison suivante ;
- évolution et vieillissement.

### Service des courses

- validation du calendrier ;
- contrôle des étapes ;
- contrôle de la distance des tronçons ;
- validation des inscriptions ;
- validation des listes de départ.

### Service des résultats

- enregistrement des résultats ;
- création du classement final ;
- attribution des points ;
- mise à jour des objectifs sponsor.

---

## Règles nécessitant un contrôle applicatif

Certaines règles ne peuvent pas être exprimées simplement avec une contrainte portant sur une seule ligne.

Elles seront contrôlées par les services métier :

- la somme des tronçons correspond à la distance de l’étape ;
- une course d’un jour possède exactement une étape ;
- un tour possède plusieurs étapes ;
- le calendrier d’une course respecte la saison concernée ;
- un coureur engagé possède un contrat valide ;
- un coureur ne participe pas à deux étapes le même jour ;
- l’équipe créditée reçoit les points du bon coureur ;
- un objectif sponsor cible une course de la bonne saison ;
- le total des points correspond au journal des mouvements ;
- la saison suivante augmente l’âge des coureurs de 1.

---

## Environnements

### Développement local

L’application est lancée avec :

```powershell
npm run dev
```

Elle est accessible par défaut sur :

```text
http://localhost:3000
```

### Base Supabase distante

Pour le moment, les migrations sont appliquées directement au projet Supabase distant lié au CLI.

Docker n’est pas utilisé pour démarrer une instance complète de Supabase en local.

### Production

Le dépôt GitHub est relié à Vercel.

Le cycle de déploiement est :

```text
Développement local
        ↓
Tests
        ↓
Commit Git
        ↓
Push GitHub
        ↓
Déploiement Vercel
```

Les variables Supabase nécessaires devront également être configurées dans les paramètres d’environnement de Vercel avant qu’une fonctionnalité de production n’interroge réellement la base.

---

## Évolutions futures

L’architecture pourra accueillir progressivement :

- l’authentification ;
- les politiques RLS ;
- les sélections nationales ;
- le staff ;
- les entraînements ;
- les équipements ;
- les transferts ;
- la forme et la fatigue ;
- les blessures ;
- le moteur de course ;
- plusieurs univers ou ligues de jeu ;
- une instance Supabase locale via Docker ;
- des tests automatisés du schéma et des services.