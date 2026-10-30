# Salon fédéral sur mobile — 30 octobre 2026

Le chat intégré cumulait une ligne de navigation vers la fédération et le grand
bandeau du vestiaire. Sur téléphone, ces éléments occupaient l'essentiel de la
hauteur disponible pour les messages.

Le lien est désormais intégré au même bandeau que le pays et son drapeau. Sur
mobile, les textes de présentation et le libellé de statut sont masqués
visuellement ; le statut reste accessible aux lecteurs d'écran. Le bandeau
complet reste affiché dès le format tablette. Le salon de la page fédération
bénéficie également du bandeau compact sur téléphone.

La saisie conserve une hauteur de 48 pixels sur mobile, un défilement interne
pour les messages longs, un corps de 16 pixels et un libellé court. Le formulaire
et le bandeau ne se compriment pas au détriment de leur lisibilité. La zone de
messages utilise le reste de la hauteur et conserve son propre défilement.

Aucun changement aux requêtes, à la pagination, aux abonnements temps réel,
aux envois ni aux autorisations du salon. Aucune migration de données.

Vérifications : ESLint ciblé, catalogue anglais complet et 18 tests existants
du chat mobile, de l'accès au salon et des protections fédérales. Comparaison
visuelle locale des vrais composants, sans accès aux données du jeu : dans un
conteneur mobile de 390 × 740, la lecture passe de 186 à 376 pixels, et le bandeau
de 181 à 48 pixels. Petit format 320 × 568 : 204 pixels pour les messages après
correction. Vérification supplémentaire à hauteur réduite et sur bureau : pas
de débordement horizontal, saisie visible et présentation bureau conservée.
