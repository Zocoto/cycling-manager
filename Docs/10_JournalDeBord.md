# 📄 10_JournalDeBord.md

Je te propose d'y ajouter simplement :

```markdown
# US2 – Intégration de Supabase

## Objectif

Connecter l'application Next.js à une base PostgreSQL hébergée sur Supabase.

## Réalisations

- Création de l'organisation Supabase.
- Création du projet "Cyclo Stratège".
- Activation de la Data API.
- Activation du Row Level Security.
- Installation du SDK `@supabase/supabase-js`.
- Création du client partagé `lib/supabase.ts`.
- Configuration des variables d'environnement.
- Création d'un fichier `.env.example`.
- Validation de la connexion avec Supabase.
- Vérification que les clés privées ne sont pas versionnées.

## Résultat

L'application est connectée à Supabase et prête à interagir avec la base de données.

Aucune table n'a encore été créée.
Cette étape sera réalisée dans l'US3.
---

# US3 – Création du modèle de données initial

## Objectif

Concevoir puis implémenter le modèle de données initial de Cyclo Stratège dans PostgreSQL avec Supabase.

Le modèle doit permettre de gérer les principaux domaines du jeu :

- directeurs sportifs ;
- sponsors et offres de sponsoring ;
- équipes et divisions ;
- saisons de 28 jours ;
- coureurs, contrats et statistiques ;
- courses, étapes et profils de parcours ;
- inscriptions et sélections ;
- objectifs des sponsors ;
- résultats et points des équipes.

## Conception métier

Le modèle métier a été défini avant l’implémentation SQL.

Les principaux choix de conception sont :

- séparation entre le compte utilisateur et le directeur sportif ;
- séparation entre un sponsor et l’équipe qu’il finance ;
- prise en charge future des équipes multisponsors ;
- historisation des managers, sponsors et contrats des coureurs ;
- séparation entre les identités permanentes et les états saisonniers ;
- séparation entre une course permanente et ses éditions saisonnières ;
- découpage des étapes en tronçons ordonnés ;
- historisation de l’âge et des statistiques des coureurs par saison ;
- journalisation détaillée des points attribués aux équipes.

## Mise en place des migrations

Installation et initialisation du Supabase CLI dans le projet.

Création du dossier :

```text
supabase/
├── config.toml
└── migrations/