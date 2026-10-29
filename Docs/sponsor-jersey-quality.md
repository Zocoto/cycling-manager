# Qualité des maillots sponsors

Ces règles s'appliquent à toute création ou retouche de maillot sponsor.

## Identité graphique

- Le sponsor doit déterminer la construction du maillot : panneaux, coutures, aplats, motifs et hiérarchie visuelle. Un logo simplement posé sur un design générique n'est pas acceptable.
- Le nom et les signes distinctifs doivent être intégrés à une zone du torse prévue pour eux, avec une marge de sécurité suffisante. Aucun texte ne doit déborder sur les manches ou hors de la silhouette.
- Les variantes `classic`, `modern` et `bold` doivent être réellement distinctes, tout en restant immédiatement rattachables à la même marque.
- Les détails doivent rester lisibles à la taille d'affichage du jeu. Éviter le bruit, les textures artificielles et les textes secondaires trop fins.

## Fichier canonique

- Format WebP, canevas exact de 600 × 750 px et fond transparent.
- Silhouette entièrement cadrée avec une marge transparente régulière ; aucune bordure noire, blanche ou colorée sur le bord du canevas.
- Pas de halo, frange ou résidu de détourage autour du col, des épaules, des manches et de la taille.
- Les fichiers doivent suivre `public/images/sponsors/<sponsor-id>/jersey-{classic,modern,bold}.webp`.

## Contrôles avant livraison

1. Ouvrir visuellement les trois variantes finales sur fond clair et sombre.
2. Vérifier la lisibilité et les marges du nom du sponsor à l'échelle mobile.
3. Exécuter `npm run sponsors:validate:strict`.
4. N'ajouter les assets au déploiement qu'après un résultat sans erreur.

Le contrôle strict inclut l'audit automatique des dimensions, de la transparence et des bordures latérales opaques.
