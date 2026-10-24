# Retour au calendrier après inscription — 24 octobre 2026

## Signalement et limites du diagnostic

Sousou signale une page blanche intermittente en revenant au calendrier après
une inscription. Un rafraîchissement rétablit la page. Le cas exact n'a pas été
reproduit localement : ne pas présenter un défaut précis de Next.js comme prouvé.

Contrôles de production strictement en lecture seule :

- les vingt dernières traces du calendrier consultées répondent 200, sans erreur
  serveur associée ; un statut 200 n'exclut pas une erreur de rendu côté client ;
- les cinq dernières inscriptions de Sousou sont acceptées, avec leurs
  compositions de 6 à 8 coureurs conservées. Une sixième entrée est désinscrite,
  pas assimilée à une inscription perdue ;
- base joignable, aucune inscription de test, modification de données ou
  exécution de maintenance pour ce diagnostic.

Les liens d'inscription utilisent déjà une navigation documentaire. Le retour
au calendrier utilisait encore le routeur client, y compris après invalidation
par l'action d'inscription. La protection livrée est ciblée sur ce retour.

## Protection et coût

`AppLink` ne traite spécialement que les liens vers `/jeu/calendrier` :
au clic principal depuis `/jeu/courses/[slug]`, annuler la transition Next puis
effectuer `window.location.assign(anchor.href)`. Cette lecture GET fraîche
conserve la session, les paramètres et l'ancre ; elle ne renvoie jamais le
formulaire d'inscription. Le bouton retour et les menus desktop/mobile utilisant
AppLink sont couverts.

Préservés : callback `onClick`, annulation du clic, garde des brouillons, clics
modifiés, nouveaux onglets, téléchargements, origine, URL objet, liens préchargés
sur intention et autres routes. Pas de hook de route, minuteur, polling,
préchargement ou requête SQL supplémentaire ajouté. Le document et le shell
sont rechargés sur **ce trajet seulement** : ne pas prétendre à un coût nul.

Ni RPC d'inscription, ni revalidation, ni sauvegarde des rôles/compositions,
ni moteur de course modifiés. Aucun changement SQL nécessaire.

Cette protection ne couvre pas le bouton Précédent du navigateur ni les
redirections serveur directes vers le calendrier (WildCard en attente et
Critérium). Si le signalement concerne ces parcours, une capture avec l'URL et
le type de retour est encore nécessaire. Aucun correctif global de cache ou
rechargement automatique en boucle introduit.

## Vérifications

- 99 tests ciblés sur six fichiers : garde runtime AppLink, règles de navigation,
  liens existants, calendrier et menus desktop/mobile.
- ESLint et `git diff --check` réussis.
- Build Next 16.2.12 et TypeScript réussis ; postbuild des routes d'inscription,
  images et catalogue i18n validé.
- Les tests exécutent le vrai gestionnaire `onClick`, avec navigation navigateur
  simulée ; pas une reproduction de l'incident intermittent de Sousou.
