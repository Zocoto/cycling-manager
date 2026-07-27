# Vérification e-mail en production

Ce parcours est bloquant pour les nouveaux comptes : un utilisateur ne peut
pas se connecter avant d’avoir confirmé son adresse.

## Architecture

1. L’inscription appelle Supabase Auth avec
   `emailRedirectTo=/inscription/confirmer`.
2. Supabase transmet l’e-mail à Brevo par SMTP.
3. Le lien ouvre une page intermédiaire sans consommer le jeton.
4. La confirmation n’est exécutée qu’après un clic explicite sur le bouton de
   la page.
5. Un lien expiré peut être renvoyé depuis l’inscription, la connexion ou
   l’écran d’erreur.

La page intermédiaire protège notamment contre les outils de sécurité des
boîtes e-mail qui préchargent automatiquement les liens.

## Réglages Supabase hébergés

- `Confirm Email` : activé (`mailer_autoconfirm=false`).
- Site URL : `https://cyclostratege.fr`.
- Redirect URLs : les routes `/inscription/confirmer` et
  `/auth/reset-password` des domaines de production et de préproduction.
- Durée du jeton : 3 600 secondes.
- Délai minimal entre deux envois au même utilisateur : 60 secondes.
- Plafond Auth : 30 e-mails par heure pour le projet.

Le fichier `supabase/config.toml` est la source versionnée de ces paramètres.
La synchronisation distante s’effectue avec `supabase config push`.

## Relais SMTP Brevo

À renseigner dans **Supabase > Authentication > Emails > SMTP Settings** :

- hôte : `smtp-relay.brevo.com` ;
- port : `587` avec TLS ;
- utilisateur : le login SMTP Brevo, et non l’adresse du relais ;
- mot de passe : une clé SMTP dédiée à Supabase, jamais une clé API ou le mot
  de passe du compte Brevo ;
- expéditeur : une adresse validée sur le domaine d’authentification ;
- nom d’expéditeur : `Cyclo Stratège`.

Les identifiants SMTP ne doivent jamais être ajoutés au dépôt. Le suivi des
liens Brevo doit être désactivé pour les messages d’authentification.

## Délivrabilité et exploitation

- Authentifier le domaine d’envoi avec SPF, DKIM et DMARC.
- Utiliser idéalement un sous-domaine réservé, par exemple
  `auth.cyclostratege.fr`.
- Surveiller les journaux Supabase Auth pour la remise au relais, puis les
  journaux transactionnels Brevo pour la livraison, les rebonds et les blocs.
- Conserver une deuxième solution SMTP prête à prendre le relais.
- Avant chaque mise en production, créer un compte avec une boîte contrôlée,
  ouvrir l’e-mail, confirmer, vérifier le refus avant confirmation puis la
  connexion après confirmation.

## Capacité

- SMTP Supabase par défaut : 2 e-mails par heure et seulement vers les membres
  autorisés du projet ; il ne convient pas à la production.
- SMTP Brevo personnalisé : Supabase démarre avec un plafond prudent de
  30 e-mails par heure, modifiable dans les limites Auth.
- Offre Brevo gratuite : 300 e-mails par jour, sans report du reliquat.

Les confirmations, renvois, réinitialisations de mot de passe et changements
d’adresse consomment le même budget d’e-mails Auth. Pour une ouverture publique,
une offre Brevo sans plafond quotidien est recommandée avant d’augmenter la
limite Supabase.
