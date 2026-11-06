# Statut de préparation de la draft

Les tuiles des équipes ayant une liste de préférences enregistrée non vide
deviennent vertes, avec le badge « Liste de choix validée ». Le mode automatique
n’est pas nécessaire. Une liste vidée et enregistrée repasse au statut neutre.
Le tour en cours garde un contour doré, y compris sur une tuile verte.

La vue publique ajoute seulement `hasPreferences`, calculé sur les lignes déjà
lues. Les choix, leur ordre, leur nombre et le mode automatique restent privés.
Le booléen est calculé également pour les listes déjà enregistrées ; aucun
rattrapage de données n’est nécessaire. Il indique la préparation, pas la
disponibilité des coureurs choisis ni la garantie d’un recrutement possible.

La version de l’édition augmente seulement lorsque ce booléen change. Le suivi
existant actualise alors la page à sa cadence habituelle ; aucune requête par
participant ni augmentation de fréquence. Les délais, le vivier, les règles
de sélection et le traitement des recrutements restent identiques.

Migration `20261106100000_draft_preparation_indicator.sql` : deux modifications
de fonctions gardées, aucune écriture de données pendant l’installation.
33 contrôles PostgreSQL isolés et 17 tests de page/helpers passent ; droits,
identifiants de fonctions, délais et fonction d’avancement sont vérifiés.

Le mode automatique est désormais précoché pour les nouvelles préparations.
La migration `20261106103000_draft_auto_enabled_by_default.sql` fixe le défaut
pour les futurs participants et prépare les listes encore vides avant le début
des éditions en préparation. Les listes manuelles déjà enregistrées, les drafts
en cours et les résultats sont conservés. Les verrous suivent l’ordre édition
puis participants ; la version ne change qu’une fois par édition concernée.
32 contrôles PostgreSQL isolés vérifient ces bornes et la relance sans doublon.
