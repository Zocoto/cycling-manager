# EPIC 8 — Équipe amateur et déblocage du sponsoring

## Objectif

Faire de l’équipe amateur la première véritable étape jouable de la carrière. Le Directeur Sportif crée son identité personnelle, fonde ensuite une équipe amateur autonome, puis débloque le marché du sponsoring en développant sa réputation.

Les équipes amateurs utilisent les mêmes mécaniques sportives que les équipes sponsorisées. Elles peuvent gérer leur effectif, s’inscrire aux courses autorisées par leur réputation et progresser dans le jeu. L’absence de sponsor modifie leur identité commerciale et leurs ressources, pas leurs règles sportives fondamentales.

## Parcours utilisateur cible

1. Le joueur crée son compte.
2. Il renseigne l’identité de son Directeur Sportif : nom affiché, avatar et nationalité.
3. Il crée séparément son équipe amateur :
   - nom de l’équipe ;
   - pays d’affiliation ;
   - motif du maillot ;
   - couleurs du maillot.
4. Le pays de l’équipe détermine la nationalité et le profil de génération des sept coureurs initiaux.
5. La carrière amateur commence sans sponsor.
6. Le module sponsoring reste verrouillé tant que le seuil global de réputation n’est pas atteint.
7. Une fois ce seuil franchi, l’équipe reçoit ses premières propositions de sponsoring.

## Identités du Directeur Sportif et de l’équipe

La nationalité du Directeur Sportif et le pays de l’équipe sont deux informations distinctes.

- la nationalité du DS représente uniquement son identité personnelle ;
- le pays de l’équipe représente son affiliation sportive ;
- les deux informations deviennent définitives après leur validation ;
- le pays de l’équipe détermine les sept coureurs initiaux ;
- les recrutements ultérieurs restent ouverts à toutes les nationalités ;
- les règles des championnats nationaux continuent de dépendre de la nationalité individuelle de chaque coureur.

## Identité amateur permanente

L’équipe conserve une identité amateur permanente comprenant :

- son nom amateur ;
- son pays d’affiliation ;
- son motif de maillot ;
- ses couleurs.

Lorsqu’un sponsor devient actif :

- le nom commercial du sponsor remplace le nom amateur dans les écrans courants ;
- le maillot du sponsor remplace le maillot amateur ;
- l’identité amateur reste conservée en base ;
- la fiche publique de l’équipe peut l’afficher discrètement, par exemple sous la forme « Équipe fondée sous le nom … » ;
- à la fin ou à la rupture du contrat, l’identité amateur est automatiquement restaurée.

L’identifiant public de l’équipe reste stable pendant tous ces changements.

## Créateur de maillot amateur

Le joueur dispose d’un outil simple, sans import d’image, fondé sur des paramètres structurés :

- quelques motifs prédéfinis ;
- une couleur principale ;
- une couleur secondaire ;
- éventuellement une couleur d’accent ;
- un aperçu immédiat du résultat.

Le dessin est enregistré comme une configuration de formes et de couleurs, puis rendu par un composant unique partout où le maillot apparaît. Le même composant choisit automatiquement entre le maillot amateur et le maillot du sponsor actif.

Le premier lot propose quatre motifs : bande centrale, diagonale, bandes horizontales et bicolore. Le joueur choisit trois couleurs et doit en utiliser au moins deux différentes. Le nom et le maillot sont validés une fois pendant la fondation ; une éventuelle modification ultérieure fera l’objet d’une règle de gameplay dédiée.

## Déblocage du sponsoring

Popularité et réputation désignent une seule et même statistique : `reputation_points`. Le terme affiché dans le jeu reste « Réputation ».

Le sponsoring possède deux niveaux de contrôle :

1. un seuil global de réputation déverrouille l’accès au marché du sponsoring ;
2. chaque sponsor conserve ensuite son propre seuil minimal de réputation.

Le seuil global doit être défini dans un objet de règles centralisé et ne doit pas être dispersé dans les pages ou les actions serveur.

Règle MVP centralisée :

```text
sponsoringUnlockReputation: 30
```

Cette valeur est provisoire et pourra être rééquilibrée lorsque les sources de gains et de pertes de réputation seront définies.

Avant le déblocage :

- la carte Sponsoring reste visible mais verrouillée ;
- elle affiche la réputation actuelle et la progression vers le seuil ;
- l’accès direct à la route ne génère aucune offre ;
- les actions de signature restent également protégées côté serveur.

Après le déblocage :

- les sponsors du pays de l’équipe sont prioritaires ;
- viennent ensuite les sponsors des pays voisins ;
- puis les sponsors internationaux ;
- les seuils propres aux sponsors filtrent les propositions réellement accessibles.

Un contrat déjà signé ne sera pas annulé si une future pénalité fait repasser temporairement le DS sous le seuil global. Le seuil contrôle l’accès aux nouvelles offres, pas la validité d’un contrat existant.

## Adaptation de l’existant

Le système actuel crée automatiquement une équipe générique dès l’enregistrement du profil DS. Cette mécanique devra être séparée en deux transactions : profil du DS, puis création de l’équipe.

Pour les carrières déjà créées :

- l’équipe et les coureurs existants sont conservés ;
- le pays actuel de l’équipe est repris comme affiliation définitive ;
- le joueur bénéficie d’une personnalisation unique de son nom et de son maillot amateur ;
- si un sponsor est actif, la nouvelle identité amateur reste discrète jusqu’à la fin du contrat ;
- aucune offre ou contrat déjà signé n’est supprimé par la migration.

## Découpage proposé

### Livraison 1 — Modèle d’identité amateur

- stockage du nom et du maillot amateur permanent ;
- séparation entre pays du DS et pays de l’équipe ;
- migration compatible avec les carrières existantes ;
- restauration fiable après un sponsor.

### Livraison 2 — Nouveau parcours de création

- le profil DS n’engendre plus automatiquement l’équipe ;
- écran de création de l’équipe ;
- choix définitif du pays ;
- choix du nom et création du maillot ;
- génération des sept coureurs selon le pays de l’équipe.

### Livraison 3 — Maillot unifié

- composant de rendu amateur ;
- remplacement des maillots gris codés en dur ;
- sélection automatique du maillot amateur ou sponsorisé ;
- affichage cohérent dans le bureau, l’effectif et les fiches publiques.

### Livraison 4 — Déblocage du sponsoring

- seuil global centralisé ;
- carte verrouillée et jauge de progression ;
- protection des routes, services et actions ;
- génération géographique fondée sur le pays de l’équipe ;
- notification lors du premier déblocage.

## Éléments à définir ultérieurement

- sources de gains et de pertes de réputation ;
- conditions permettant éventuellement de modifier le nom et le maillot après leur validation initiale ;
- budget initial et modèle économique exact d’une équipe sans sponsor ;
- effets éventuels du pays de l’équipe au-delà de l’identité et des propositions commerciales.
