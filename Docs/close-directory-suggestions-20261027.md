# Recherche approchante limitée

La page de recherche lance le moteur existant en premier, y compris les anciens noms d’équipe. Elle n’utilise le secours que lorsque le résultat complet est vide. Les recherches internes utilisées pour résoudre les fiches et les fédérations restent strictes.

Les suggestions s’appliquent aux DS actifs, équipes actives (noms présents ou historiques), coureurs actifs/libres/retraités et nations jouables. Elles portent sur leurs propres noms ; une ressemblance avec un pays ne remplit pas artificiellement la liste de tous ses coureurs.

Garde-fous : au moins quatre caractères significatifs, pas de recherche approchante sur UUID, six propositions au total, comparaison de mots complets/nom complet, une insertion/suppression/substitution ou inversion adjacente, deux modifications à partir de dix lettres. Accents, casse, ponctuation et espaces sont normalisés. Aucun résultat reste préférable à une suggestion éloignée.

Un seul RPC facultatif, borné à 2,5 secondes côté application, présélectionne au maximum 80 candidats par catégorie puis applique le filtre orthographique strict. Les coureurs réutilisent l’index GIN trigramme existant, y compris les retraités. Seuls les six candidats retenus sont enrichis avec les informations publiques du moteur actuel. Aucune nouvelle requête sur les chemins donnant déjà des résultats ; aucun téléchargement de l’annuaire entier ni tâche périodique.

La migration ajoute deux fonctions et les extensions standard `unaccent`/`fuzzystrmatch`. Elle conserve les fonctions de recherche existantes, leurs droits et leurs index. L’installation vérifie leurs empreintes avant/après, les droits du nouveau RPC et la santé de la base, avec des délais d’attente bornés. Aucun profil ni état de jeu n’est modifié.

Recette : 41 contrôles SQL sur PostgreSQL isolé avec les trois vraies extensions, dont les homonymes, fautes, accents, refus des résultats éloignés, anciens noms, retraite, confidentialité, plafond, restauration des réglages de l’appelant et usage de l’index avec 2 000 coureurs supplémentaires. Tests applicatifs de la priorité exacte, du marquage explicite des suggestions, des plafonds/doublons et du repli gracieux en cas d’erreur. Le message de recherche distingue clairement les suggestions des résultats normaux.
