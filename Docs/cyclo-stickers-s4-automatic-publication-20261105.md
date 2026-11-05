# Série S4 et ouverture automatique en S5

Cette livraison remplace la préparation manuelle décrite plus tôt le 5 novembre.

## Série de cartes

`data/collector-album-s4-preview.json` contient une **nouvelle série de 72 cartes**, tirée exclusivement de S4 : top 50 UCI conservé intégralement, trois meilleurs baroudeurs supplémentaires, notes natives S4, cinq équipes, treize titres vérifiés et souvenir Halloween. Elle réutilise les identités et images de maillots S4 conservées avant la bascule, jamais les nouvelles sélections de sponsors S5. Les 30 coureurs présents aussi dans le pilote S3 ont tous des notes natives différentes ; les classements et la clé de collection sont distincts.

Les numéros 1–69 existants sont conservés ; les trois cartes de baroudeurs portent 70–72 et leur véritable rang UCI. La sélection est recalculée sur les résultats S4 définitifs : il s’agit des trois premiers coureurs hors top 50 dont le profil primaire natif est Baroudeur. Les égalités et profils hybrides suivent exactement la logique du jeu. Dans l’aperçu : Lusungu Masire (118e), Clément Abessolo (140e), Janek Albert (162e). Ils sont bronze ; les probabilités 80 % / 16,9 % / 3 % / 0,1 % restent identiques, avec 33 bronze, 30 argent, 7 or et 2 EPIC.

La capture enrichie conserve 214 identités et 41 équipes S4, dont les réserves de baroudeurs encore sous contrat. Les 33 images existantes sont réutilisées sans transformation. Empreinte de la preuve : `1f465b5bbc8660ed64fe6eed77e64210c9f12514f08901092f17c37566d1c9f1`. Un finaliste absent des preuves S4 provoque un refus explicite, jamais un remplacement par son identité ou son maillot S5.

Avant la clôture, seul le propriétaire voit cet aperçu S4, signalé comme provisoire. Les faces et dos indiquent S4, les notes et résultats sont présentés comme relevés en S4. L’ancien pilote n’est disponible que par le lien explicite privé `?saison=3`. Aucun état local ni carte de démonstration n’est importé dans la collection réelle.

## Bascule automatique

La maintenance nocturne existante publie l’album **après le retour du règlement de bascule**, dans une transaction distincte. Elle ne modifie pas la procédure de changement de saison. La maintenance existante de l’académie sert de reprise toutes les quinze minutes, pendant S5 seulement (6 novembre–3 décembre, heure de Paris). Aucun nouveau cron ni déclenchement sur les pages de joueurs.

Le travail n’est réservable que lorsque S4 est réellement terminée et S5 ou une saison ultérieure active. Le serveur lit une fois les neuf groupes de données S4 bornés, vérifie les 50 rangs, les trois baroudeurs, cinq équipes, treize titres et notes, puis conserve cette source pour les reprises. Le code reconstruit les 72 cartes avec les maillots S4 sauvegardés, vérifie la provenance et calcule l’empreinte canonique SHA-256. L’installation, les deux drapeaux d’ouverture et le reçu final sont validés ensemble.

Une location de travail de 120 secondes empêche les doubles traitements. Un jeton périmé ne peut pas publier après une reprise concurrente. Une erreur conserve un délai de reprise de 1 minute à 1 heure ; une réponse perdue après validation ne remet pas une édition publiée en échec. Le catalogue publié reste immuable et le traitement ne distribue aucune carte, booster ou prime initiale.

Le raccourci global apprend la disponibilité avec **le même appel d’indicateurs partagé**, via sa projection v4. Ni nouveau polling ni requête par icône. Le propriétaire et les autres joueurs accèdent ensuite à la même vraie collection S4.

## Collection et récompenses

Les sept chapitres contiennent maintenant des coureurs ; le chapitre Baroudeurs se valide avec ses trois cartes. Les 19 cartes d’introduction sont comptées par leur nature, pas par un numéro supérieur à 50 : les cartes 70–72 restent bien des cartes de coureurs. Les 19 succès et leurs montants sont conservés. Le dernier et le trophée exigent les **72 cartes collées** ; ils rapportent toujours 250 000 €, 1 000 XP et 100 réputation. La règle transitoire du chapitre vide est annulée, conformément au dernier choix du propriétaire.

## Recette

- 82 vérifications PostgreSQL isolées : source non clôturée, habilitations, locations, reprises, cache, empreinte des maillots, installation atomique et échec tardif, publication unique, indicateurs v4, 72 emplacements et paiement unique des 19 succès. Parité de classification Baroudeur sur 14 limites et 500 cas décimaux ; 62 vérifications supplémentaires du producteur SQL/fichiers.
- Tests applicatifs de la source S4 réelle, des faces/dos, de la fermeture de l’aperçu public avant publication, des accès, de la chaîne serveur, de l’heure de Paris, du maintien des autres maintenances et de la conservation des droits.
- Contrôle visuel avec les vrais coureurs S4, dont Kubat Nazarbayev pour les Jeux, et les faces/dos des cartes 1, 5, 20, 35 et 50. Format et graphisme conservés.
- Migration de production limitée à `20261105160000_automatic_cyclo_stickers_s4_publication.sql`. Aucun essai de bascule ni mutation de joueur en production.

La migration est appliquée et son reçu vérifié : règle finale 72, 19 succès, habilitations de service uniquement, RLS active. Les fonctions existantes de bascule, d’indicateurs v3, de réclamation des gains et de connexion sont conservées à l’identique. S4 est encore active ; la file et le catalogue public restent vides. Le premier travail réel sera créé automatiquement après la clôture.
