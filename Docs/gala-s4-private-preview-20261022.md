# Draft privé du gala de la saison 4 — révision du 22 octobre 2026

Simulation prévue le vendredi 6 novembre 2026 sur PCM26, diffusée par Gouille : https://www.twitch.tv/gouille_tw. L’avatar est celui observé sur cette chaîne le 22 octobre ; il est servi localement pour éviter de charger Twitch à chaque consultation. Aucun lecteur Twitch ni traceur embarqué.

## Portée de cette livraison

Route `/jeu/gala-saison-4`, liée exclusivement à l’UUID authentifié du compte Zocoto, comme le pilote privé de l’album. Les autres comptes reçoivent une 404 côté serveur ; les visiteurs anonymes sont redirigés vers la connexion. Aucune ouverture par rôle admin, nom d’utilisateur ou paramètre d’URL. La tuile du bureau est produite côté serveur uniquement pour ce compte. Elle partage la largeur avec Halloween, téléphone compris ; si Halloween est terminé, elle reprend toute la largeur. Les autres joueurs gardent l’annonce Halloween habituelle, sans requête supplémentaire.

Draft interactif : bascule entre les deux programmes, sections déroulantes des engagés/maillots et favoris, sélection du profil pour lire les bonus du podium. Les équipes et favoris sont fictifs et identifiés comme tels. Inscriptions toujours fermées, aucun lot distribué ni changement du gala précédent. Les contrastes sont renforcés, les cadeaux de présence réunis avec Gouille et le top 10 présenté dans un tableau compact.

La règle de fond du gala utilise l’attribut dédié `data-gala-s4-page` afin de garder un canevas opaque malgré `.game-workspace-background > main` dans le thème partagé du jeu. La recette locale reprend cette enveloppe du jeu pour couvrir cette interaction CSS ; aucun changement du thème des autres pages.

Une équipe choisit un seul programme de trois courses : 7 à 8 coureurs par épreuve, avec composition éventuellement différente. Continental : chacune des six notes primaires natives (MON, VAL, PLA, CLM, PAV, SPR) doit être ≤75 avant conversion PCM. Aucun bonus d’équipement ni écrêtage artificiel des notes. World Tour sans plafond.

## Parcours proposés

| Profil | Variante PCM repérée | Course source | Capacité source / clubs avec spectateur |
| --- | --- | --- | --- |
| Montagne WT + Continental | `top_tdf_18_2022` | Lourdes–Hautacam, Aubisque et Spandelles | 23 / 22 |
| Vallons WT + Continental | `topclas_maastricht_2023` | Amstel, appelée Limburg Green Race dans PCM | 25 / 24 |
| Pavés WT | `topclas_roubaix_2026` | Paris–Roubaix | 25 / 24 |
| Sprint Continental | `c0_schelde_2026` | Grand Prix de l’Escaut, Scheldetour Vlaanderen dans PCM | 20 / 19 |

Sources vérifiées en lecture seule : `C:/Dev/pcm26-bridge-lab/official-release.sqlite` (`STA_race_rules`, puis `STA_race_class`), paires CDS/ZCES installées dans le pack Steam 3749668860. Une place est réservée à l’équipe de simulation. Aucun blocage à l’inscription pour dépassement : arbitrage avant le live, sans suppression silencieuse à l’export. Les courbes affichées sont schématiques ; contrôle visuel des variantes dans PCM à faire avant le live.

## Exports privés

L’accordéon « Organisation · Exports PCM » propose six SL individuelles, les six modèles XML et la base PCM Gala S4. API POST `/api/admin/gala-s4-export` : identité Zocoto, origine et en-tête applicatif vérifiés ; réponses privées sans cache. Les modèles ne lisent aucune donnée de joueur et portent un commentaire « sans inscrits » ; seule l’équipe de simulation avec sept coureurs est incluse. Les boutons de vraies SL restent désactivés sans inscription.

Noms natifs tirés de `STA_race.gene_sz_filename` : montagne `top_tdf.xml`, vallons `topclas_maastricht.xml`, pavés `topclas_roubaix.xml`, sprint `c0_schelde.xml`. ZIP avec dossiers `World-Tour/` et `Continental/` séparés, manifeste et instructions. Copier un seul programme à la fois sans renommer les XML. Les variantes CDS/ZCES se choisissent dans PCM ; montagne : Tour 2022, étape 18 uniquement, en mode étape, pas le Tour complet.

Les SL réelles utilisent les compositions enregistrées en S4, même après passage en S5. Contrôles : dernier contrat éligible S4, identifiants permanents, doublons, 7–8 positions contiguës, notes primaires natives et capacité. En cas d’erreur, refus expliqué ; aucune troncature et aucun remplacement par la démonstration.

Le mode explicite de base PCM Gala S4 conserve les identités et notes natives S4, règle les quatre parcours à 7–8 coureurs, maintient leurs capacités natives. L’export courant et l’ancien gala restent inchangés par défaut. Aucun changement des gabarits immuables ou des classes globales.

Migration `20261022220000_prepare_private_season_gala_startlists.sql` : deux tables nouvelles et vides (`season_gala_registrations`, un programme par équipe/saison ; `season_gala_registration_riders`, composition par profil). RLS, aucun droit anon/authenticated, service_role seulement. Aucun seed ni endpoint public d’inscription. Le futur formulaire devra écrire dans ce stockage avec les mêmes contrôles métier. Migration testée sur PostgreSQL isolé ; application bornée à lock_timeout 1 s et statement_timeout 10 s. Aucun test avec données temporaires en production.

Pour le caractère des parcours : dossier ASO du Tour 2022 (Lourdes–Hautacam, 143,2 km, Aubisque/Spandelles/Hautacam), https://storage-aso.lequipe.fr/ASO/cycling_tdf/tdf-2022-dossier-de-presse.pdf ; présentation Amstel 2023 par Movistar (33 côtes, 253 km), https://movistarteam.com/en/races/race/2023-mens-amstel-gold-race.

## Récompenses annoncées

Même dotation dans les deux programmes, pour chaque course. Chaque coureur du top 10 rapporte le lot de sa place à son équipe. Podium : roue avant +3 dans la spécialité, casque +2, chaussures +1 (MON/VAL/PAV/SPR selon le profil). Quatrième : capsule +1 secondaire au choix, trois doses de forme et deux soins. Cinquième : stage entraînement ×2 pendant trois jours, deux doses de forme et deux soins. Sixième–septième : deux doses et un soin ; huitième–dixième : une dose et un soin. Effets annoncés : +5 de forme par dose, −12 h par soin sur une blessure raccourcissable.

Live : une paire de gants exclusive « Nuit dorée » +1 VAL, et deux boosters pour l’album Cyclo-Stickers de S5, une fois par compte. Le visuel de gant est un aperçu existant, pas un nouvel objet attribué. Modalités de présence Twitch à finaliser.

Lors du branchement réel, utiliser le circuit commun des équipements événementiels, possession par l’équipe et compatibilité du slot, sans dépendance à un équipementier sous contrat. Conserver les tests SQL isolés d’équipement depuis la fiche du coureur et en préparation de course ; ne pas ajouter de raccourci spécifique au gala qui contournerait ce circuit. Aucun objet n’est créé ni distribué ici.

## Arbitrages visibles dans la page privée

Horaire du live et clôture des inscriptions à confirmer. La taille d’effectif (7–8), la règle des notes natives et les capacités hors équipe de simulation sont arrêtées. L’ouverture publique des inscriptions et la distribution réelle des lots restent des étapes ultérieures.
