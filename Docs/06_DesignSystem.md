# Peloton UI — Design System de Cyclo Stratège

## Version actuelle

**Peloton UI v0.3**

Cette version a été introduite pendant l’US 4 afin de rendre l’identité visuelle de Cyclo Stratège plus lumineuse, sportive et attractive.

Elle remplace l’orientation initiale plus sombre et plus austère de Peloton UI v0.2.

---

## Objectifs graphiques

Peloton UI doit transmettre quatre idées principales :

1. l’aventure sportive ;
2. la stratégie et la gestion ;
3. l’univers du cyclisme professionnel ;
4. la progression d’une équipe au fil des saisons.

Les pages publiques utilisent une ambiance lumineuse et alpine.

Les futurs écrans de gestion pourront utiliser des panneaux plus sombres afin de renforcer la lisibilité des données, tout en conservant les mêmes couleurs d’accent.

---

## Palette principale

| Rôle | Utilisation | Valeur |
|---|---|---|
| Nuit profonde | Navigation et surfaces premium | `#071A17` |
| Vert forêt | Panneaux sombres et espaces de gestion | `#173C2E` |
| Vert forêt clair | Surfaces secondaires | `#315B3E` |
| Menthe sportive | Accent, succès et éléments interactifs | `#42CDA8` |
| Menthe claire | Informations positives | `#7CCF9C` |
| Maillot leader | Action principale et mise en avant | `#F2C94C` |
| Jaune de survol | Survol des actions principales | `#FFD968` |
| Fond alpin | Fond clair principal | `#EAF5F3` |
| Fond clair secondaire | Sections de contenu | `#F7FAF7` |
| Texte sombre principal | Titres sur fond clair | `#082A2A` |
| Texte clair principal | Titres sur fond sombre | `#FFFDF4` |

---

## Principes d’utilisation

### Pages publiques

Les pages publiques privilégient :

- des fonds clairs ;
- des paysages cyclistes ou alpins ;
- une forte luminosité ;
- des titres larges et sportifs ;
- un bouton principal jaune ;
- des cartes blanches ou vert forêt.

### Espaces de gestion

Les futurs écrans applicatifs pourront privilégier :

- des fonds vert forêt ou nuit profonde ;
- des cartes structurées ;
- des données fortement contrastées ;
- des accents menthe pour les informations positives ;
- du jaune pour les décisions prioritaires.

---

## Boutons

### Action principale

L’action principale utilise le jaune du maillot de leader.

Exemples :

- Nouvelle carrière ;
- Jouer maintenant ;
- Valider une décision importante.

Caractéristiques :

- fond `#F2C94C` ;
- texte sombre `#071A17` ;
- graisse forte ;
- légère ombre ;
- survol avec `#FFD968`.

### Action secondaire

L’action secondaire utilise :

- un fond blanc ou transparent ;
- une bordure vert forêt ;
- un texte vert foncé ;
- un contraste suffisant avec le fond.

Le contraste du bouton secondaire de la page d’accueil devra encore être affiné dans une future US cosmétique.

### Action désactivée

Une action indisponible doit clairement apparaître comme inactive :

- couleur atténuée ;
- curseur non interactif ;
- absence d’animation de survol ;
- texte expliquant si nécessaire pourquoi l’action est indisponible.

---

## Typographie

La police principale actuelle est **Geist**, chargée avec `next/font`.

Les titres utilisent :

- une graisse très forte ;
- un interlettrage légèrement resserré ;
- une taille importante ;
- des phrases courtes et dynamiques.

Les textes fonctionnels privilégient la lisibilité et une hauteur de ligne confortable.

---

## Éléments graphiques

Les éléments récurrents de Peloton UI sont :

- les paysages de montagne ;
- les profils d’étape ;
- les routes en pointillés ;
- les roues et rayons de vélo ;
- les images de peloton ;
- les références au maillot de leader ;
- les surfaces sombres utilisées comme cockpit de gestion.

Ces éléments doivent rester décoratifs et ne jamais diminuer la lisibilité du contenu.

---

## Composants actuellement disponibles

| Composant | Rôle |
|---|---|
| `WheelLogo` | Symbole temporaire de Cyclo Stratège |
| `PublicHeader` | Navigation publique |
| `PublicFooter` | Pied de page public |
| `AuthPreview` | Structure commune des pages d’authentification |
| Cartes de fonctionnalités | Présentation des piliers du jeu |
| Cartes de release notes | Présentation des fonctionnalités livrées |

---

## Accessibilité

Les règles suivantes doivent être respectées :

- texte suffisamment contrasté ;
- focus clavier visible ;
- liens et boutons explicitement nommés ;
- éléments décoratifs masqués des technologies d’assistance avec `aria-hidden` ;
- formulaires associés à leurs labels ;
- navigation utilisable sur mobile ;
- aucun contenu essentiel uniquement transmis par une couleur.

---

## Points à améliorer ultérieurement

Les ajustements suivants sont volontairement reportés dans de futures US cosmétiques :

- harmonisation définitive de certaines couleurs ;
- amélioration du contraste du bouton secondaire ;
- création d’un logo officiel ;
- diversification des illustrations utilisées sur les cartes ;
- ajustement des textes d’accroche ;
- amélioration fine du responsive ;
- définition d’un ensemble d’icônes officiel ;
- création de composants UI plus génériques.