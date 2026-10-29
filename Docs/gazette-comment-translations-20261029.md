# Gazette : traduction des déclarations des DS

- Traduction automatique des déclarations d'avant-course, réponses de zone mixte et derniers mots publiés dans une édition.
- La langue cible suit le jeu (français ou anglais). Détection locale côté serveur : les textes déjà dans cette langue ne sont pas envoyés au prestataire. Les textes trop ambigus restent détectés par le prestataire.
- Original affiché immédiatement, conservé en cas d'indisponibilité. Un lien permet de basculer entre traduction et original.
- Traitement uniquement à proximité de l'écran ; les réponses d'une interview repliée ne sont pas demandées. Les extraits et réponses identiques réutilisent le cache.
- Sources relues dans l'édition publiée accessible au membre ; aucune traduction de brouillon, de réponse privée ou de texte fourni arbitrairement par le client.
- Réutilisation du prestataire et de la file du chat, avec cache, tâches et budget Gazette séparés : 5 textes par lot, une requête à la fois, espacement de 2 secondes, 30 nouveaux textes par membre et par heure, 15 000 caractères et 200 textes par jour pour le site. Les lectures du cache ne consomment pas ces quotas.
- Échec : arrêt des nouvelles demandes dans la page, circuit serveur et temporisation des tâches. Aucun appel de traduction à la génération de l'édition ou à la simulation d'une course.

## Validation et livraison

- Tests ciblés API, extraction, détection de langue, file et prestataire du chat, rendu de Gazette.
- `scripts/test-gazette-comment-translations.mjs <module-pglite>` : migration et contrôles de concurrence, cache, droits, quotas dans une base isolée.
- `scripts/test-gazette-comment-translations-ui.mjs <module-happy-dom>` : interactions React hors ligne (visibilité, langue, original, réponse périmée, échec), sans prestataire.
- `scripts/deliver-gazette-comment-translations.mjs` : diagnostic séquentiel puis migration exacte avec délais SQL bornés, reçu atomique, vérification des droits et empreintes des fonctions du chat et politiques de publication.
- Aucun compte de test, aucune simulation d'action de joueur et aucun appel payant de test en production.
