# JO : peloton mondial et convocations anticipées

## Format retenu

Une course mondiale à J24, sans divisions ni groupes. Le parcours hybride reste celui validé : 194 km, trois grandes montées, vallons répétés, trois secteurs pavés (19 km), final plat de 8 km.

À J4, les invitations sont figées pour laisser vingt jours aux fédérations. Score national : 70 % percentile du classement UCI final national de la saison précédente, 30 % percentile du niveau des quatre meilleurs coureurs professionnels actuellement notés, sur le profil olympique. Les quatre places du score sont fixes pour ne pas avantager une nation n'ayant qu'un seul coureur fort. Notes natives, sans forme ni équipement.

Rangs 1–10 : jusqu'à 8 places ; 11–30 : jusqu'à 4 ; 31–60 : jusqu'à 2. Quotas limités aux coureurs disponibles dans le pays lors du gel, maximum total 220. Les places inoccupées ne sont pas réattribuées automatiquement.

## Convocations

Le président humain conserve la sélection manuelle dans le quota, via le même panneau et les mêmes confirmations du DS propriétaire, indépendamment de sa nationalité. Mode automatique inchangé au choix de la fédération.

- Dès le gel de qualification : convocations manuelles possibles.
- H−7 jours : premières convocations automatiques, compléments et remplacements après refus.
- H−24 : fermeture des nouvelles convocations manuelles et automatiques.
- H−1 : fin des réponses du DS. Sans réponse, pas de participation aux JO. Aucun retrait de l'autre inscription du coureur pour une invitation non acceptée.

Un refus n'est pas redemandé automatiquement. Un accord sur un tour commencé/verrouillé échoue proprement, sans fausse confirmation. Les IDs et accords existants sont préservés lors du regroupement des anciennes épreuves olympiques ; seule leur inscription olympique change d'édition. Un garde supplémentaire interdit toute inscription sans confirmation ou au-delà du quota national.

## Isolation de la Nations Cup

Registre olympique et qualification indépendants des divisions. Les résultats olympiques sont exclus du classement à points de Nations Cup. La prochaine Nations Cup prend comme source la dernière saison de Nations Cup, pas les JO. Les cinq disciplines, quotas d'un coureur, groupes, mouvements et délais ordinaires restent inchangés. Les affectations de division déjà présentes ne sont pas modifiées par la migration.

## Vérification avant production

Tests SQL dans PGlite isolé, jamais sur Supabase. Contrôles en production exclusivement en lecture seule, séquentiels, timeout 5 secondes. Migration avec verrous bornés et refus si une épreuve a commencé, a des résultats, une simulation ou une réservation de simulation. Snapshot privé des accords, rosters, liens et affectations de division avant conversion. Déploiement local lourd interdit : vérifications ciblées puis build Vercel.

Prévisualisation réelle du 12 octobre : 60 nations, 220 places. Le Japon est 67e mais possède déjà un accord humain confirmé. L'utilisateur a validé une exception de transition uniquement pour S4 : 2 places au Japon à la place de la 60e nation. Son rang sportif reste visible et le motif d'invitation exceptionnel est indiqué. Ce n'est pas une règle de qualification reconduite pour les prochaines éditions.

Vérifications locales du correctif : 57 assertions PostgreSQL isolées avec l'exception japonaise, 52 sans exception (dont S8 sans reconduction), 90 tests applicatifs ciblés et ESLint. Les premières suites Vitest ont été bloquées par le dossier temporaire du sandbox ; elles ont été relancées avec un dossier temporaire dédié sous C:\Dev et passent toutes. Aucun test joueur ni fixture en production.

Migration `20261012160000` appliquée et enregistrée le 12 octobre vers 12h24 Paris : une course mondiale, 194 km, 21 tronçons, 60 nations, 220 places. Japon : quota 2, rang 67, une convocation confirmée conservée ; 60e nation : quota 0. Reçu d'intégrité : zéro membre changé, zéro roster changé, zéro affectation Nations Cup changée, zéro lien incorrect, aucun résultat. Connexion SQL vérifiée après application. Départ le 1er novembre à 18h Paris.

Premier build Vercel (`dpl_4itzKFrCaHUPUjF5HL9SdmsczBcA`) arrêté sur le typage `.returns` du nouveau RPC Supabase : aucun remplacement du site actif. Correction du type de réponse avec contrôle explicite du tableau. Ajout d'un test moteur local avec les 220 partants répartis sur 60 nations : toutes les entrées restituées une seule fois, un vainqueur et temps finis. Aucun changement du moteur.

## Livraison vérifiée

Code publié sur main : `a5921c3f`. Déploiement production `dpl_EErafojqCsyeDasWjCBR7Ztf5sqL`, URL technique `https://cyclostratege-64378w30r-zocotos-projects.vercel.app`, état READY et alias `https://cyclostratege.fr` vérifiés. Accueil et guide HTTP 200 ; le guide servi contient les quotas, la qualification figée et les délais anticipés. La route JO privée redirige vers la connexion sans session. Aucun log d'erreur sur ce déploiement dans la fenêtre de contrôle de cinq minutes. Dernière passe : 91 tests applicatifs ciblés réussis.

Dernier contrôle SQL en lecture seule : Japon rang 67, quota 2, une convocation confirmée ; Cap-Vert rang 60, quota 0, aucune convocation confirmée. Les comptes joueurs n'ont été ni créés ni utilisés pour des actions de test. Ce reçu de livraison est une mise à jour documentaire locale, sans nouveau déploiement inutile.
