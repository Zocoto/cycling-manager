# Premier jet privé du gala de la saison 4

Simulation prévue le vendredi 6 novembre 2026 sur PCM26, diffusée par Gouille : https://www.twitch.tv/gouille_tw. L’avatar est celui observé sur cette chaîne le 22 octobre ; il est servi localement pour éviter de charger Twitch à chaque consultation. Aucun lecteur Twitch ni traceur embarqué.

## Portée de cette livraison

Route `/jeu/gala-saison-4`, liée exclusivement à l’UUID authentifié du compte Zocoto, comme le pilote privé de l’album. Les autres comptes reçoivent une 404 côté serveur ; les visiteurs anonymes sont redirigés vers la connexion. Aucune ouverture par rôle admin, nom d’utilisateur ou paramètre d’URL. La tuile du bureau est produite côté serveur uniquement pour ce compte. Elle partage la largeur avec Halloween, téléphone compris ; si Halloween est terminé, elle reprend toute la largeur. Les autres joueurs gardent l’annonce Halloween habituelle, sans requête supplémentaire.

Prototype interactif : bascule entre les deux programmes, sections déroulantes des engagés/maillots et favoris, sélection du profil pour lire les bonus du podium. Les équipes et favoris sont fictifs et identifiés comme tels. Aucun formulaire d’inscription, enregistrement, attribution de lot ni changement du gala précédent. Aucun changement de base de données.

## Parcours proposés

| Profil | Variante PCM repérée | Course source | Capacité source / clubs avec spectateur |
| --- | --- | --- | --- |
| Montagne WT + Continental | `top_tdf_18_2022` | Lourdes–Hautacam, Aubisque et Spandelles | 23 / 22 |
| Vallons WT + Continental | `topclas_maastricht_2023` | Amstel, appelée Limburg Green Race dans PCM | 25 / 24 |
| Pavés WT | `topclas_roubaix_2026` | Paris–Roubaix | 25 / 24 |
| Sprint Continental | `c0_schelde_2026` | Grand Prix de l’Escaut, Scheldetour Vlaanderen dans PCM | 20 / 19 |

Sources vérifiées en lecture seule : `C:/Dev/pcm26-bridge-lab/official-release.sqlite` (`STA_race_rules`, puis `STA_race_class`), paires CDS/ZCES installées dans le pack Steam 3749668860. Ces capacités natives ne sont pas une certification des limites d’un futur export personnalisé. Les courbes affichées sont schématiques. Contrôle en jeu et export des six épreuves à faire après revue. Aucun plafond d’inscription n’est imposé dans cette livraison.

Pour le caractère des parcours : dossier ASO du Tour 2022 (Lourdes–Hautacam, 143,2 km, Aubisque/Spandelles/Hautacam), https://storage-aso.lequipe.fr/ASO/cycling_tdf/tdf-2022-dossier-de-presse.pdf ; présentation Amstel 2023 par Movistar (33 côtes, 253 km), https://movistarteam.com/en/races/race/2023-mens-amstel-gold-race.

## Récompenses proposées, à valider

Même dotation dans les deux programmes, pour chaque course. Podium : roue avant +3 dans la spécialité, casque +2, chaussures +1 (MON/VAL/PAV/SPR selon le profil). Les places 4 à 10 ont des consommables : 4–5, trois doses de forme et deux soins ; 6–7, deux doses et un soin ; 8–10, une dose et un soin. Proposition d’effets : +5 de forme par dose, −12 h par soin sur une blessure raccourcissable.

Live : une paire de gants exclusive « Nuit dorée » +1 PLA, et deux boosters pour l’album Cyclo-Stickers de S5, une fois par compte. Le visuel de gant est un aperçu existant, pas un nouvel objet attribué. Modalités de présence Twitch à finaliser.

Lors du branchement réel, utiliser le circuit commun des équipements événementiels, possession par l’équipe et compatibilité du slot, sans dépendance à un équipementier sous contrat. Conserver les tests SQL isolés d’équipement depuis la fiche du coureur et en préparation de course ; ne pas ajouter de raccourci spécifique au gala qui contournerait ce circuit. Aucun objet n’est créé ni distribué ici.

## Arbitrages visibles dans la page privée

Horaire, clôture des inscriptions et taille d’effectif à confirmer. « Plafonné à 75 » reste à préciser : le brouillon propose une éligibilité à toutes les notes primaires ≤75, bonus compris, mais permet la revue d’une règle de plafonnement à l’export à la place. Cette proposition n’ajoute aucune règle effective en production. Une équipe choisira un seul programme pour les trois épreuves, avec composition éventuellement différente par course.
