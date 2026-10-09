# Halloween 2026 — mise en production

Ouverture : vendredi 9 octobre 2026 à 00:00, Europe/Paris (8 octobre 22:00 UTC).
Fin des jeux : 3 novembre à 00:00, Europe/Paris. Boutique jusqu'au 10 novembre à 00:00.
Le code est déployé avant l'ouverture ; l'horloge PostgreSQL autorise automatiquement les jeux à l'heure prévue. Aucun réveil du PC n'est nécessaire.

## Livraison

- Page `/jeu/halloween`, accès depuis le bureau du DS uniquement pendant l'édition.
- Portefeuille indépendant des finances de l'équipe, 24 roues de bienvenue une seule fois.
- Cycling Hollow : un essai quotidien, un second avec ticket ; preuve de partie entièrement rejouée côté serveur, sauvegarde locale reprenable, crédit atomique unique.
- Trick or Treat : un tirage quotidien de 5 roues ; probabilités et doublons décrits dans la page.
- Boutique réelle, inventaire persistant, quotas d'achats et de reliques distincts des cadeaux.
- Objets de forme, soin, expérience, morphologie, potentiel, âge et infrastructures ; refus hors des limites et pendant une course, sans consommation.
- Décorations natives du portrait avec apparence originale préservée ; sorts de 24 h maximum, levée gratuite.
- Podiums quotidiens, lots finaux des cinq premiers, tenue et cadre exclusifs du vainqueur. Règlement atomique et relançable.
- Cron Vercel authentifié toutes les quinze minutes, délai de cinq minutes pour les derniers essais de la journée.

## Vérifications

69 assertions SQL exécutées dans PostgreSQL isolé (PGlite), aucune fixture en production.
182 tests ciblés du moteur, équipements et preuves de partie ; 9 tests supplémentaires de la frontière API.
Recette visuelle locale : bureau d'événement, boutique, poursuite et affichage responsive sans débordement horizontal.
L'aperçu `/apercus/halloween-recette` est interdit en production ; ses actions réelles sont désactivées.

Les migrations sont appliquées une par une, fermées par défaut, avec attente de verrou de 3 s et durée de requête de 30 s. Seul ce lot Halloween est appliqué, pas les migrations étrangères encore présentes dans le dépôt.

## Exploitation

Activer l'édition seulement après validation du déploiement et de la connexion SQL :

```sql
UPDATE public.halloween_editions SET enabled=true
WHERE id='halloween-2026' AND starts_at='2026-10-08 22:00Z';
```

Arrêt d'urgence : même requête avec `enabled=false`. Les soldes et objets restent conservés ; la levée gratuite des sorts reste disponible. Ne pas supprimer les tables ni rejouer des courses historiques.

Contrôle après minuit : état et dates de l'édition, disponibilité du site, déploiement Vercel READY, absence d'erreurs du cron. Vérifications en lecture seule, bornées, séquentielles ; aucun compte de joueur utilisé comme fixture.

## Correctif visuel du 9 octobre

- Rétablissement du thème saisonnier approuvé à la racine du site, du 9 octobre au 2 novembre inclus, heure de Paris. Aucune requête supplémentaire pour le thème, aucun changement des couleurs sémantiques des alertes, notes ou drapeaux.
- Header de jeu natif sur `/jeu/halloween`, avec identité réelle du DS, sponsor et raccourcis habituels ; il reste disponible si le chargement de l'événement échoue.
- Accueil illustré : poursuite nocturne, Trick or Treat et boutique. Les trois illustrations restent visibles sur téléphone ; bannière recadrée sans couper les cyclistes.
- Recette locale uniquement, avec les mêmes composants et la même enveloppe mobile que la production. Navigation testée sans achats, participation ni essai réel ; largeurs de 320 et 390 px sans débordement.
- 36 tests ciblés (thème, accueil, preuves et API), lint des fichiers modifiés. Deux anciens tests de header sont déjà obsolètes dans le commit de base : un fichier retiré et une ancienne signature monoligne. Aucun changement de header partagé pour les contourner.
- Aucun changement SQL, de solde, d'inventaire, de récompense, de cron ou de moteur dans ce correctif.

## Bonbons et essayage du 9 octobre

- Trick or Treat : exactement deux bonbons, orange et violet, cliquables directement dans les mains du cycliste sur la grande scène centrale. Choix utilisable au clavier et zones tactiles d'au moins 44 px. Probabilités détaillées dans un volet dépliable.
- Règles de l'aperçu conservées : 50 % de mauvaise pioche (perte de la mise de 5 roues), 50 % de récompense ; aucune conséquence négative sur l'équipe. Tirage et limite quotidienne toujours autoritaires côté serveur. Verrou client synchrone contre les clics concurrents, choix réactivé si la requête échoue.
- Boutique et collection : chaque cosmétique présente le portrait personnel du DS avec l'élément essayé, via le même rendu natif que le portrait équipé. Comparaison actuelle / essayage dans un dialogue accessible, fermeture au clavier et par bouton. L'essayage ne déclenche aucune requête d'achat ou d'équipement.
- Remplacement du seul emplacement concerné (cadre, tenue, etc.), conservation du portrait natif et des autres accessoires. Les transformations sont également prévisualisables ; les malédictions préexistantes sont ignorées dans l'essayage, comme indiqué à l'écran.
- 59 tests ciblés réussis, lint des fichiers modifiés, contrôle visuel bureau et mobile 320 / 390 px sans débordement. Un clic dans la recette locale est refusé par l'API avec 403, sans débit, puis les deux choix se réactivent.
- Aucun changement SQL ni réinitialisation des bonbons déjà choisis ; soldes, inventaires et probabilités conservés.
