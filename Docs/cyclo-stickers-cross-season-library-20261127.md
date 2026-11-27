# Bibliothèque et échanges entre saisons — 27 novembre 2026

La page `/jeu/album` devient une bibliothèque : chaque tranche affiche la saison
racontée, le nombre de vignettes collées et le taux de complétude. L’album S4
désigne donc les souvenirs S4, même si ses sachets ont été distribués en S5.
Les livres reviennent à la ligne sur téléphone ; la navigation par collection
reste disponible après ouverture d’un album.

## Catalogues et accès

`get_current_cyclo_stickers_library()` renvoie seulement les résumés des éditions
publiées accessibles au compte connecté. L’étagère ne télécharge ni tous les
catalogues ni tous les inventaires. Elle inclut les sachets encore fermés de
chaque édition ; « Sachets à ouvrir » mène directement à cette collection.

L’ouverture explicite utilise `?edition=<editionId>` et
`get_cyclo_stickers_catalogue(p_edition)`. Le service vérifie le sceau SHA-256,
les saisons source/collection et la correspondance de l’inventaire authentifié.
La reconstruction officielle de la provenance S4 est conservée. La lecture
structurelle des éditions futures ne remplace pas leur validation de publication.

Les garde-fous SQL exigent une saison source terminée, une édition activée et
approuvée, et une saison de collection déjà ouverte. Actuellement, seule la vraie
collection S4 est publiée. La maquette S5 reste réservée au propriétaire, sans
carte, inventaire ni taux de collection fictif. Ses cartes et son scellement
restent à préparer à J28 avec les données finales ; cette livraison ne publie
aucune nouvelle édition.

## Compatibilité et sachets anciens

- Les anciennes URL `?saison=4` et `?saison=5` restent attachées à S4. Le prototype
  S3 conserve son accès propriétaire explicite.
- Un lien sans édition vers les échanges ou les succès ouvre l’édition publiée
  la plus récente, sans passer par l’étagère.
- Un lien `?onglet=boosters` sans édition choisit d’abord une collection contenant
  des sachets fermés, puis l’édition la plus récente. Une édition explicite ou un
  alias historique reste prioritaire : aucun sachet ne change de collection.
- Une édition explicite indisponible ou une saison inconnue ne sont pas remplacées
  silencieusement par un autre album ou par le prototype.

## Échanges et comptes

Chaque vignette échangée est identifiée par `(editionId, cardNumber)` : la numéro
1 de S4 reste distincte de la numéro 1 de S5. Les choix, propositions et reçus
indiquent la saison source. Les exemplaires restent réservés et transférés dans
leur propre collection, avec les règles de stock, d’expiration et de transfert
unique. Les anciennes propositions conservent leur chemin de traitement.

Les lectures sont limitées au DS authentifié. Les mutations vérifient le compte
attendu et le DS côté serveur ; une réponse tardive n’est pas réinjectée après
un changement de session. Les catalogues utilisés lors de la composition sont
chargés uniquement pour les éditions sélectionnées.

## Recette

Les trois suites bibliothèque/service/routage passent : **42 tests**. Elles
couvrent notamment la sélection S4/S5, les anciennes URL, le refus des éditions
inaccessibles, le sceau et la provenance S4, la lecture future, les comptes
incohérents, les taux et les sachets conservés dans une ancienne collection.
`lib/game/cyclo-stickers-published-snapshot.test.ts` complète les refus de sources
actives, de saisons discordantes, de specimens, d’assets non sûrs et d’identités
de vignettes ambiguës.

La recette SQL isolée est portée par
`scripts/test-cross-season-cyclo-stickers-sql.mjs` ; le harnais DOM des échanges
est `scripts/test-cross-season-sticker-trades-ui.mjs`. Aucun test de jeu ni
échange fictif n’est exécuté en production. Les preuves de migration, de santé
et de déploiement sont à confirmer séparément avant d’annoncer la mise en ligne.
