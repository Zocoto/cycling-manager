# Saison 5 : offre de bienvenue et stories

Demande du propriétaire du 4 novembre 2026 : deux stories Instagram et un
entraîneur national de niveau 3 supplémentaire pour les nouveaux inscrits
pendant les dix prochains jours.

## Offre du site

- Fenêtre de dix jours réels à compter de l’application de la migration,
  définie et contrôlée par l’horloge PostgreSQL. Une réapplication ne la prolonge
  pas. L’inscription à la borne de fin est exclue.
- Éligibilité fondée sur `auth.users.created_at`. Les anciens comptes,
  bots et comptes suspendus ne sont pas concernés. Un compte inscrit dans la
  fenêtre peut terminer la création de son équipe après la clôture.
- L’événement existant `initial_career_generations` attribue automatiquement
  le cadeau quand l’équipe et ses premiers coureurs sont prêts.
- Un entraîneur actif de niveau 3, de la nationalité de l’équipe initiale,
  avec une spécialité de base et une compétence complémentaire différente.
  Il rejoint directement le staff privé, sans retirer un candidat du marché.
- Embauche gratuite et salaire offert pour la saison d’arrivée, selon le
  mécanisme d’exonération déjà présent. Le salaire habituel reprend la saison
  suivante ; le message de bienvenue l’indique et le staff utilise le badge
  existant « salaire offert cette saison ».
- Cadeau supplémentaire : aucun changement du capital initial, des aides ou
  de l’ancienne campagne de scout. Un reçu privé lié au compte empêche les
  doublons, y compris après un changement de saison ou une remise à zéro de
  carrière. Les règles normales de suppression de compte restent possibles.
- Un message FR/EN renvoie directement à l’onglet équipe du staff.

La campagne n’ajoute aucun appel aux pages, aucun polling et aucun cron. Le
contrôle se fait uniquement à la création de carrière. Le code du cadeau est
privé, sans RPC accessible aux joueurs. Une erreur du bonus annule ses écritures
et laisse aboutir l’inscription ; l’attribution peut être reprise de manière
idempotente pour un véritable compte éligible.

## Tests et livraison

Migration ciblée `20261104170000_add_ten_day_welcome_coach_campaign.sql` :
transaction atomique, verrou limité à 500 ms et requêtes bornées à 5 s.

`node scripts/test-welcome-coach-campaign-sql.mjs` : 41 contrôles en PostgreSQL
isolé, avec les vraies fonctions financières et contraintes capturées avant
livraison. Bornes temporelles, nationalité, niveau, talent, salaire, aides
existantes, absence de doublons, clôture, compte fondé tardivement, panne
optionnelle et reprise, droits d’accès et suppression de compte sont vérifiés.

`node scripts/deliver-welcome-coach-campaign.mjs --preflight`, puis
`--apply-reviewed` et `--verify`. Le script conserve les empreintes des règles
de bienvenue et de salaire existantes, vérifie les véritables comptes éligibles
et la santé du site. Il ne crée ni compte de test ni inscription fictive.

## Communication Instagram

Deux visuels 1080 × 1920 reprennent l’identité noire, verte et or du Grand Gala.
Création via `image_gen`, puis export JPEG léger ; fichiers et prompts conservés
dans `C:/Dev/artifacts/instagram-20261104`.

1. Grand Gala du 6 novembre : https://www.twitch.tv/gouille_tw ; sticker Lien
   Instagram « Voir le live ». Aucun horaire inventé.
2. Fin de S4 et lancement de S5 le 6 novembre : https://cyclostratege.fr ;
   sticker Lien « Créer mon équipe ». Le visuel annonce seulement un staff
   offert à l’inscription et une offre limitée, sans dévoiler son niveau,
   sa nationalité ni sa spécialité.

Les fichiers sont préparés pour publication par le propriétaire. Un lien
imprimé sur une image ne remplace pas le sticker cliquable d’Instagram.

## Activation vérifiée

Campagne active du **4 novembre 2026 à 12 h 44 min 34 s** au
**14 novembre 2026 à 12 h 44 min 34 s**, heure de Paris, borne de fin exclue.
Les 41 contrôles PostgreSQL isolés et 57 tests applicatifs ciblés passent,
ainsi que le catalogue anglais et ESLint. L’attribution est branchée sur le
véritable événement de création de carrière ; aucun compte fictif n’a été créé
en production. Au contrôle d’activation, aucun compte éligible n’était oublié,
les fonctions historiques ont conservé leur empreinte et le site répondait 200.

Preuves : `C:/Dev/artifacts/welcome-coach-campaign-20261104/verified.json`.
