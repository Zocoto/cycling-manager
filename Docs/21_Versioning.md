# Versionnement de Cyclo Stratège

## Version actuelle

Cyclo Stratège est en version **0.8.0 · Bêta**.

Cette base traduit une bêta déjà avancée : les principaux systèmes de jeu sont en place, mais le produit n'est pas encore considéré comme une version publique stabilisée.

## Règle

Le projet suit une version sémantique `MAJEURE.MINEURE.CORRECTIF`.

- **MAJEURE** : rupture importante ou nouvelle génération du produit. La version `1.0.0` marquera la première version publique jugée stable.
- **MINEURE** : nouveau bloc fonctionnel cohérent ou évolution notable du comportement du jeu. Exemple : `0.8.0` devient `0.9.0`.
- **CORRECTIF** : correction de bug, équilibrage, optimisation de performance, retouche graphique ou amélioration de contenu sans nouveau système majeur. Exemple : `0.8.0` devient `0.8.1`.

Les saisons du jeu ne réinitialisent pas la version. Les libellés de communication tels que « Patch #5 » peuvent être conservés dans les nouveautés, mais la version sémantique reste la référence technique.

Les versions internes des moteurs, schémas de données, générateurs et tutoriels évoluent indépendamment : elles ne doivent pas être remplacées par la version de l'application.

## Source de vérité

La version affichée par l'interface est centralisée dans `lib/app-version.ts`. Le manifeste `package.json` porte la même valeur et un test empêche leur désynchronisation. À chaque livraison, la note de version courante doit également reprendre cette valeur.
