# Audit des agents libres et de la draft du 6 novembre 2026

## Faits confirmés

Hemant Pawar n'appartient pas au vivier figé de la draft S5. Le vivier comprend
100 coureurs et a été réservé pendant la bascule, vers 01 h 30 Paris. Son
recrutement comme agent libre intervient vers 10 h 43 Paris, après réservation.

Le score de Pawar est 50,949, sous le dernier score du vivier à 53,408. Il a
75 en montagne, 30 ans et deux demi-étoiles de potentiel. La formule combine
qualités primaires, moyenne générale et potentiel pondéré par l'âge. Les notes
S4, évaluées avec l'âge S5 et le potentiel actuel, donnent 50,938 : la séance
de 08 h n'explique pas son absence. Cela établit la cause de l'exclusion, sans
constituer une validation de l'équilibrage de cette formule.

L'audit initial recense six signatures d'agents libres depuis minuit Paris :
aucune ne concerne un coureur du vivier. Une ligne supplémentaire concerne une
promotion d'académie en S4, signée à 00 h 32 Paris et déjà achevée à la bascule.
Son coureur appartient ensuite légitimement au vivier ; cette ligne n'est pas
une signature d'agent libre contournant la draft.

Les déclencheurs de réservation des contrats et annonces sont activés. Les
définitions réelles des trois fonctions auditées correspondent à la logique
revue. La signature d'agent libre et le règlement d'enchère insèrent le contrat
avant de passer le coureur actif. Le contrôle d'un coureur du vivier dépend de
son identifiant réservé et reste bloquant même si son statut est déjà actif.

## Vérifications isolées

`scripts/test-season-draft-midnight-sql.mjs` accepte désormais en argument
optionnel une capture locale des trois définitions auditées. Les empreintes
MD5 sont contrôlées ; les deux fonctions de réservation sont également
comparées aux DDL canoniques. Aucune connexion production n'est ouverte.

63 contrôles PostgreSQL isolés passent avec les définitions réelles :

- réservation dans la transaction du reçu de bascule et protection avant son
  ouverture publique, puis libération des non-choisis à la clôture ;
- quatorze combinaisons de contrats actifs/prévus et de types d'acquisition
  (agent libre, enchères, offre directe, initial, académie, renouvellement),
  toutes refusées pour un coureur réservé ;
- refus des changements d'identifiant et des réouvertures d'annonce ;
- refus d'une fausse acquisition `season_draft` sans attribution correspondante ;
- refus atomique par la véritable fonction de signature, sans contrat partiel
  ni changement de statut du coureur ;
- signature par cette même fonction d'un agent réellement hors vivier ;
- maintien des activations de contrats déjà prévus et des promotions internes ;
- droits d'exécution, vivier figé, extension, devis en lot et reprise sans doublon.

Ces tests ne simulent pas deux connexions PostgreSQL simultanées. La concurrence
est traitée par les verrous de lignes existants et par la réservation atomique
à la bascule, dont l'ordre a été relu dans les fonctions capturées.

Un probe isolé complémentaire relève une limite de la courte protection avant
création du vivier : un appelant hypothétique passant d'abord le coureur actif,
puis créant un contrat `free_agent`, ne rencontre plus le filtre de statut.
Les deux appelants canoniques examinés insèrent le contrat avant ce changement
de statut. Ce cas ne constitue donc pas la cause du recrutement de Pawar et
reste bloqué dès que le coureur appartient effectivement au vivier. Un éventuel
renforcement doit conserver les activations et engagements déjà conclus.

## Retour de Pawar confirmé en production

La migration `20261106113000_restore_pawar_to_samuelrodri.sql` a été appliquée
et son reçu, ses contrats et ses écritures vérifiés le 6 novembre à 11 h 32
Paris. Empreinte SHA256 du SQL normalisé LF :
`15278c2579ea4d8918beba0184bd9314e3fea48b2f8975d1d9135b7de8cdcade`.

- Contrat agent libre de Cidrerie de l'Aulne annulé ; ses quatre échéances
  futures de 3 375 € sont annulées, aucune n'avait été débitée.
- Aucun stage, consommable, entraînement ou autre investissement consommé
  depuis cette signature n'a été trouvé. La trésorerie de l'acheteur est
  conservée : aucun remboursement fictif de salaire annuel.
- Pawar revient immédiatement chez SamuelRodri / Cortiça Nova avec un contrat
  S5 actif à 13 000 €, comme son contrat S4.
- L'offre de retour déjà acceptée pour S6 est annulée. Ses 600 € séquestrés
  sont remboursés à SamuelRodri, sans versement au vendeur qui n'avait encore
  rien reçu. Le contrat S6 de SamuelRodri reste prévu à 12 000 €, sans
  indemnité ni verrou de transfert issu de cette offre.
- Le nettoyage de départ restitue le matériel au club acheteur, retire les
  futures convocations de ce club et détache ses affectations d'entraîneur.
- SamuelRodri compte ensuite 35 engagements S5 pour une limite de 35 : une
  place doit être libérée pour recruter un coureur supplémentaire à la draft.

27 contrôles PostgreSQL isolés couvrent le curatif, dont les fonctions métier
capturées en production, la vraie contrainte des offres différées, la
conservation du contrat S6, les salaires, le remboursement, le rejeu sans
double crédit et les interruptions sur changement d'état ou investissement.
La correction est atomique et refuse les modifications concurrentes non
auditées ; aucun fixture n'a été exécuté en production.

La dernière relecture des signatures de la matinée, après correction,
retrouve les mêmes six signatures d'agents libres, toutes hors vivier. Seule
la signature de Pawar est annulée conformément à la demande du propriétaire.

Preuves locales : `C:/Dev/artifacts/draft-free-agent-incident-20261106/`,
notamment `functions.json`, `triggers.json`, `free-agents-today.json` et
`pool-pawar-readonly.json`. Aucun patch de réservation n'a été ajouté sur la
base d'une hypothèse de contournement non reproduite.
