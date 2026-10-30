# Relance d’une équipe sans coureur

Une équipe fondée dont l’effectif professionnel de la saison active est vide peut demander sept coureurs de départ depuis la rubrique Effectif. L’assistant affiche un rappel prioritaire qui mène directement à ce panneau, dans toutes les vues de l’effectif.

## Règles

- Sept profils de départ habituels, notes initiales v3 avec leur variation bornée, âges de 18 à 24 ans. Les déclencheurs ordinaires attribuent talent, portrait, physiologie et état initial.
- Les sept coureurs et leurs noms correspondent au **pays d’inscription de l’équipe dans la saison active**, qui peut différer du pays fondateur après un changement de sponsor.
- Aucun contrat de coureur couvrant la saison active ne doit subsister. Une sélection nationale ou une indisponibilité médicale ne rend pas une équipe vide. Les contrats exclusivement prévus pour une saison future sont conservés et ne bloquent pas la relance actuelle.
- Une relance par saison pour une même équipe **et** un même DS. Un reçu privé persistant empêche de contourner la règle en vendant les sept coureurs ou en changeant de gestionnaire.
- Contrats jusqu’à la fin de la saison active, rémunération calculée par le barème ordinaire après détermination des notes ; facturation à compter du jour d’arrivée. Les remises habituelles d’équipe restent applicables.
- Club, finances, sponsors, staff, infrastructures et historique conservés. Aucun capital de départ ni récompense d’accueil n’est réattribué. Aucun coureur historique n’est supprimé.

## Sécurité et performances

La Server Action vérifie la session, relit le pays et génère les sept identités sur le serveur avec le générateur existant. La RPC SQL dérive l’équipe du compte connecté, verrouille la portée d’effectif utilisée par les transferts, vérifie à nouveau équipe/pays/saison/éligibilité et crée l’ensemble dans une transaction. Les notes, âges, nationalités et identifiants ne sont jamais acceptés depuis le formulaire. Un échec annule toute la création ; une répétition ne donne pas un deuxième effectif.

La page ne charge l’éligibilité que lorsque la lecture de l’effectif a réussi et n’a retourné aucun coureur. L’assistant réutilise son résumé existant, sans appel réseau additionnel, avec son budget de trois secondes inchangé. Les salaires sont calculés en un lot pour les sept coureurs. Après réussite, le layout du jeu est invalidé pour rafraîchir effectif, assistant, entraînement et finances.

## Validation

Tests isolés de la RPC et de ses refus d’accès, pays, contrats, limites saisonnières et absence de création partielle ; tests du service, de l’action, du panneau et de l’assistant. Aucune fixture ni relance de joueur n’est exécutée en production. La migration est appliquée seule, avec délais SQL et verrous bornés, puis vérifiée par lecture seule avant livraison applicative.

Résultats : 130 tests Vitest et 65 contrôles PostgreSQL isolés réussis. Ces derniers utilisent les vraies fonctions de génération, calcul salarial et échéancier sur un schéma minimal ; ils ne reproduisent pas plusieurs sessions concurrentes ni tous les déclencheurs de production. La compatibilité des verrous a été revue séparément. Application contrôlée par `scripts/apply-reviewed-empty-roster-recovery.mjs --apply`, inspection seule avec `--inspect`.
