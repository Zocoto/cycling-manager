# Parcours pavés à partir de S5

## Répartition

14 parcours reçoivent un final plus sélectif, sans modifier leurs dates, distances annoncées, inscriptions ni préparations :

- L'Enfer des Dunes ; La Traversée des Flandres ; Strade del Monferrato.
- Classique des Routes de Basalte ; Ronde du Jutland.
- Gotland Gravel Classic ; Routes Blanches de Maurice ; Clásica de Barichara ; Classique de la Route de Pierre du Thé ; Mur de Kigali.
- Dernières étapes pavées du Tour de la Voie Royale de Bohême (E4), Tour des Pavés Baltiques (E5), Vuelta de los Caminos Blancos (E6) et Vuelta de los Caminos Rojos (E4).

Les 50 derniers kilomètres conservent une alternance de secteurs et de récupération. Selon le parcours, le dernier secteur finit à 3 ou 5 km de l'arrivée ; les variantes vallonnées ajoutent trois côtes pavées de 2 à 3 km, entre 6 et 8 %. Un sprint réduit reste possible selon les coureurs et le scénario : aucun résultat n'est forcé.

7 parcours existants restent adaptés aux spécialistes rapides et portent le libellé **Sprint / Pavé** : Clásica Empedrada de Antigua, Clásica Empedrada de Trinidad, Kaldrma de Šumadija, Kalldrëmi i Beratit, Bohême E2, Pavés Baltiques E2, Caminos Blancos E2. Le domaine sportif reste `cobbles` ; le libellé ne change aucun calcul.

## Cohérence et performances

- Deux parcours préparés conservaient des secteurs supplémentaires après une copie par upsert (Flandres et Monferrato). Les secteurs excédentaires sont retirés et les distances rétablies ; les prochaines copies retirent également leurs anciennes clés devenues inutiles.
- Annotation nullable chargée avec les étapes existantes : aucune requête supplémentaire pour afficher le profil dans le calendrier, l'inscription, l'aperçu, le direct, les résultats et la préparation matérielle.
- Aucun changement des parcours ou des résultats de S4, des épreuves internationales et du CLM pavé. Une course déjà simulée ou démarrée est refusée.
- Application à la génération des saisons planifiées à partir de S5, après le plan Élite ; réapplication sans recréer les secteurs déjà conformes.

## Vérifications

- Base PostgreSQL isolée sur 53 profils réels sans données de joueurs : 14 finals, 7 annotations, distances exactes, S4 inchangée, conservation des inscriptions/préparations, exclusion des internationaux/chronos, réapplication et refus des courses figées.
- Comparaisons locales avec le même peloton, la même météo et trois graines : les écarts du 20e augmentent en médiane sur les parcours témoins (Basalte, Route de Pierre du Thé, Enfer des Dunes). Un scénario particulier peut toujours favoriser un regroupement.
- Migration de production exacte, délais SQL/verrouillages bornés, empreintes du calendrier, des éditions, des inscriptions et des parcours protégés avant/après. Aucun rejeu officiel.
