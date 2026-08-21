# Bibliothèques de noms de coureurs

Les fichiers JSON alimentent les générations de coureurs côté serveur. Un profil national est préféré dès que les sources et la couverture permettent de le distinguer proprement d'un regroupement régional.

## Profils nordiques

Depuis août 2026, le Danemark, la Finlande, l'Islande, la Norvège et la Suède disposent chacun de leur propre catalogue. Le fichier `nordic.json` est conservé uniquement pour la compatibilité et la traçabilité des coureurs déjà générés ; aucun nouveau pays n'y est raccordé.

Les listes ont été recoupées avec les registres et statistiques nationaux :

- Danemark : [Statistics Denmark](https://www.dst.dk/en/Statistik/emner/borgere/navne/hvor-mange-hedder), statistiques de prénoms et noms issues du registre CPR ;
- Finlande : [Finnish Name Statistics](https://nimipalvelu.dvv.fi/en), Digital and Population Data Services Agency ;
- Islande : [registre officiel des prénoms](https://island.is/en/search-in-icelandic-names) et [règles d'attribution](https://island.is/en/name-giving) ;
- Norvège : [Statistics Norway](https://www.ssb.no/en/befolkning/navn/statistikk/navn), statistiques de la population enregistrée ;
- Suède : [Statistics Sweden](https://www.scb.se/en/finding-statistics/statistics-by-subject-area/population-and-living-conditions/other-statistics/name-statistics/), tableaux de prénoms et noms de la population enregistrée.

Chaque catalogue reste une sélection destinée au jeu : il combine plusieurs générations, conserve les graphies nationales et évite les doublons exacts. Les identités existantes ne sont jamais renommées lors d'un simple raffinement géographique.
