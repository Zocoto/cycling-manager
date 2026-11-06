# Supervision : rapport remis après sept jours de scouting

Un objet activé à J1 est actif de J1 à J7 inclus. Une mission de sept jours
commencée à J1 travaille pendant ces sept jours, puis remet son rapport à J8.
Le calcul utilisait uniquement J8 et perdait réellement le bonus annoncé.

Le calcul du rapport accepte désormais chaque objet dont le début est au plus
tard le jour du rapport et dont la fin couvre au moins le dernier jour travaillé
(jour du rapport moins un). L’activation le jour du rapport, avant sa génération,
reste éligible, comme l’activation pendant une mission déjà commencée. Chaque
objet compte une fois et le cumul reste plafonné à 100 %.

Le même helper sert à la prévision de la carte, au suivi des missions et à la
qualité effectivement générée. Les rapports complétés gardent leur valeur
figée. Une finalisation tardive utilise la date prévue du rapport, pas la date
du passage du worker. La saison de la mission et son équipe restent filtrées.

La durée active et les dates des objets ne changent pas. Les missions restent
limitées au J28 ; le report des objets en fin de saison est une règle distincte.
Aucune migration ni écriture de données n’est nécessaire. Le nombre de requêtes
est inchangé et le filtre `status = 'active'` conserve l’index partiel existant.

Vérifications : 48 tests métier existants et ciblés, quatre rendus réels de la
carte, TypeScript et ESLint passent. Le catalogue anglais couvre la nouvelle
erreur de validation. Une lecture production limitée à vingt missions a trouvé
un cas réel J1 → J8 avec cumul de 30 %, auparavant calculé à 0 %.
