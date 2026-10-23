# Grand Gala S4 — publication et inscriptions

## Choix validés

- Ouverture à tous les comptes connectés, depuis le menu principal et le bureau.
- Clôture automatique le jeudi 5 novembre 2026 à **23 h 59, Europe/Paris**
  (`2026-11-05T22:59:00Z`). Simulation le vendredi 6 novembre avec Gouille,
  horaire encore à annoncer.
- Un seul programme par équipe, trois compositions de 7–8 coureurs, différentes
  si souhaité. Identité, appartenance et statistiques natives de la saison 4.
- Continental : chaque note primaire native ≤75, sans équipement. Le plafond
  reste vérifié à l’export ; aucune réduction artificielle des notes.
- Sans frais, impact sportif, points UCI ou interférence avec les inscriptions
  officielles. Les inscriptions peuvent être remplacées ou retirées avant la
  clôture. La sauvegarde des trois compositions est atomique.
- Aucun plafond d’inscription ; un dépassement PCM reste un arbitrage explicite,
  jamais une suppression d’équipes à l’export.

## Accès d’organisation

Les exports SL, modèles et base PCM sont réservés aux UUID authentifiés de Zocoto
et de Gouille (compte actif **Cidrerie de l’Aulne**). Le profil homonyme sans équipe
ni connexion n’est pas autorisé. Aucun rôle administratif supplémentaire accordé.
L’import et la distribution des résultats restent réservés à Zocoto.

## Données et performances

Migration dédiée `20261023173000_open_season_four_gala_registrations.sql`, SHA-256
`f79e490928518d0e8c2ba738eb9f2cf0299fbde0117defe125c1e3422d3f8909`.
Les tables restent privées ; quatre RPCs authentifiées étroites couvrent contexte,
sauvegarde, retrait et engagés. Aucun identifiant de propriétaire fourni par le
client. Sérialisation par équipe, attente de verrou bornée, garde de résultats
existante conservée et validation de la dernière appartenance S4.

Une requête compacte pour son propre contexte à l’ouverture de la page. Les
engagés sont chargés seulement à l’ouverture d’une rubrique, par pages de vingt
équipes, avec des noms et des maillots réels. Pas de statistiques privées des
autres équipes, de polling ou de requête par coureur. Les trois noms à suivre
s’affichent après clôture, selon la spécialité native, sans révéler les notes.
La tuile du bureau et le lien de menu n’ajoutent aucune requête.

Les parcours de base PCM et les dotations du 23 octobre sont préservés. Aucune
distribution de lots ou création d’inscription au déploiement. Les équipes et
favoris fictifs n’existent que dans la recette locale interdite en production.
Les fonctions de l’ancien gala et de règlement des lots ne sont pas modifiées.

## Actualité

`gala-s4-announcement-20261023.json` contient les textes FR/EN et l’illustration
SVG locale, légère, noire et or. Publication d’un nouvel article en tête du fil
par les routines d’édition auditées existantes, avec identité Zocoto et UUID
idempotent. L’ancienne release note est conservée dans l’historique, sans modifier
son contenu. La publication vérifie d’abord que le nouvel asset est en ligne.

Les modalités de présence Twitch pour les gants et boosters et l’heure du live
restent à finaliser ; ce n’est pas un blocage pour les inscriptions. Aucun cadeau
de présence n’est attribué à la seule lecture de la page.

## Validation

Tests SQL exclusivement sur PGlite isolé : droits, rôle authentifié, atomicité,
compositions, appartenance après transfert, plafond exact/fractionnaire, passage
entre programmes, protection après import, pagination, fermeture et retrait.
Tests applicatifs : sessions, accès des deux organisateurs, refus d’homonymie ou
de rôle usurpé, paramètres bornés, erreurs réseau et présentation publique.
