# Classiques pavés / vallons à partir de S5

Demande du propriétaire du 4 novembre : diversifier les parcours hybrides dans
chaque catégorie, garder J1 sans courses et afficher les deux difficultés.

## Nouvelles classiques

| Catégorie | Course | Pays | Journée / heure de Paris | Distance |
|---|---|---|---|---:|
| Élite | Classique des Pavés de Bratislava | Slovaquie | J28 / 14 h | 226 km |
| Mondial | Baltijos Grįstos Kalvos | Lituanie | J11 / 18 h | 212 km |
| Continental | Tartu Munakiviklassik | Estonie | J17 / 14 h | 192 km |
| National | Vidzemes Bruģa Klasika | Lettonie | J23 / 14 h | 172 km |
| Régional | Klasik Kamenih Brežuljaka | Bosnie-Herzégovine | J14 / 18 h | 148 km |

Les pays accueillent actuellement une seule épreuve standard hors circuit local.
J28 à 14 h est le dernier créneau Élite compatible avec le plafond de deux
épreuves par jour et les journées internationales réservées.

Le circuit local conserve **quatre classiques et un mini-tour par pays**. Sa
deuxième classique devient un vrai parcours hybride, sans changer ses nom,
identifiant, distance, date ou conditions d'accès. Cela concerne les 56 pays
déjà présents en S5 et les futurs circuits générés pour un nouveau pays actif.

## Parcours et affichage

Trois familles : cinq côtes roulantes, six côtes plus pentues, ou huit côtes
d'endurance. Les côtes font 2 à 3 km et alternent avec des descentes, des portions
asphaltées et des secteurs pavés. Certaines côtes sont elles-mêmes pavées.
Le final plat de 6 à 7 km permet un sprint réduit sans assimiler le parcours à
une course de plaine. Aucun classement ou type de vainqueur n'est imposé.

Le libellé **Pavé / Vallonné** (**Cobbles / Hills** en anglais) s'applique aussi
aux parcours standard existants qui combinent réellement les deux difficultés :
au moins 10 km pavés, 450 m d'ascension et deux côtes d'au moins 3 %, avec une
distance détaillée conforme à la distance annoncée. Arctic Endurance Classic
fait partie de ces parcours. Les chronos, montagnes et championnats
internationaux ne reçoivent pas cette annotation.

Le domaine sportif `hilly` ou `cobbles` reste conservé. L'annotation utilise la
colonne déjà chargée par le calendrier, les aperçus, les inscriptions, la
préparation, le direct et les résultats : aucune requête supplémentaire par
page. Le moteur, les barèmes, l'accès aux courses et les règles de sélection
restent ceux existants.

## Livraison et vérification

- Migration ciblée `20261104160000_expand_s5_hilly_cobbled_calendar.sql`,
  transaction atomique, attente de verrou 500 ms, requêtes limitées à 5 s.
- Application uniquement aux saisons planifiées à partir de S5, après les
  profils pavés déjà livrés ; le générateur de circuits locaux reçoit aussi
  son point d'intégration. Les calendriers réservés encore vides sont ignorés.
- Réapplication sans doublon ni recréation des secteurs conformes. Une course
  commencée ou dotée d'une simulation enregistrée refuse une modification.
- S4, les résultats, les dates et distances des courses existantes, les
  inscriptions et les préparations restent conservés.
- Vérification PostgreSQL isolée avec les vrais déclencheurs de calendrier,
  les anciens profils et les copies S4 vers S6 puis S5 vers S6 :
  `TEST_S5_HYBRID_CALENDAR=1 node scripts/test-s5-elite-calendar-sql.mjs`.
- Tests applicatifs sur les libellés FR/EN, le chargement sans lecture des
  secteurs, la cohérence des parcours et la détection d'un sprint réduit.
- Livraison : `node scripts/deliver-s5-hybrid-calendar.mjs --preflight`, puis
  `--apply-reviewed` et `--verify`. Les preuves sont enregistrées dans
  `C:/Dev/artifacts/s5-hybrid-calendar-20261104`.

Aucune course n'est rejouée et aucune action de joueur n'est simulée en production.

## Vérification de production

Le 4 novembre à 12 h 01, heure de Paris : migration appliquée et enregistrée,
cinq nouvelles classiques aux créneaux ci-dessus, 56 classiques locales
converties et 86 étapes annotées au total dans les six catégories. J1 reste
vide, le plafond Élite reste à deux courses par jour, les empreintes des données
protégées sont inchangées et le site répond HTTP 200. Les 107 tests applicatifs
ciblés, la validation PostgreSQL isolée, ESLint et le catalogue anglais passent.
