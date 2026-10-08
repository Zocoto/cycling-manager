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
