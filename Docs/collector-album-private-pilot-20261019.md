# Album du peloton — pilote privé du 19 octobre 2026

## Périmètre livré

- `/jeu/album`, accessible seulement à l’UUID authentifié du propriétaire d’Abbaye du Lion. Les autres comptes reçoivent une page introuvable ; les visiteurs non connectés sont renvoyés vers la connexion.
- Entrée discrète dans la Gazette, uniquement pour ce compte. Aucun lien ajouté aux autres menus, aucun communiqué global.
- Collection S4 : instantané en lecture seule du top 50 UCI de la saison 3 terminée, acquis le 19 octobre. Sept chapitres reprennent le profil principal calculé par le site (un coureur hybride ne remplit pas plusieurs emplacements).
- Portrait, maillot sélectionné S3, six notes principales natives S3, classement, points et victoires de la synthèse officielle S3. Pas de potentiel privé, de notes avec équipements, ni de palmarès inventé.
- Finitions proposées : or pour les rangs 1–5, argent 6–20, bronze 21–50. Elles ne modifient aucune performance et ne constituent pas des probabilités d’obtention.
- Deux cartes de démonstration : Mesfin Deng (or) et Zain Miah (argent). Collage, décollage réversible pour le test et remise à zéro avec confirmation.
- Échanges de démonstration avec un partenaire explicitement fictif, qui possède Mirko Golob (argent). Offre, réservation, acceptation atomique, refus, annulation et historique borné à dix entrées. Une carte collée ou déjà réservée ne peut pas être proposée. Un échange remplace une carte : le propriétaire conserve exactement deux exemplaires au total.

## Isolation et performances

Ce pilote valide l’interface et les transitions d’état, **pas un inventaire persistant ou un marché multijoueur**. L’essai est conservé dans le stockage local du navigateur, avec une clé par compte et édition. Pas de synchronisation entre appareils ; indisponibilité du stockage signalée à l’écran. Une clé corrompue est rejetée.

Aucune migration, RPC, action serveur d’échange, tâche planifiée, récompense, notification ou écriture dans la base de jeu. Aucun compte de test créé. Toutes les transitions ont été essayées localement, hors production. Les lectures de préparation étaient séquentielles, bornées à cinq secondes, et limitées aux cinquante coureurs concernés et à leurs identités d’équipes.

Le catalogue est un instantané serveur chargé après le contrôle d’accès, uniquement sur la route privée. Aucun scan du classement à l’ouverture, aucune requête d’album supplémentaire sur la Gazette ni pour les autres joueurs. Seuls la page courante et les deux cartes disponibles sont rendus en détail. Textures CSS, SVG et maillots existants, sans nouvel asset lourd.

## Non activé

- Distribution de cartes : aucune, y compris dans la Gazette. Pour le lancement futur, la Gazette reste l’unique source demandée. Cadence rare et plafonnée par saison à arbitrer ; récupération au plus une fois par édition, archives et rejeu protégés côté serveur. Aucune mécanique d’achat, de gain quotidien ou de récompense d’objectif ajoutée.
- Échanges entre vrais comptes, inventaire serveur, échanges de doublons et règles de réciprocité : prochaine étape seulement après validation de cet aperçu. Il faudra une transaction serveur avec verrouillage des deux inventaires, contrôle de propriété et idempotence ; le navigateur ne devra jamais faire autorité.
- Récompenses de collection, jeu de cartes et ouverture aux joueurs : non implémentés.

## Vérifications

- 76 tests ciblés : droits de route, données du catalogue, conservation des exemplaires, collage, réservation, acceptation répétée, annulation, refus, reprise après rechargement, état corrompu, historique, profils, maillots, portraits, classements et entrées Gazette.
- TypeScript sans émission et lint des fichiers modifiés.
- Catalogue anglais : 108 traductions ajoutées, placeholders préservés.
- Recette visuelle locale du composant réel sur ordinateur et dans des fenêtres de 320 / 390 pixels. Collage, échange et rechargement effectivement vérifiés dans le navigateur.

## Retrait

Retirer l’entrée conditionnelle dans la Gazette et la route `/jeu/album`, puis les composants et données dédiés. Aucune donnée de production à annuler. La clé locale est `cs:private-collector:s4-top50-s3-private-v1:<compte>` ; elle peut être réinitialisée depuis l’interface sans toucher aux données du jeu.
