# Gala S4 : coches rétablies après enregistrement

Signalement d'Ujik : remplacer Hussein Awada par Sebastian Conroy pour Paris–Roubaix, puis voir les anciennes coches malgré le message de réussite.

Contrôle de production strictement en lecture seule le 28 octobre : la composition pavée de Hexa Bâtiment contient bien Sebastian Conroy, sans Hussein Awada, avec huit coureurs. Les deux autres profils ne sont pas concernés. Aucune composition n'a été modifiée par ce diagnostic.

Reproduction dans le véritable composant `CourseRegistration`, avec une action locale fictive : après la réussite, la réinitialisation native du formulaire rétablit les valeurs initiales des cases. Les identifiants contrôlés, la sauvegarde et les attributs `data-selected` contiennent le nouveau choix, mais `input.checked` contient l'ancien. Cela explique Conroy décoché et Awada coché/désactivé dans la capture.

Le formulaire annule désormais uniquement cet événement de réinitialisation. La sélection reste pilotée par son état React. Le retrait explicite conserve son traitement `setIds([])`. Le serveur, les autorisations, l'éligibilité, les limites de 7–8 coureurs et les autres courses ne changent pas. Aucune requête supplémentaire ni migration.

La recette est disponible exclusivement en développement sur `/apercus/gala-saison-4?selection=1`. Elle utilise le composant réel avec une action substituée et sans accès à la base. Cas vérifiés dans le navigateur : remplacement/enregistrement sur écran de 390 px, échec sans perte du choix, retrait vidant la composition. Les preuves avant/après sont conservées dans `C:/Dev/artifacts/ujik-gala-lineup-20261028/`.

Les 58 tests ciblés des actions, de la présentation, des règles du gala et des startlists passent. ESLint et catalogue FR/EN également. Le contrôle de production doit confirmer le déploiement attendu, la disponibilité de la base et l'inaccessibilité de la recette locale.
