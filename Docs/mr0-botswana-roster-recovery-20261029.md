# Effectif de Mr0 — 29 octobre 2026

Demande du propriétaire : attribuer huit nouveaux coureurs botswanais à Mr0,
selon les règles de création utilisées à l'inscription. Son équipe existante,
Les Gb’s, était active en S4, affiliée au Botswana, sans contrat actif ni prévu.

La migration `20261029160000_restore_mr0_botswana_roster.sql` a été appliquée
et enregistrée en production. Elle conserve les sept profils amateurs standards
et ajoute un huitième polyvalent. Les 104 notes utilisent exactement la variation
bornée de la génération initiale v3. Les déclencheurs habituels génèrent le
potentiel amateur, la résistance au déclin, l'avatar, la morphologie, la synthèse
de saison et l'état initial de forme. Les contrats initiaux sont gratuits et
couvrent la saison active, comme lors d'une inscription.

L'intervention ne recrée pas l'équipe et ne modifie ni ses contrats historiques,
ni le didacticiel, ni les règles générales d'inscription. Les huit identifiants
figés rendent une répétition sans effet ; un effectif déjà occupé, un changement
de titulaire, de pays ou de saison bloque l'intervention. Transaction bornée à
20 secondes, attente de verrou limitée à une seconde, sans verrou global de saison.

Validation isolée PostgreSQL : profils standards inchangés, 104 notes comparées
au calcul natif, huit contrats botswanais, répétition sans doublon, refus sur
mauvais titulaire/pays/saison ou effectif déjà occupé.

Contrôle réel après attribution : huit identifiants attendus, nationalité BW,
contrats actifs à 0 €, âges de 18 à 24 ans, potentiel et résistance au déclin
conformes aux fonctions natives, avatars v3, tailles/poids renseignés, forme 75,
fatigue 0 et synthèses de saison présentes pour tous. Base accessible en 215 ms ;
page publique du guide HTTP 200. Aucune fixture ni simulation de joueur en production.
