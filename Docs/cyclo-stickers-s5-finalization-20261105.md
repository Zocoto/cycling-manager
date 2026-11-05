# Cyclo-Stickers S4, collection S5 — finalisation du 5 novembre

Les décisions de cette livraison remplacent les hypothèses de la maquette du 22 octobre.

- **69 vignettes** : top 50 individuel UCI, top 5 équipes, 10 champions continentaux pros, 2 champions du monde pros, champion des Jeux sur route, Équipier sans tête.
- **Deux cartes par booster**, tirages indépendants, doublons possibles : bronze 80 %, argent 16,9 %, or 3 %, spéciales 0,1 % au total. Les deux cartes EPIC se partagent ce dernier taux, soit **0,05 % chacune**.
- **Un booster tous les trois jours de connexion consécutifs**, à partir de S5. Aucun rattrapage S4. Les références internes historiques `weekly_login` restent compatibles. L’absence remet la série à zéro ; les boosters acquis et la continuité entre saisons sont conservés.
- Parrainage : deux boosters par filleul validé, selon le dispositif existant. Gala : deux boosters par spectateur vérifié, une seule fois pour cette édition. Aucun booster Gazette ni achat ajouté.
- **19 succès conservés** : 712 500 €, 4 150 XP et 220 points de réputation de base au total. Le dernier exige les **69 vignettes collées** et rapporte 250 000 €, 1 000 XP, 100 réputation et le trophée de l’édition S4. Les effets habituels des staffs suivent le circuit de récompense existant.

## Présentation

Couverture et sachets partagent une illustration SVG : vélodrome nocturne, flamme, cycliste officiel d’Halloween et cinq rubans des Jeux. Les deux cartes spéciales portent le badge EPIC, un cadre métallique et des reflets différents. Le format commun de 196 × 324 px reste inchangé. Le mouvement des reflets respecte les préférences de réduction des animations.

## Collection persistante préparée

L’inventaire public repose sur les quantités serveur. Aucune possession de la maquette navigateur n’est importée. L’ouverture verrouille le booster réel de connexion, de parrainage ou du gala et conserve un reçu idempotent. Le client ne choisit ni les cartes ni le hasard. Le collage, les réservations et les transferts sont atomiques ; une carte collée reste protégée.

Les échanges proposent une à trois cartes contre une, avec accord du destinataire, courrier interne, expiration à 48 heures, une proposition sortante en attente et des limites anti-spam. Les deux collections sont verrouillées dans un ordre fixe. Les récompenses possèdent une clé unique par joueur, édition et succès ; leur attribution, le solde, le journal financier, l’XP, la réputation et le trophée appartiennent à la même transaction.

Les lectures sont bornées : 69 positions, 19 succès, 100 boosters fermés affichés, 10 dernières ouvertures et 10 échanges historiques, 20 collectionneurs par recherche. Les stocks au-delà de 100 restent conservés et accessibles au fur et à mesure des ouvertures. Aucun polling, parcours de classements ou chargement de catalogue dans le header. Le drapeau public désactivé ne déclenche aucune requête de catalogue.

## Passage aux données définitives

Au contrôle du 5 novembre, S4 est encore active (J28) et S5 planifiée. La maquette privée reste distincte de l’édition finale. Aucun résultat actif n’est présenté comme définitif ; aucune carte d’essai ni dotation initiale n’est créée en production.

Les identités et maillots S4 ont été conservés avant l’activation des contrats S5 : les contrats renouvelés remplacent sinon leur maillot sélectionné lors de la bascule. La capture du 5 novembre à 09 h 23 UTC contient 202 profils (top 200 provisoire et treize titres vérifiés), 38 équipes et 33 images de maillots. Ces 2,55 Mo d’images sont copiés sous des noms SHA-256, sans régénération ; un changement ultérieur du fichier sponsor ne modifiera pas le souvenir S4. La capture est enregistrée dans `data/collector-album-s4-identity-stage.json`, empreinte `519ee60ea83d22b4e9a1a41756ff781dca79e06e8510b2b72c8e9b871408a91b`.

Cette capture ne constitue pas un classement final. Les notes natives, classements et titres définitifs restent issus de S4 après sa clôture. Un champion ou coureur hors de la capture préparatoire provoque un refus explicite, jamais un repli vers un maillot S5.

Le producteur fournit des lignes bornées et attribuées à S4. `prepare-cyclo-stickers-s4.ts` reconstruit les 69 cartes à partir de ces preuves ; `seal-cyclo-stickers-s4.ts` vérifie à nouveau leur cohérence, produit une empreinte SHA-256 et refuse d’écraser un fichier. Le service de lecture vérifie la même sérialisation canonique. Les sept chapitres de profils et les treize titres sont à contrôler avant publication.

Après clôture :

1. `npx tsx scripts/export-cyclo-stickers-s4.ts final-sql <nouveau-dossier>` prépare huit requêtes sans les exécuter.
2. Exécuter uniquement `01-context.sql` d’abord, vérifier S4 réellement terminée, puis les sept autres requêtes en série avec leurs délais bornés. Sauvegarder chaque résultat dans le fichier JSON correspondant. Aucun appel à un service de maillot S5.
3. `npx tsx scripts/export-cyclo-stickers-s4.ts completed data/collector-album-s4-identity-stage.json <dossier-resultats> <nouvelle-source.json>` combine les classements officiels, notes natives, palmarès et historiques S4 avec les identités conservées. Les valeurs décimales sont préservées ; les absences et incohérences sont refusées.
4. Passer cette source à `prepare-cyclo-stickers-s4.ts`, revoir les 69 cartes, puis sceller avec `seal-cyclo-stickers-s4.ts`. Ces scripts n’installent rien en production.

L’installation de l’édition nécessite un appel de service séparé, une source S4 réellement terminée, puis l’activation explicite des deux drapeaux `enabled` et `publicApproved`. L’ouverture du code public et le raccourci partagé doivent être activés après cette recette, sans nouvelle requête par icône. La migration seule ne publie rien et ne modifie pas la bascule saisonnière.

## Vérifications

- PostgreSQL isolé : 106 contrôles sur l’inventaire, les droits, les reprises, les probabilités, les échanges, les courriers, les récompenses et les annulations complètes en cas d’erreur tardive. Les vrais déclencheurs de bonus staff, d’XP, de réputation et de trophée concernés sont chargés. PGlite utilise une seule connexion : l’ordre des verrous est revu, les courses entre connexions ne sont pas simulées par ce test.
- Cadence de connexion : le scénario isolé `test-weekly-login-boosters-sql.mjs --three-day` contrôle les paliers, la journée de Paris, les répétitions, l’absence, l’intersaison, les droits et l’absence de rattrapage S4.
- Export : 59 contrôles PostgreSQL et fichiers isolés, jusqu’aux treize champions hors top 50. Les identités S5, maillots modifiés, données actives, clubs absents et sources incohérentes sont refusés ou ignorés selon leur provenance.
- Tests ciblés de l’assemblage, du scellement, de l’adaptateur public, des contrôles de route, du livre, des visuels et du trophée.
- Livraison SQL strictement limitée aux migrations `20261105140000` et `20261105141000`, avec empreintes revues, droits vérifiés et inventaires nouveaux laissés vides. Aucun appel de joueur ni fixture en production.

Les deux migrations sont appliquées et leurs reçus vérifiés. Les droits, la RLS et les deux fonctions existantes d’assiduité/cadeaux sont préservés ; aucune édition, carte, ouverture, dotation gala ou récompense n’a été créée. Auth répond HTTP 200 (183 ms), la connexion HTTP 200 (752 ms) après livraison. Ces durées ponctuelles sont des contrôles de disponibilité, pas une mesure globale de performance.
