# Calendrier élite à partir de la saison 5

Validé par le propriétaire le 27 octobre 2026. S5 : du 6 novembre au 3 décembre.
Les dates ci-dessous sont des journées de jeu ; les heures sont celles de Paris.

| Tour | Journées | Étapes |
|---|---|---:|
| Corsa delle Regioni | J2–J7 | 12 |
| Tour des Volcans du Pacifique | J3–J5 | 5 |
| Tour des Plaines | J6–J8 | 5 |
| Boucle des Provinces | J9–J14 | 12 |
| Ruta de las Sierras | J17–J22 | 12 |
| Aurora Borealis Tour | J18–J20 | 6 |
| Tour des Hautes Vallées | J21–J23 | 5 |

Deux étapes par journée, à 14 h puis 18 h ; la dernière étape des tours impairs est à 14 h.

| J | Heure | Classique | Profil | Monument |
|---:|---|---|---|---|
| 2 | 18 h | Circuit des Salines | Sprint | |
| 8 | 18 h | Enfer des Dunes | Pavés | Oui |
| 9 | 18 h | GP des Plaines du Danube | Sprint | |
| 10 | 18 h | Cime du Tyrol | Montagne | |
| 11 | 18 h | Couronne des Ardennes | Vallons | Oui |
| 12 | 18 h | Mur de Catalogne | Vallons | |
| 13 | 18 h | Classique du Caucase | Montagne | |
| 14 | 18 h | Desert to Sky Classic | Vallons | |
| 16 | 14 h | Classique des Hauts-Cols | Montagne | |
| 16 | 18 h | Pavés de Zélande | Pavés | Oui |
| 17 | 18 h | GP de la Pampa | Sprint | |
| 23 | 18 h | Traversée des Flandres | Pavés | Oui |
| 25 | 14 h | Doyenne des Collines | Vallons | Oui |
| 25 | 18 h | Patagonia Fin del Mundo | Montagne | |
| 27 | 14 h | Chrono des Fjords | CLM | |
| 27 | 18 h | Classique des Lacs | Vallons | Oui |
| 28 | 18 h | Grand Prix du Littoral | Sprint | |

## Garanties et mise en place

- 24 éditions / 74 étapes : 7 tours, 17 classiques, 6 Monuments (3 pavés / 3 vallons).
- Aucune course à J1. Aucun élite à J15, J24 ou J26 ; deux éditions élite au maximum par jour, donc par créneau également.
- Inscriptions normales : fermeture à 08 h pour un premier départ à 14 h, à 12 h pour un premier départ à 18 h. Corsa : J2 à 08 h, le 7 novembre en S5. Les wildcards conservent leur échéance distincte à H−24.
- Les nouvelles épreuves sont implantées en Tunisie (Salines), Hongrie (Plaines et Danube), Slovénie (Hauts-Cols), Argentine (Pampa), Suisse (Hautes Vallées), Belgique (Doyenne).
- Les éditions, étapes, profils, inscriptions et préparations existants gardent leurs identifiants. Seules les coordonnées de calendrier et les échéances correspondantes changent. Deux courses inférieures en conflit national avec les dates approuvées sont replacées sur la journée libre la plus proche.
- Les étapes ajoutées possèdent des tronçons exploitables par le moteur ; les nouveaux tours incluent les sprints intermédiaires et GPM, avec les barèmes existants.
- La préparation automatique des saisons réapplique le plan S5 après la copie et la compaction. L’ancienne exception du Mur de Catalogne à J28 reste limitée aux anciens calendriers.
- Le nouveau Monument utilise le prestige, les primes et les classements existants, avec un trophée vectoriel propre, le Laurier des Collines. Aucun chargement ou appel réseau supplémentaire sur les pages du calendrier.
- Le succès historique à cinq Monuments différents conserve son seuil et ses gains. Son titre devient « Collection des classiques » pour rester exact avec six épreuves. Aucun gain n’est attribué par la migration.
- Aucune simulation ou inscription de test en production. Aucun calendrier S4 modifié. Les fonctions de quotas CM/CC sont contrôlées par empreinte avant/après.

## Vérifications

`node scripts/test-s5-elite-calendar-sql.mjs` utilise PostgreSQL isolé (PGlite), les 445 courses standard / 697 étapes du calendrier précédent, et les vraies fonctions/déclencheurs concernés. Vérifie le plan entier, les heures, les profils, les GPM, l’absence de J1 et de conflit international, la limite de deux courses, la conservation de S4, des identifiants et préparations, la répétition de la migration et la génération automatique depuis S4 vers une saison ultérieure. Le module PGlite peut être fourni via `LOCAL_CALENDAR_SQL_TEST_MODULE`.

Tests applicatifs ciblés : prestige, trophées, calendrier, préparation des inscriptions ; TypeScript, ESLint et catalogue de traduction.

Livraison contrôlée : `node scripts/deliver-s5-elite-calendar.mjs --preflight`, puis `--apply-reviewed-migration` et `--verify`. Le script applique uniquement `20261027160000_expand_s5_elite_calendar.sql` et enregistre sa réception après vérification, avec des délais SQL et de verrouillage bornés.
