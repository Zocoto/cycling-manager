# Ambition sponsor : choix direct et objectifs visibles

## Diagnostic

- Le sélecteur affichait un budget local mais ne soumettait rien avant le bouton de validation et la confirmation native. Les objectifs voisins restaient donc ceux du palier enregistré.
- Le calibrage sportif ajoutait ou retirait un point de niveau avant une grille de rangs assez large. Deux difficultés pouvaient ainsi aboutir au même rang après calibrage. Le plafond d'ambition 6 pouvait aussi neutraliser la hausse des quotas de victoires.
- Lima Maki : vérification de production en lecture seule. Son contrat S5 est déjà signé au palier ambitieux, avec dix objectifs correspondants. Le panneau du contrat futur ne montrait que le sponsor, le budget et le maillot ; les objectifs consultables au-dessus appartenaient à S4.

## Correction

- Chaque palier est un bouton de soumission natif portant sa propre valeur, sans champ caché de difficulté obsolète, validation supplémentaire ou fenêtre de confirmation.
- Une seule négociation à la fois par formulaire. Le statut du formulaire pilote l'aperçu ; après traitement, la valeur serveur redevient la référence, y compris en cas d'erreur. Pas de nouvel appel API ou de polling.
- Les actions existantes conservent leurs contrôles de propriété, de statut et de calendrier, recalculent selon le circuit existant et revalident la page. Retour à l'ancre de l'offre sans message de succès intermédiaire.
- À partir de S5, le rang sportif équilibré est inchangé. Accessible et ambitieux déplacent un vrai palier de résultat plutôt qu'un seul point de niveau : victoire, podium, top 5, 10, 15, 20, 25, 30. Une victoire ne peut évidemment pas être rendue plus stricte à elle seule.
- Le quota de victoires équilibré reste inchangé ; le quota calibré reçoit -1 ou +1 selon l'ambition, minimum 1. Les garde-fous liés au niveau de l'équipe sont conservés, avec au plus une victoire supplémentaire au-dessus du plafond équilibré.
- Génération S5 version 12. Aucun recalcul au chargement des plans complets existants, aucune modification des objectifs ou budgets déjà signés, aucun changement de S4.
- Les dix engagements du contrat futur signé sont maintenant affichés sous son panneau, avec la saison et le palier enregistré. Les données étaient déjà chargées : aucune requête ajoutée.

## Vérification

- Tests du calibrage, du générateur, des offres futures, des contrats signés et du rendu des panneaux.
- `node scripts/test-sponsor-negotiation-click.mjs <module happy-dom>` : interactions React hors ligne sur nouvelle offre et contrat continu ; valeur de soumission, blocage pendant l'enregistrement, erreur, zéro confirmation et zéro appel réseau.
- Catalogue anglais vérifié. Aucune migration ou mutation de joueur de test en production.
