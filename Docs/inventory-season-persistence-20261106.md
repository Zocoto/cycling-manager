# Conservation des objets entre saisons — 6 novembre 2026

## Diagnostic

Le signalement de Sevrinovitch est confirmé. Les cadeaux ordinaires de
`daily_reward_inventory` recevaient encore `expires_after_game_year = année + 1`.
Le correctif de septembre reportait les objets génériques, mais ne conservait
les cadeaux quotidiens que si cette ancienne échéance était respectée.
L'inventaire et les RPC d'utilisation écartaient ensuite ces objets.

Les diagnostics en lecture seule retrouvent 633 objets disponibles devenus
invisibles chez 65 directeurs sportifs, sans trace d'utilisation. Sevrinovitch
en a 40, dont un Passage de cap et six Perfectionnements techniques.
Il ne s'agit ni d'une suppression ni d'une perte de quantité par le regroupement
des objets équivalents déployé le 5 novembre.

Le contrôle du registre de transfert des stocks génériques S4 → S5 ne trouve
aucune ligne de stock sans trace de transfert. Ces stocks archivés ne sont pas
recrédités : ils pourraient avoir été utilisés en S5.

## Correction

Migration : `20261106223000_persist_owned_inventory_rewards_across_seasons.sql`.

- Les objets ordinaires disponibles sont permanents ; une normalisation à
  l'écriture et une contrainte protègent également les futurs cadeaux, quelle
  que soit leur provenance.
- La colonne historique conserve sa forme entière et utilise la valeur maximale
  pour rester compatible avec tous les RPC d'utilisation et compteurs existants.
  Cette valeur interne n'est pas affichée aux joueurs.
- Les lignes d'origine sont conservées, avec leur identifiant, propriétaire,
  provenance et date d'acquisition. Le rattachement saisonnier est remis à jour
  uniquement pour la même équipe avec son manager actuel.
- Les objets utilisés ne sont pas restaurés. Une éventuelle ligne marquée
  expirée n'est rétablie qu'en l'absence de date/payload d'utilisation et de toute
  trace d'effet activé, réservation, soin ou supervision. Les conversions de
  matériel sont exclues de cette restauration.
- Un registre privé conserve les anciennes valeurs. La réparation et le report
  saisonnier sont idempotents.
- Les effets déjà activés et les réservations de courses gardent leur durée
  propre. Les portefeuilles d'événements et éditions de stickers ne sont pas
  modifiés.
- L'IHM FR/EN annonce la conservation entre saisons. Aucune requête supplémentaire
  n'est ajoutée à l'ouverture des pages.

## Vérification et livraison

- 36 vérifications SQL isolées : reproduction du défaut, restauration, quatre
  exclusions de traces d'utilisation, propriétaire, usage réel +1 MO une seule
  fois, refus d'utilisation par un autre manager, conversion réelle d'un cadeau
  matériel une seule fois, nouvelles acquisitions, réapplication et report S6.
- 26 tests applicatifs : regroupement et quantités, équivalences, cadeaux et rendu.
- ESLint ciblé et catalogue de traductions.
- Diagnostics et application réels séquentiels : `statement_timeout = 5s`,
  `lock_timeout = 500ms`. Aucune fixture ni action de joueur simulée en production.
- Script de livraison : `scripts/deliver-inventory-reward-persistence.mjs`.
- Preuves locales : `C:/Dev/artifacts/inventory-persistence-20261106`, notamment
  `before.json`, `verified.json`, diagnostics et preuve du déploiement Vercel.

Le script vérifie les identifiants et métadonnées d'origine, l'invariant de
conservation, les droits du registre privé, les fonctions d'effets et de report
inchangées, la connexion SQL et la disponibilité HTTP du site.
