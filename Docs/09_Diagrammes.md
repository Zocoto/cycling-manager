# Diagrammes

Ce document présente les relations principales du modèle de données de Cycling Manager.

Le schéma est volontairement séparé en plusieurs diagrammes afin de rester lisible.

---

## Vue d’ensemble du modèle métier

```mermaid
flowchart TD
    USER[Utilisateur Supabase]
    DIRECTOR[Directeur sportif]
    OFFER[Offre de sponsoring]
    TEAM[Équipe]
    TEAMSEASON[Équipe dans une saison]
    RIDERS[Coureurs sous contrat]
    REGISTRATION[Inscription à une course]
    ROSTER[Sélection de coureurs]
    STAGE[Étape]
    RESULTS[Résultats]
    POINTS[Points de l'équipe]
    OBJECTIVES[Objectifs sponsor]

    USER --> DIRECTOR
    DIRECTOR -->|accepte| OFFER
    OFFER -->|donne naissance ou finance| TEAM
    TEAM --> TEAMSEASON
    TEAMSEASON --> RIDERS
    TEAMSEASON --> REGISTRATION
    REGISTRATION --> ROSTER
    ROSTER --> STAGE
    STAGE --> RESULTS
    RESULTS --> POINTS
    OFFER --> OBJECTIVES
    RESULTS --> OBJECTIVES
```

---

## Référentiels et saisons

```mermaid
erDiagram
    SEASONS ||--|{ SEASON_DAYS : "contient 28 jours"

    COUNTRIES ||--o{ SPORTING_DIRECTORS : "nationalité"
    COUNTRIES ||--o{ SPONSORS : "nationalité"
    COUNTRIES ||--o{ TEAMS : "pays d'origine"
    COUNTRIES ||--o{ TEAM_SEASONS : "pays d'enregistrement"
    COUNTRIES ||--o{ RIDERS : "nationalité"
    COUNTRIES ||--o{ RACES : "pays hôte"
    COUNTRIES ||--o{ NATIONALITY_OBJECTIVES : "pays ciblé"

    DIVISIONS ||--o{ TEAM_SEASONS : "classe"

    RACE_CATEGORIES ||--o{ RACE_EDITIONS : "catégorise"
```

---

## Directeurs sportifs, sponsors et équipes

```mermaid
erDiagram
    AUTH_USERS ||--o| SPORTING_DIRECTORS : "possède un profil"

    SPORTING_DIRECTORS ||--o{ TEAM_MANAGER_ASSIGNMENTS : "dirige"
    TEAMS ||--o{ TEAM_MANAGER_ASSIGNMENTS : "est dirigée par"

    SPONSORS ||--o{ SPONSOR_OFFERS : "propose"
    SEASONS ||--o{ SPONSOR_OFFERS : "rend disponible"

    TEAMS ||--o{ TEAM_SPONSOR_CONTRACTS : "est financée par"
    SPONSORS ||--o{ TEAM_SPONSOR_CONTRACTS : "finance"
    SPONSOR_OFFERS ||--o| TEAM_SPONSOR_CONTRACTS : "devient après acceptation"

    TEAMS ||--o{ TEAM_SEASONS : "évolue chaque saison"
    SEASONS ||--o{ TEAM_SEASONS : "contient"
    DIVISIONS ||--o{ TEAM_SEASONS : "détermine le niveau"
```

### Cycle de création d’une équipe

```mermaid
flowchart LR
    A[Directeur sportif inscrit]
    B[Offres de sponsoring disponibles]
    C[Choix d'une offre]
    D[Création de l'équipe]
    E[Création du contrat sponsor]
    F[Création de l'équipe pour la saison]
    G[Recrutement des coureurs]

    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    F --> G
```

---

## Coureurs, contrats et statistiques

```mermaid
erDiagram
    COUNTRIES ||--o{ RIDERS : "nationalité"

    RIDERS ||--o{ RIDER_CONTRACTS : "signe"
    TEAMS ||--o{ RIDER_CONTRACTS : "emploie"

    RIDERS ||--o{ RIDER_SEASON_RATINGS : "possède"
    SEASONS ||--o{ RIDER_SEASON_RATINGS : "historise"

    RIDERS {
        uuid id PK
        uuid country_id FK
        text first_name
        text last_name
        text status
    }

    RIDER_CONTRACTS {
        uuid id PK
        uuid rider_id FK
        uuid team_id FK
        uuid start_season_id FK
        uuid end_season_id FK
        decimal salary_per_season
        text status
    }

    RIDER_SEASON_RATINGS {
        uuid id PK
        uuid rider_id FK
        uuid season_id FK
        smallint age
        smallint mountain
        smallint hills
        smallint flat
        smallint time_trial
        smallint cobbles
        smallint sprint
        smallint acceleration
        smallint downhill
        smallint endurance
        smallint resistance
        smallint recovery
        smallint breakaway
        smallint prologue
    }
```

### Vieillissement d’un coureur

```mermaid
flowchart LR
    S1[Saison 1<br/>Âge : 16 ans]
    S2[Saison 2<br/>Âge : 17 ans]
    S3[Saison 3<br/>Âge : 18 ans]

    S1 -->|nouvelle ligne saisonnière| S2
    S2 -->|nouvelle ligne saisonnière| S3
```

---

## Courses, éditions et calendrier

```mermaid
erDiagram
    COUNTRIES ||--o{ RACES : "pays hôte"

    RACES ||--o{ RACE_EDITIONS : "possède une édition"
    SEASONS ||--o{ RACE_EDITIONS : "programme"
    RACE_CATEGORIES ||--o{ RACE_EDITIONS : "catégorise"

    RACE_EDITIONS ||--|{ STAGES : "comprend"
    SEASON_DAYS ||--o{ STAGES : "programme"

    STAGES ||--|{ STAGE_SEGMENTS : "est découpée en"

    TEAM_SEASONS ||--o{ RACE_REGISTRATIONS : "s'inscrit"
    RACE_EDITIONS ||--o{ RACE_REGISTRATIONS : "reçoit"

    RACE_REGISTRATIONS ||--o{ RACE_ROSTERS : "sélectionne"
    RIDERS ||--o{ RACE_ROSTERS : "participe"
```

### Structure d’une course d’un jour

```mermaid
flowchart TD
    R[Course permanente]
    E[Édition de la saison]
    S[Étape unique]
    T1[Tronçon 1]
    T2[Tronçon 2]
    T3[Tronçon suivant...]

    R --> E
    E --> S
    S --> T1
    S --> T2
    S --> T3
```

### Structure d’un tour

```mermaid
flowchart TD
    R[Course permanente]
    E[Édition de la saison]
    S1[Étape 1]
    S2[Étape 2]
    SN[Étape suivante...]

    R --> E
    E --> S1
    E --> S2
    E --> SN

    S1 --> SEG1[Tronçons ordonnés]
    S2 --> SEG2[Tronçons ordonnés]
    SN --> SEGN[Tronçons ordonnés]
```

### Profil d’une étape

```mermaid
flowchart LR
    A[Étape de 120 km]
    B[Tronçon 1<br/>20 km<br/>Plat<br/>Bitume]
    C[Tronçon 2<br/>20 km<br/>Montée 5 %<br/>Bitume]
    D[Tronçon 3<br/>20 km<br/>Descente -4 %<br/>Bitume]
    E[Tronçon 4<br/>20 km<br/>Plat<br/>Pavés]
    F[Tronçon 5<br/>20 km<br/>Montée 7 %<br/>Pavés]
    G[Tronçon 6<br/>20 km<br/>Descente -5 %<br/>Bitume]

    A --> B --> C --> D --> E --> F --> G
```

Le relief et le revêtement sont indépendants. Une montée ou une descente peut donc être bitumée ou pavée.

---

## Objectifs des sponsors

```mermaid
erDiagram
    SPONSOR_OFFERS ||--|{ SPONSOR_OBJECTIVES : "comprend"
    SEASONS ||--o{ SPONSOR_OBJECTIVES : "évalue"

    SPONSOR_OBJECTIVES ||--o| RACE_RESULT_OBJECTIVES : "type course"
    SPONSOR_OBJECTIVES ||--o| NATIONALITY_OBJECTIVES : "type nationalité"
    SPONSOR_OBJECTIVES ||--o| SEASON_WIN_OBJECTIVES : "type victoires"

    RACE_EDITIONS ||--o{ RACE_RESULT_OBJECTIVES : "est ciblée"
    STAGES ||--o{ RACE_RESULT_OBJECTIVES : "peut être ciblée"
    COUNTRIES ||--o{ NATIONALITY_OBJECTIVES : "est ciblé"

    SPONSOR_OBJECTIVES ||--o{ OBJECTIVE_PROGRESS : "est suivi"
    TEAM_SPONSOR_CONTRACTS ||--o{ OBJECTIVE_PROGRESS : "porte"
    SEASONS ||--o{ OBJECTIVE_PROGRESS : "mesure"
```

### Types d’objectifs disponibles

```mermaid
flowchart TD
    OBJECTIVE[Objectif sponsor]

    RACE[Résultat de course]
    NATIONALITY[Quota de nationalité]
    WINS[Nombre de victoires]

    OBJECTIVE --> RACE
    OBJECTIVE --> NATIONALITY
    OBJECTIVE --> WINS

    RACE --> PARTICIPATION[Participation]
    RACE --> WIN[ victoire]
    RACE --> TOPN[Top N]

    WINS --> ALL[Toutes les victoires]
    WINS --> ONE_DAY[Courses d'un jour]
    WINS --> STAGE[Étapes]
    WINS --> GENERAL[Classements généraux]
```

---

## Résultats et points

```mermaid
erDiagram
    STAGES ||--o{ STAGE_RESULTS : "produit"
    RACE_ROSTERS ||--o{ STAGE_RESULTS : "obtient"

    RACE_EDITIONS ||--o{ RACE_RESULTS : "produit"
    RACE_ROSTERS ||--o{ RACE_RESULTS : "obtient"

    TEAM_SEASONS ||--o{ TEAM_POINTS_EVENTS : "reçoit"
    STAGE_RESULTS ||--o{ TEAM_POINTS_EVENTS : "génère"
    RACE_RESULTS ||--o{ TEAM_POINTS_EVENTS : "génère"
```

### Cycle sportif d’une journée

```mermaid
flowchart TD
    DAY[Jour de saison]
    STAGES[Étapes programmées]
    TEAMS[Équipes inscrites]
    RIDERS[Coureurs sélectionnés]
    SIMULATION[Simulation de course]
    RESULTS[Résultats individuels]
    POINTS[Attribution des points]
    OBJECTIVES[Évaluation des objectifs]
    NEXT[Passage au jour suivant]

    DAY --> STAGES
    STAGES --> TEAMS
    TEAMS --> RIDERS
    RIDERS --> SIMULATION
    SIMULATION --> RESULTS
    RESULTS --> POINTS
    RESULTS --> OBJECTIVES
    POINTS --> NEXT
    OBJECTIVES --> NEXT
```

---

## Diagramme relationnel global simplifié

```mermaid
erDiagram
    AUTH_USERS ||--o| SPORTING_DIRECTORS : "profil"

    SPORTING_DIRECTORS ||--o{ TEAM_MANAGER_ASSIGNMENTS : "gère"
    TEAMS ||--o{ TEAM_MANAGER_ASSIGNMENTS : "manager"

    SPONSORS ||--o{ SPONSOR_OFFERS : "offres"
    SPONSOR_OFFERS ||--o{ SPONSOR_OBJECTIVES : "objectifs"

    TEAMS ||--o{ TEAM_SPONSOR_CONTRACTS : "contrats"
    SPONSORS ||--o{ TEAM_SPONSOR_CONTRACTS : "finance"

    TEAMS ||--o{ TEAM_SEASONS : "saisons"
    SEASONS ||--o{ TEAM_SEASONS : "équipes"
    DIVISIONS ||--o{ TEAM_SEASONS : "division"

    RIDERS ||--o{ RIDER_CONTRACTS : "contrats"
    TEAMS ||--o{ RIDER_CONTRACTS : "effectif"

    RIDERS ||--o{ RIDER_SEASON_RATINGS : "statistiques"
    SEASONS ||--o{ RIDER_SEASON_RATINGS : "évolution"

    RACES ||--o{ RACE_EDITIONS : "éditions"
    SEASONS ||--o{ RACE_EDITIONS : "calendrier"
    RACE_EDITIONS ||--|{ STAGES : "étapes"
    STAGES ||--|{ STAGE_SEGMENTS : "tronçons"

    TEAM_SEASONS ||--o{ RACE_REGISTRATIONS : "inscriptions"
    RACE_EDITIONS ||--o{ RACE_REGISTRATIONS : "participants"
    RACE_REGISTRATIONS ||--o{ RACE_ROSTERS : "sélections"
    RIDERS ||--o{ RACE_ROSTERS : "engagements"

    STAGES ||--o{ STAGE_RESULTS : "résultats"
    RACE_EDITIONS ||--o{ RACE_RESULTS : "classement final"

    TEAM_SEASONS ||--o{ TEAM_POINTS_EVENTS : "points"
    STAGE_RESULTS ||--o{ TEAM_POINTS_EVENTS : "points d'étape"
    RACE_RESULTS ||--o{ TEAM_POINTS_EVENTS : "points finaux"
```

---

## Évolutions futures

Les éléments suivants seront ajoutés dans de futures User Stories :

- sélections nationales ;
- championnats mondiaux et continentaux ;
- staff ;
- équipement ;
- entraînement ;
- forme, fatigue et blessures ;
- négociations de contrats ;
- transferts ;
- sprints intermédiaires ;
- cols et difficultés répertoriées ;
- classements annexes ;
- plusieurs univers ou ligues de jeu.