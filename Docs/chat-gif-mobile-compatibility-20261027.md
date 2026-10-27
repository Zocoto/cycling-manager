# Chargement des GIF sur téléphone — 27 octobre 2026

Le sélecteur KLIPY chargeait correctement tendances et recherche dans le navigateur de bureau. Le chemin de recherche utilisait cependant `AbortSignal.any` et `AbortSignal.timeout` sans vérifier leur disponibilité. Leur absence sur certains navigateurs mobiles faisait échouer la recherche avant tout appel au fournisseur. WebKit indique que `AbortSignal.any` n'est disponible qu'à partir de Safari 17.4 : https://webkit.org/blog/15063/webkit-features-in-safari-17-4/.

`requestKlipyPage` utilise maintenant `AbortController`, un minuteur de dix secondes et la propagation de l'annulation du sélecteur. Le délai couvre également la lecture du JSON. Changer de recherche ou fermer le sélecteur annule le chargement précédent ; tous les minuteurs et écouteurs sont retirés. Le signal d'origine reste utilisable après un délai dépassé. Le signalement d'un partage au fournisseur utilise aussi un minuteur compatible.

Le délai de saisie de 450 ms, la pagination, l'ordre des résultats, le filtrage, les URL directes, l'identifiant client opaque et le circuit d'envoi restent conservés. Aucune migration ni modification des messages. Aucun message de test envoyé aux joueurs.

Vérification : 36 tests ciblés couvrant l'absence des deux méthodes statiques, la réponse réelle du fournisseur, annulation, délai, reprise, lecture du corps, erreurs HTTP, signalement de partage, métadonnées, action d'envoi et sélecteur. ESLint et catalogue FR/EN passent également. Le contrôle mobile de production utilise une fenêtre de 390 px ; il ne remplace pas un essai sur le téléphone physique du joueur.

Point fournisseur distinct : la clé existante est encore marquée `TESTING` dans le portail KLIPY. La documentation indique 100 appels/heure dans ce mode : https://docs.klipy.com/. Aucun HTTP 429 constaté lors du diagnostic. Une demande de production requiert une catégorie, les utilisateurs mensuels et une vidéo démontrant l'intégration. Aucun changement de clé, engagement, demande ou téléchargement de vidéo n'a été soumis pendant cette correction.
