# Bibliothèques de noms de coureurs

Les fichiers JSON alimentent les générations de coureurs côté serveur. Un profil national est préféré dès que les sources et la couverture permettent de le distinguer proprement d'un regroupement régional.

## Couverture mondiale

Le catalogue comprend désormais 70 profils et impose un socle de 120 prénoms et 160 noms par bibliothèque, avec des seuils nationaux plus élevés quand les sources le permettent. Les deux pays les plus représentés dans le jeu disposent des catalogues les plus profonds : 420 prénoms et 420 noms pour la France, 420 prénoms et 360 noms pour la Belgique.

Vingt-six profils nationaux ont été séparés des anciens regroupements régionaux :

- Afrique : Afrique du Sud, Cameroun, Côte d’Ivoire, Érythrée, Éthiopie, Ghana, Kenya, Madagascar, Nigeria, Sénégal et Somalie ;
- Asie : Bangladesh, Cambodge, Inde, Indonésie, Laos, Malaisie, Mongolie, Myanmar, Népal, Pakistan, Philippines, Sri Lanka, Taïwan, Thaïlande et Vietnam.

Les profils régionaux historiques sont conservés pour les pays dont la couverture reste plus fiable à cette échelle et pour assurer la traçabilité des coureurs déjà créés. Une évolution du rattachement d’un pays ne renomme jamais les identités existantes : elle s’applique uniquement aux générations futures.

Les cultures patronymiques sont représentées explicitement. Pour l’Éthiopie et l’Érythrée, les deux champs techniques `firstNames` et `lastNames` contiennent donc des noms personnels utilisables respectivement comme prénom et patronyme, plutôt qu’une fausse liste de noms de famille héréditaires.

## Sources et licences

Les listes ont été normalisées en alphabet latin, dédupliquées et filtrées pour retirer les identifiants, titres et initiales isolées. Elles ont été constituées et recoupées à partir des sources suivantes :

- [Fichier des noms de l’Insee](https://www.insee.fr/fr/statistiques/3536630), utilisé pour renforcer la profondeur et la fréquence des noms français ;
- [Faker](https://github.com/faker-js/faker), données localisées sous licence MIT ;
- [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing), données CC0 utilisées pour compléter les pays insuffisamment couverts et conserver des graphies attestées ;
- [Popular names by country](https://github.com/sigpwned/popular-names-by-country-dataset), données CC0 avec codes ISO et formes romanisées ;
- [Onomaverse — Most Popular Names by Country 2026](https://github.com/onomaverse/datasets/tree/main/popular-names-by-country-2026), données sous licence CC BY 4.0. Attribution : Names data from Onomaverse.

La convention patronymique éthiopienne et érythréenne a également été vérifiée avec la documentation de l’[Université de Bergen](https://www.uib.no/lle/23168/navn-i-etiopia-og-eritrea).

## Profils nordiques

Depuis août 2026, le Danemark, la Finlande, l'Islande, la Norvège et la Suède disposent chacun de leur propre catalogue. Le fichier `nordic.json` est conservé uniquement pour la compatibilité et la traçabilité des coureurs déjà générés ; aucun nouveau pays n'y est raccordé.

Les listes ont été recoupées avec les registres et statistiques nationaux :

- Danemark : [Statistics Denmark](https://www.dst.dk/en/Statistik/emner/borgere/navne/hvor-mange-hedder), statistiques de prénoms et noms issues du registre CPR ;
- Finlande : [Finnish Name Statistics](https://nimipalvelu.dvv.fi/en), Digital and Population Data Services Agency ;
- Islande : [registre officiel des prénoms](https://island.is/en/search-in-icelandic-names) et [règles d'attribution](https://island.is/en/name-giving) ;
- Norvège : [Statistics Norway](https://www.ssb.no/en/befolkning/navn/statistikk/navn), statistiques de la population enregistrée ;
- Suède : [Statistics Sweden](https://www.scb.se/en/finding-statistics/statistics-by-subject-area/population-and-living-conditions/other-statistics/name-statistics/), tableaux de prénoms et noms de la population enregistrée.

Chaque catalogue reste une sélection destinée au jeu : il combine plusieurs générations, conserve les graphies nationales et évite les doublons exacts. Les identités existantes ne sont jamais renommées lors d'un simple raffinement géographique.
