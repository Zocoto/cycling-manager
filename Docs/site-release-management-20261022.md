# Version publique du site

Un encart repliable « Version du site » rejoint la gestion des actualités, pour le fondateur uniquement. Il affiche le numéro courant, permet de choisir un numéro `majeure.mineure.correctif` (suffixe `-beta.1` possible), propose un commentaire facultatif et présente les dix dernières modifications. L’historique complet est conservé côté serveur. Une double sauvegarde du même numéro ne crée pas de ligne supplémentaire.

Le numéro est un repère éditorial public, pas un déploiement, un moteur ou une preuve technique de version installée. La sauvegarde ne publie aucune annonce, ne modifie aucun brouillon et ne change aucune simulation. Un ancien numéro peut être réutilisé pour corriger une erreur de saisie, sans retour arrière applicatif. Les versions des anciennes notes de publication et du package ne sont pas réécrites.

## Accès et intégrité

- Vérification authentifiée du rôle fondateur dans l’action serveur, puis à nouveau dans les fonctions SQL. Aucun droit issu du formulaire, du nom affiché ou des métadonnées utilisateur.
- Tables privées sans accès direct, même pour `service_role`. Lecture publique limitée au numéro, à la révision et à la date ; commentaires et auteurs ne sont pas publics.
- Révision attendue, verrou borné à une seconde sur l’unique ligne de réglage, mise à jour et historique dans la même transaction. Une ancienne fenêtre ne peut écraser une modification plus récente.
- Une panne du panneau ne bloque pas la rédaction d’actualités. Une sauvegarde non confirmée ne se présente pas comme réussie.

## Performances

La lecture publique ne rejoint que le layout des pages publiques où le pied de page affiche déjà le numéro. Résultat partagé dans le cache serveur pendant cinq minutes, invalidé immédiatement lors d’une sauvegarde. Une seule ligne lue par rafraîchissement du cache ; aucun appel navigateur, polling, chargement par coureur ni nouvelle lecture dans les pages du jeu. La valeur de secours `0.9.1` et son éventuelle erreur sont également mises en cache pour éviter un afflux de requêtes en cas de panne.

La lecture privée se limite à une ligne et aux dix dernières entrées par clé primaire. Elle n’a lieu que dans l’administration du fondateur. Aucun cron, changement de calendrier, solde, résultat ou action de joueur n’est ajouté.

## Validation et livraison

Tests ciblés des schémas, actions, rendu, services, accès à la rédaction et pied de page ; vraie migration testée dans PostgreSQL/WASM isolé (permissions, entrées invalides, conflits, historique borné, absence de doublons et annulation de transaction après erreur injectée). Aucune fixture de production.

Recette : 100 tests applicatifs réussis dans dix fichiers, 63 contrôles PostgreSQL isolés, lint ciblé et catalogue anglais vérifiés. Contrôle interactif du vrai panneau et du vrai éditeur d’actualités, avec uniquement des actions hors ligne : sauvegarde de version, historique mis à jour, titre et corps du brouillon inchangés, aucune publication.

Migration additive `20261022230000_add_site_release_management.sql`, initialisée au numéro déjà affiché `0.9.1`, sans requalification arbitraire des livraisons passées. Le reçu d’installation compare les empreintes des fonctions d’actualités et de rôles avant/après. L’état réellement déployé est vérifié séparément avant de confirmer la livraison.
