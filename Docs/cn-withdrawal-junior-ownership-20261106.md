# Désinscriptions CN et renforts juniors — 6 novembre 2026

## Cause confirmée

Les erreurs de production sur la sauvegarde CN indiquaient : « Ce coureur ne fait plus partie de l’effectif actif de cette équipe ». La grille de Fra Troisset comporte 38 professionnels et aucun choix S5 n’avait été enregistré. Son équipe possède aussi deux juniors représentés par des coureurs de compétition de statut `academy`, liés à son école pour S5.

La sauvegarde applique les choix du DS puis synchronise les autres inscriptions de son équipe. Le classement national inclut les juniors de renfort depuis la saison 3. Le contrôle de propriété ajouté pour les transferts exigeait cependant un contrat professionnel pour toute entrée portant une équipe de club. Il rejetait donc les juniors légitimes et annulait toute la transaction, y compris les désinscriptions des professionnels.

Le même contrôle était rencontré par la synchronisation globale lors de l’ouverture de la page. Il ne s’agit pas d’une clôture du calendrier : les deux disciplines concernées sont prévues le 13 novembre.

## Correctif

Une seule fonction est modifiée : `private.guard_live_rider_commitment_ownership()`.

La validation professionnelle existante reste prioritaire et inchangée. Sans contrat professionnel, une entrée CN route ou CLM peut être validée uniquement si le coureur est un représentant `academy`, possède un lien de compétition pour la saison exacte, appartient à une école active/recrutée de l’équipe concernée, et a la nationalité de la course. Ces lignes sont verrouillées en lecture partagée sans attente afin de prévenir un changement de propriétaire pendant l’inscription.

Cette reconnaissance ne s’applique ni aux courses ordinaires, ni aux stages, ni aux reconnaissances. Les ex-professionnels, mauvais propriétaires, liens d’une autre saison, juniors libérés et nationalités incompatibles restent refusés. Les retraits et les historiques restent autorisés comme auparavant.

Aucune règle de qualification, préférence, date, rôle ou résultat n’est modifiée. Aucun choix n’est effectué au nom de Fra Troisset : les tentatives antérieures ayant été annulées, il doit enregistrer à nouveau ses choix.

## Validation et livraison

Le test PostgreSQL isolé utilise les vraies fonctions de sauvegarde, de synchronisation et de retrait. Il reproduit d’abord l’annulation de la grille avec l’ancien contrôle, puis vérifie le correctif et la préservation des protections de transfert. Aucune simulation d’action de joueur n’est exécutée en production.

`node scripts/test-cn-withdrawal-ownership-sql.mjs`

`node scripts/deliver-cn-withdrawal-ownership.mjs --preflight`, puis `--apply-reviewed` et `--verify`. Diagnostics en lecture seule, séquentiels et bornés à cinq secondes. La migration ne contient que la définition du contrôle et ses privilèges ; aucun stock, inscription ou résultat de joueur n’est réécrit.

Les traces de diagnostic et de livraison sont conservées dans `C:/Dev/artifacts/cn-withdrawal-20261106`.
