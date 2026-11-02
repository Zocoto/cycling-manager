# Transferts entre DS au début de la saison suivante

## Fonctionnement

La proposition depuis une fiche coureur permet de choisir une arrivée dès
l’acceptation ou au début de la saison suivante. Le choix vaut aussi pour un
échange avec une contrepartie et une éventuelle indemnité.

Pour un transfert différé :

- Une offre en attente réserve le montant proposé. Son refus ou son retrait
  libère cette réservation.
- À l’acceptation, l’indemnité est mise sous séquestre : elle devient
  indisponible pour l’acheteur, sans être créditée au vendeur.
- Le vendeur reçoit l’argent lors du transfert effectif, à l’activation de la
  saison suivante. Le versement est lié à l’activation des contrats et reste
  unique lors d’une relance de la bascule.
- Les coureurs terminent la saison dans leurs clubs actuels, avec leurs
  salaires, courses, stages, équipements et entraîneurs actuels.
- Les nouveaux contrats couvrent uniquement la saison suivante. Les anciennes
  prolongations du club cédant sont remplacées après acceptation ; un engagement
  déjà signé avec un autre club reste bloquant.
- La place et le salaire futurs sont pris en compte dès la signature. Une
  équipe déjà au-dessus du plafond peut réduire ses engagements futurs par une
  vente, même si une seule vente ne suffit pas à corriger tout son dépassement.
- Les transferts acceptés apparaissent dans les transferts programmés des deux
  DS. Les anciens contrats et transactions restent consultables.

Un accord accepté est ferme. Les anciens parcours de vente immédiate,
licenciement ou renouvellement ne peuvent pas supprimer le contrat futur payé
ni prolonger le contrat du cédant par-dessus la date de départ convenue.
Une mise aux enchères est également refusée à la création pour chacun des
coureurs promis, afin de ne jamais créer une enchère impossible à régler.

## Intégration et sécurité

Les signatures, les modifications des contrats et le séquestre forment une
transaction. L’activation utilise le cycle de contrats existant de la bascule
automatique ; aucun nouveau traitement périodique n’est ajouté. Les transferts
immédiats conservent leurs signatures RPC et leur logique métier.

Les contrôles d’identité, de propriété, de saison, de trésorerie et de capacité
sont répétés à l’acceptation, sous les verrous locaux d’équipe et de coureur.
Les indices couvrent les contrats engagés et les transferts programmés. La
lecture supplémentaire des arrivées acceptées est limitée à l’onglet des offres,
avec un résultat borné et des noms d’équipes chargés en lot.
Les contreparties sont chargées sur demande : une seule lecture en lot des
contrats futurs de tous les clubs exclut les coureurs déjà engagés ailleurs.

Si le vendeur n’a pas de compte actif à l’arrivée, la créance reste sous
séquestre sans bloquer la bascule globale. La création/réactivation du compte ou
l’activation d’une saison ultérieure retente le versement. Celui-ci exige une
saison active, après le report de trésorerie, pour éviter qu’un crédit sur un
compte précréé soit écrasé lors de la bascule.

La migration est livrée seule après comparaison des empreintes des deux
fonctions modifiées. Aucun transfert fictif, essai avec rollback ou fixture ne
doit être exécuté sur la base des joueurs.

## Vérification reproductible

- `scripts/test-deferred-direct-transfers-sql.mjs` réutilise les fonctions
  historiques et les déclencheurs de contrats dans PostgreSQL/PGlite isolé.
- `scripts/test-direct-transfer-trades-sql.mjs` couvre les transferts et échanges
  immédiats existants.
- Tests Vitest des actions authentifiées, devis, capacités actuelles/futures,
  candidats chargés à la demande, termes et transferts programmés.
- `node scripts/test-deferred-transfer-composer-ui.mjs <module-playwright-core>
  <executable-chromium>` teste les vrais contrôles React en affichage mobile,
  avec actions simulées et réseau bloqué : argent seul, échange pur, changement
  de date, cache distinct des candidats, effectif actuel plein et trésorerie
  négative pour un échange sans indemnité.

PGlite est mono-session ; les contrôles de transaction et de répétition ne
constituent pas un test de contention réelle. Les verrous font aussi l’objet
d’une revue indépendante. Le navigateur teste les composants isolés et ne se
connecte à aucun compte joueur.

Résultats avant livraison : 108 tests Vitest dans 14 fichiers, 136 contrôles
PostgreSQL dans 22 scénarios différés, 250 contrôles dans 53 scénarios de
transferts immédiats, et le navigateur mobile passent. Le harnais historique
normalise désormais CRLF pour reproduire les mêmes fonctions que la livraison.
ESLint et la couverture des 18 509 chaînes françaises passent.
