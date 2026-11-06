# Draft : budget projeté négatif autorisé

À la demande du propriétaire, un budget projeté nul ou négatif ne bloque plus un recrutement de draft, automatique ou manuel. Les joueurs conservent le salaire normal du coureur. Disponibilité, propriété, unicité du choix, dates et capacités d’effectif de la saison actuelle et suivante restent contrôlées.

Le filtre budgétaire est retiré uniquement de `advance_season_draft` et `try_season_draft_pick`. Les calculs de salaire et les protections financières des autres recrutements ne sont pas modifiés. Les lectures de projection et de réservations devenues inutiles dans le traitement automatique sont également supprimées.

La règle s’applique aux choix encore en attente et aux éditions futures. Conformément à la dernière instruction, aucun tour passé, dont celui de Purple Busan Racing, n’est rouvert. Après installation vérifiée, l’avancement normal peut être appelé une fois ; il ne traite que les participants encore en attente.

Validation : tests PostgreSQL isolés sur le recrutement manuel malgré une dette, l’enchaînement immédiat de deux listes automatiques, la rémunération et la durée S6, les places actuelles/futures, la disponibilité et la conservation des anciens tours passés. Un test du panneau vérifie qu’un budget négatif ne désactive pas le bouton Recruter. La nouvelle règle est indiquée en français et en anglais dans les modalités de la draft.

Livraison contrôlée via `scripts/deliver-draft-negative-budget.mjs` : `--preflight`, `--apply-reviewed`, `--advance-live`, `--verify`. La migration ne modifie aucune donnée de joueur. Le traitement réel autorisé est distinct des tests et conserve tous les choix déjà résolus.
