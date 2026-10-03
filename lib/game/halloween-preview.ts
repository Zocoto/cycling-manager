/** Design-board data only. Never used by inventory, settlement or the simulator. */
export const HALLOWEEN_PREVIEW_BOARDS = [
  { slug: "bureau", label: "Bureau" },
  { slug: "cycliste-sans-tete", label: "La poursuite" },
  { slug: "boutique", label: "Boutique & avatars" },
  { slug: "mauvais-bonbons", label: "Idées de farces" },
] as const;

export type HalloweenPreviewBoard = (typeof HALLOWEEN_PREVIEW_BOARDS)[number]["slug"];
export type HalloweenPreviewKind = "cosmetic" | "consumable" | "trick";
export type HalloweenPreviewArt =
  | "vlad" | "moon" | "trident" | "cap" | "bat" | "wheel" | "web" | "scarf"
  | "juice" | "bandage" | "scouting" | "hourglass" | "chocolate" | "salt"
  | "leaking-bottle" | "stone-candy" | "bell" | "curse";

export type HalloweenPreviewItem = {
  id: string;
  name: string;
  kind: HalloweenPreviewKind;
  art: HalloweenPreviewArt;
  price: number | null;
  description: string;
  effect: string;
  status: "Cosmétique" | "Effet existant · dose à valider" | "Nouvelle idée · à valider" | "Farce sans malus en jeu";
};

export function isHalloweenPreviewBoard(value: string): value is HalloweenPreviewBoard {
  return HALLOWEEN_PREVIEW_BOARDS.some((board) => board.slug === value);
}

export const HALLOWEEN_PREVIEW_ITEMS: readonly HalloweenPreviewItem[] = [
  { id: "lord-vlad", name: "Tenue Lord Vlad", kind: "cosmetic", art: "vlad", price: 40,
    description: "Cape anthracite, doublure bordeaux et broche en forme de roue.",
    effect: "Habille votre avatar. Son visage, ses cheveux et sa carnation restent les mêmes.", status: "Cosmétique" },
  { id: "halloween-background", name: "Fond Halloween", kind: "cosmetic", art: "moon", price: 24,
    description: "Une lune, deux silhouettes et une route. Sans décor chargé.",
    effect: "Un nouveau fond de portrait, compatible avec les tenues et accessoires.", status: "Cosmétique" },
  { id: "devil-trident", name: "Trident du supporter", kind: "cosmetic", art: "trident", price: 18,
    description: "Le trident du bord de route, avec une petite roue de vélo.",
    effect: "Accessoire placé à côté du portrait, sans masquer le visage.", status: "Cosmétique" },
  { id: "pumpkin-cap", name: "Casquette citrouille", kind: "cosmetic", art: "cap", price: 10,
    description: "Une casquette de cycliste orange avec un minuscule sourire de citrouille.",
    effect: "Un couvre-chef saisonnier que le joueur garde après Halloween.", status: "Cosmétique" },
  { id: "pocket-bat", name: "Chauve-souris de poche", kind: "cosmetic", art: "bat", price: 6,
    description: "Un petit pin’s noir, presque discret, sur la veste du DS.",
    effect: "Petit accessoire d’avatar. Aucun effet sur les performances.", status: "Cosmétique" },
  { id: "spectral-wheel", name: "Cadre Roue spectrale", kind: "cosmetic", art: "wheel", price: 12,
    description: "Un liseré cuivré et quelques rayons autour du portrait.",
    effect: "Cadre d’avatar fixe : pas de rotation ni de lumière clignotante.", status: "Cosmétique" },
  { id: "cobweb-frame", name: "Cadre Toile d’araignée", kind: "cosmetic", art: "web", price: 10,
    description: "Une petite toile accrochée au coin du portrait.",
    effect: "Décore le cadre, sans couvrir les yeux ni le nom du joueur.", status: "Cosmétique" },
  { id: "ghost-scarf", name: "Écharpe du fantôme", kind: "cosmetic", art: "scarf", price: 16,
    description: "Une écharpe écrue, bordée de petites coutures gris ardoise.",
    effect: "Accessoire de cou. À arbitrer pour sa compatibilité avec les cols des tenues.", status: "Cosmétique" },
  { id: "pumpkin-juice", name: "Jus de citrouille", kind: "consumable", art: "juice", price: 6,
    description: "Un bidon de récupération aux couleurs de l’événement.",
    effect: "+5 points de forme sur un coureur, sans dépasser 100. Quantité limitée à prévoir.", status: "Effet existant · dose à valider" },
  { id: "mummy-bandage", name: "Bandage de momie", kind: "consumable", art: "bandage", price: 8,
    description: "La trousse médicale s’habille pour Halloween.",
    effect: "Réduit une durée de blessure via le soin existant. Pas de guérison totale promise ; dose à valider.", status: "Effet existant · dose à valider" },
  { id: "scouts-candy", name: "Bonbon de clairvoyance", kind: "consumable", art: "scouting", price: 10,
    description: "Un bonbon à l’œil grand ouvert pour le scout.",
    effect: "Reprend un effet de visibilité de scouting existant. Portée et durée à arbitrer.", status: "Effet existant · dose à valider" },
  { id: "gravediggers-hourglass", name: "Sablier du fossoyeur", kind: "consumable", art: "hourglass", price: 12,
    description: "Un peu de sable orange pour accélérer un chantier.",
    effect: "Réduction d’un délai de construction via l’effet existant. Durée et quotas à valider.", status: "Effet existant · dose à valider" },
  { id: "midnight-chocolate", name: "Chocolat de minuit", kind: "consumable", art: "chocolate", price: 8,
    description: "Un petit carré de chocolat dans son emballage nocturne.",
    effect: "Petit gain d’expérience pour un coureur via l’effet existant. Dose et quotas à valider.", status: "Effet existant · dose à valider" },
  { id: "anti-curse-salt", name: "Sel anti-malédiction", kind: "consumable", art: "salt", price: null,
    description: "À offrir avec une farce : son antidote reste gratuit.",
    effect: "Retire une farce visuelle. Aucun achat obligatoire pour revenir à son avatar normal.", status: "Nouvelle idée · à valider" },
  { id: "leaking-bottle", name: "Bidon percé", kind: "trick", art: "leaking-bottle", price: null,
    description: "Le jus s’est échappé avant d’arriver au peloton…",
    effect: "Objet raté : aucun bonus de forme. Aucune forme n’est retirée non plus. Peut être jeté gratuitement.", status: "Farce sans malus en jeu" },
  { id: "stone-candy", name: "Bonbon pétrifié", kind: "trick", art: "stone-candy", price: null,
    description: "Même un sprinteur affamé ne le croquerait pas.",
    effect: "Bonbon inutilisable : pas de récompense supplémentaire. Petit objet souvenir, supprimable gratuitement.", status: "Farce sans malus en jeu" },
  { id: "haunted-bell", name: "Clochette hantée", kind: "trick", art: "bell", price: null,
    description: "Vous avez attiré un passager clandestin tout blanc.",
    effect: "Petit fantôme temporaire sur le portrait pendant 24 h. Masquable gratuitement, sans son automatique.", status: "Farce sans malus en jeu" },
  { id: "cursed-charm", name: "Grigri de la roue maudite", kind: "trick", art: "curse", price: null,
    description: "Un grigri à transmettre… uniquement à un joueur consentant.",
    effect: "Badge maudit temporaire. Une transmission par jour, sans empilement ni prolongation à chaque transfert. Dissipation gratuite.", status: "Farce sans malus en jeu" },
];
