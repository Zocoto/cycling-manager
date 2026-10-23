# Offres directes : lecture autorisée des participants

## Incident confirmé

BelgianSteph reçoit une offre en attente de 53 000 € pour Floy Mason. L’action d’acceptation ajoutée avec les échanges lit d’abord `rider_id, offered_rider_id` sous le rôle authentifié pour invalider ensuite les bonnes fiches. L’ancienne politique de lecture des offres interroge directement `team_manager_assignments`, qui n’est volontairement pas accessible aux joueurs. Le contrôle échoue donc avant le traitement métier, avec le message trompeur « Cette offre n’est plus accessible ».

L’affichage du marché fonctionne car son service utilise une lecture administrée et explicitement restreinte à l’équipe. Les tests d’actions avec mocks ne reproduisaient pas la permission SQL manquante. Le retrait et le refus, utilisant la même prélecture que l’acceptation, sont également concernés.

## Correctif minimal

La politique SELECT des offres réutilise désormais `public.current_user_manages_team(uuid)`, fonction stable SECURITY DEFINER déjà utilisée dans le jeu. Elle conserve exactement les conditions de directeur actif, affectation active et rôle de manager général, pour l’équipe acheteuse ou vendeuse.

Aucun accès nouveau à la table des affectations, aucun droit d’écriture direct, aucune suppression de RLS, aucun changement des fonctions de transfert/contrat/finance. Pas de nouvelle requête applicative, de polling ou de tâche planifiée. Le clic continue à charger une seule offre par clé primaire. L’historique reste lisible uniquement par les participants autorisés.

La migration est bornée et refuse une dérive de la politique originale ou de la fonction de contrôle d’équipe. Elle n’accepte pas l’offre à la place du joueur et ne modifie aucune offre existante.

## Vérification

Le test PostgreSQL/WASM isolé utilise la véritable politique historique et la véritable fonction de contrôle d’équipe : il reproduit d’abord l’erreur 42501 pour l’acheteur et le vendeur sans SELECT sur les affectations, applique la migration puis vérifie l’accès des deux participants, l’exclusion des tiers, comptes suspendus et affectations inactives, le maintien de l’interdiction des écritures et de l’accès aux affectations, et l’absence de modification des offres et de la fonction partagée.

Les vérifications en production restent en lecture seule, séquentielles et limitées à quatre secondes. Aucune acceptation, transaction financière ni fixture de test n’est exécutée.

Validation locale : 27 contrôles PostgreSQL isolés, dont reproduction du refus initial pour les deux participants, et 40 tests applicatifs/contrats de migration réussis. Le test de permissions ne remplace plus la base par des mocks : il conserve l’interdiction de lire les affectations et exerce la véritable politique de lecture.
