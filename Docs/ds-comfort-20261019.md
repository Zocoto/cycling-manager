# Confort du DS — 19 octobre 2026

## Périmètre

- Assistant : trésorerie négative et catégories jusque-là non classées explicitement prises en compte. Une échéance fédérale réelle à moins de deux heures passe en tête ; les enchères suivies bientôt closes et les préparations proches précèdent les rapports courants. Les catégories ne sont pas multipliées.
- Liens : entraînement filtré sur les programmes à zéro ; kinés filtrés sur les coureurs non suivis au chargement, sans faire disparaître un coureur pendant son affectation ; préparation ouverte sur la prochaine étape non enregistrée, calculée depuis le calendrier et les plans déjà chargés. Les liens explicites course/étape gardent priorité.
- Brouillons locaux : entraînement, nutrition et équipement permanent. Reprise explicite, jamais de soumission automatique. Clé isolée par utilisateur/équipe/saison ; référence de journée, paramètres et ressources exacts ; durée maximale de 24 h et taille maximale de 100 ko. Validation de forme des données avant restauration et contrôles serveur existants inchangés. Annuler supprime le brouillon. Stockage indisponible : les formulaires restent utilisables.
- Protection des modifications non enregistrées : avertissement à la fermeture/rechargement et sur les liens applicatifs, sans piéger l’historique du navigateur. Préparation route, CLM, briefing et matériel de course signalent leurs modifications ; les badges ne présentent plus un réglage modifié comme enregistré.
- Contrats : mêmes lignes et mêmes formulaires, organisés en cartes sur mobile et tableau sur ordinateur. Aucun doublon de formulaire ni de chargement.
- Explications tactiques reformulées en langage joueur, guide et traductions anglaises actualisés.

## Garde-fous de performance et de livraison

- Aucune requête Supabase ou HTTP ajoutée ; service assistant, promesses partagées et affichage différé conservés. Pas de lecture par coureur, pas de polling, pas de rafraîchissement automatique, pas de nouvelle API.
- Écriture locale différée de 350 ms, flush local à la sortie ; un seul écouteur de fermeture partagé entre formulaires modifiés.
- Aucun SQL/migration, moteur, cron, générateur, calendrier de simulation, récompense ou solde modifié. Aucune fixture ou action de joueur en production.
- Retour arrière : revert du commit applicatif, aucune opération sur les données.

## Recette

- 270 tests ciblés réussis dans 27 fichiers : tri, navigation, bornes/expiration des brouillons, isolation des références, protection des sorties, nombre d’appels inchangé, formulaires, rôles/CLM, contrats et régressions de groupes/échappées/arrivée.
- Recette interactive locale des composants réels avec actions serveur remplacées par des stubs : reprise explicite des trois éditeurs, annulation, changements d’équipe/jour/stock et stockage bloqué. Zéro soumission et zéro requête réseau.
- Contrats inspectés dans le navigateur à 320 et 390 px, ainsi qu’en tableau sur ordinateur.
- TypeScript sans émission, lint ciblé et couverture du catalogue anglais.

L’aperçu et les scripts de recette sont exclusivement locaux, hors fichiers livrés.
