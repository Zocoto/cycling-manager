# Boosters de fidélité à partir de S5

Demande validée le 27 octobre 2026 : un booster de Cyclo-Stickers tous les sept jours de connexion consécutifs, à partir de la saison 5.

## Règles

- Attribution automatique à 7, 14, 21, 28, 35 jours, etc. Aucun cadeau à réclamer pour faire avancer la série.
- Journées calendaires à l’heure de Paris. Plusieurs visites dans la même journée comptent pour une seule connexion.
- Un jour manqué remet la série à 1 au prochain retour ; les boosters déjà acquis restent conservés.
- Première journée comptée en S5. Aucun historique de connexion S4 importé ou récompensé. La série continue ensuite entre les saisons.
- Le booster est associé à l’édition de collection de la saison active au moment où il est gagné. Un booster S5 reste associé à S5 quand la saison suivante commence.
- Le cycle de 40 cadeaux quotidiens reste indépendant : il ne perd pas son avancement après une absence et ses gains habituels restent disponibles.
- Les bots et DS inactifs sont exclus.

## Attribution et stockage

L’attribution est raccordée à `record_current_sporting_director_attendance`, déjà appelé par le layout après la réponse de la page. Le hook ne traite que les nouvelles journées réelles/de jeu en S5 ou ultérieure. Le premier `INSERT` quotidien dans `player_daily_activity` est également raccordé : le heartbeat de présence existant couvre ainsi un onglet qui reste ouvert d’un jour à l’autre. Ses `UPDATE` ultérieurs ne déclenchent aucun traitement de bonus ; les imports d’activités historiques sont ignorés. Aucun nouveau RPC, polling ou parcours des connexions historiques.

`weekly_login_booster_states` conserve une ligne par DS. L’écriture d’une nouvelle journée verrouille seulement cette ligne ; une seconde visite relit le résultat et ne fait rien. `cyclo_stickers_boosters` conserve chaque booster réel, avec propriétaire, saison de collection, source, référence unique et état d’ouverture. Les droits authentifiés sont limités à la lecture de ses propres lignes. L’attribution utilise une référence unique par série/palier et une transaction commune avec le compteur.

Le payload existant `get_current_daily_reward_overview` inclut `weeklyLogin`. Une visite authentifiée de cette page enregistre aussi immédiatement la connexion pour que le compteur ne dépende pas du timing du hook de layout. Le service et la rubrique des cadeaux affichent la progression sur sept jours, le total gagné et le message de gain du jour. Aucune requête réseau supplémentaire.

La collection actuellement privée reste une maquette conservée dans le navigateur. Cette livraison prépare le stock réel de boosters ; elle n’ouvre pas cet aperçu au public et n’attribue aucune carte de démonstration. Le raccordement du tirage serveur au stock `cyclo_stickers_boosters` fait partie de l’ouverture publique de l’album : le tirage devra consommer atomiquement un booster du bon propriétaire et de la bonne édition, puis enregistrer ses cartes. Aucun état du navigateur ne doit faire autorité.

## Vérifications et livraison

- `node scripts/test-weekly-login-boosters-sql.mjs` : PostgreSQL isolé, vrais DDL/fonctions existants concernés. S4, absence de rattrapage, saison planifiée, paliers 7/14/21/28/35, répétitions, continuité intersaison, édition du booster, absence/reset, bots/inactifs, lecture privée, impossibilité de fabriquer/ouvrir un booster côté client, maintien des cadeaux et réexécution de migration.
- Tests ciblés : calcul des semaines, lecture du payload, rendu S5 et absence du panneau S4, maintien du cycle de quarante cadeaux et du garde-fou de lancement de l’album.
- ESLint, TypeScript et catalogue FR/EN.
- `scripts/deliver-weekly-login-boosters.mjs` : précontrôle en lecture seule, application des deux migrations requises, vérification des droits/hooks et des empreintes des cinq fonctions existantes de choix/utilisation des cadeaux et de présence. Aucun appel de connexion ni attribution de test en production. En S4, les deux nouvelles tables doivent rester vides.

Migrations : `20261027170000_weekly_login_cyclo_stickers_boosters.sql` et `20261027171000_weekly_login_boosters_game_presence.sql`.
