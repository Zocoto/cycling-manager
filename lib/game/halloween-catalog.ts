/** Player-facing catalog. Prices and effects are enforced independently by the server. */
export { HALLOWEEN_PREVIEW_BOARDS, isHalloweenPreviewBoard, type HalloweenPreviewBoard } from "./halloween-preview-routes";
export type HalloweenPreviewKind = "cosmetic" | "consumable" | "transformation";
export type HalloweenPreviewArt =
  | "vlad" | "moon" | "trident" | "cap" | "bat" | "wheel" | "web" | "scarf"
  | "juice" | "bandage" | "scouting" | "hourglass" | "chocolate" | "salt"
  | "immortality" | "resurrection" | "elixir" | "builder-seal" | "witches-star" | "bonus-run" | "youth-fountain"
  | "slimming-tea" | "growth-syrup" | "headless-frame"
  | "leaking-bottle" | "stone-candy" | "bell" | "curse" | "vampire" | "mummy";

export type HalloweenPreviewItem = {
  id: string;
  name: string;
  kind: HalloweenPreviewKind;
  art: HalloweenPreviewArt;
  price: number | null;
  description: string;
  effect: string;
  /** Relics are excluded from ordinary draws; only an explicit rare draw can award one. */
  relic?: { limit: string; availability: "shop-only" | "shop-and-rare-draw"; tier?: "ultimate" };
  /** Design parameters only: actual age, eligibility and career are never mutated by this board. */
  ageChange?: { deltaYears: -1; minimumAge: number };
  /** Fictitious design parameters only; no rider mutation is implemented here. */
  bodyChange?: { attribute: "weightKg" | "heightCm"; delta: number; limit: string };
  status: "Cosmétique" | "Effet existant · dose à valider" | "Nouvelle idée · à valider" | "Transformation temporaire · sans malus";
};

/** Only changes the copy on the clean pilot, never the design parameters. */
export function halloweenPresentationEffect(item: HalloweenPreviewItem, pilot: boolean) {
  if (!pilot) return item.effect;
  return item.effect
    .replace(" Dose proposée, non activée dans cet aperçu.", "")
    .replace(" Durée proposée, non activée dans cet aperçu.", "")
    .replace(" Quantité limitée à prévoir.", "")
    .replace(" À arbitrer pour sa compatibilité avec les cols des tenues.", "")
    .replace("retour automatique prévu", "retour automatique");
}

export const HALLOWEEN_PREVIEW_ITEMS: readonly HalloweenPreviewItem[] = [
  { id: "lord-vlad", name: "Tenue Lord Vlad", kind: "cosmetic", art: "vlad", price: 50,
    description: "Cape anthracite, doublure bordeaux et broche en forme de roue.",
    effect: "Habille votre avatar. Son visage, ses cheveux et sa carnation restent les mêmes.", status: "Cosmétique" },
  { id: "halloween-background", name: "Fond Halloween", kind: "cosmetic", art: "moon", price: 30,
    description: "Une lune, deux silhouettes et une route. Sans décor chargé.",
    effect: "Un nouveau fond de portrait, compatible avec les tenues et accessoires.", status: "Cosmétique" },
  { id: "devil-trident", name: "Trident du supporter", kind: "cosmetic", art: "trident", price: 24,
    description: "Le trident du bord de route, avec une petite roue de vélo.",
    effect: "Accessoire placé à côté du portrait, sans masquer le visage.", status: "Cosmétique" },
  { id: "pumpkin-cap", name: "Casquette citrouille", kind: "cosmetic", art: "cap", price: 14,
    description: "Une casquette de cycliste orange avec un minuscule sourire de citrouille.",
    effect: "Un couvre-chef saisonnier que le joueur garde après Halloween.", status: "Cosmétique" },
  { id: "pocket-bat", name: "Chauve-souris de poche", kind: "cosmetic", art: "bat", price: 8,
    description: "Un petit pin’s noir, presque discret, sur la veste du DS.",
    effect: "Petit accessoire d’avatar. Aucun effet sur les performances.", status: "Cosmétique" },
  { id: "spectral-wheel", name: "Cadre Roue spectrale", kind: "cosmetic", art: "wheel", price: 16,
    description: "Un liseré cuivré et quelques rayons autour du portrait.",
    effect: "Cadre d’avatar fixe : pas de rotation ni de lumière clignotante.", status: "Cosmétique" },
  { id: "cobweb-frame", name: "Cadre Toile d’araignée", kind: "cosmetic", art: "web", price: 14,
    description: "Une petite toile accrochée au coin du portrait.",
    effect: "Décore le cadre, sans couvrir les yeux ni le nom du joueur.", status: "Cosmétique" },
  { id: "ghost-scarf", name: "Écharpe du fantôme", kind: "cosmetic", art: "scarf", price: 20,
    description: "Une écharpe écrue, bordée de petites coutures gris ardoise.",
    effect: "Une écharpe ajoutée à votre portrait, compatible avec votre tenue.", status: "Cosmétique" },
  { id: "pumpkin-juice", name: "Jus de citrouille", kind: "consumable", art: "juice", price: 6,
    description: "+5 points de forme pour un coureur, jusqu’à 100 % maximum.",
    effect: "+5 points de forme sur un coureur, sans dépasser 100. Quantité limitée à prévoir.", status: "Effet existant · dose à valider" },
  { id: "mummy-bandage", name: "Bandage de momie", kind: "consumable", art: "bandage", price: 8,
    description: "−12 h de convalescence sur une blessure. Sans effet sur les blessures de fatigue.",
    effect: "Retire jusqu’à 12 heures à la durée restante d’une blessure du coureur choisi, sans délai négatif. Reprend le soin existant de la trousse de récupération. Les blessures de fatigue restent incompressibles. Dose proposée, non activée dans cet aperçu.", status: "Effet existant · dose à valider" },
  { id: "scouts-candy", name: "Bonbon de clairvoyance", kind: "consumable", art: "scouting", price: 10,
    description: "Notes et potentiel exacts des coureurs libres et juniors repérés pendant 24 h.",
    effect: "Révèle pendant 24 heures toutes les notes et le potentiel des coureurs libres et des juniors repérés, comme la Loupe du recruteur existante. Ne crée aucun rapport et n’améliore pas les coureurs. Durée proposée, non activée dans cet aperçu.", status: "Effet existant · dose à valider" },
  { id: "gravediggers-hourglass", name: "Sablier du fossoyeur", kind: "consumable", art: "hourglass", price: 12,
    description: "−2 jours sur un chantier d’équipe en cours ; au moins 1 jour restant.",
    effect: "Retire jusqu’à 2 jours à un chantier d’infrastructure d’équipe déjà en cours, en conservant au moins 1 jour de construction restant, comme l’Équerre de chantier existante. Le chantier doit avoir été payé et démarré normalement. Dose proposée, non activée dans cet aperçu.", status: "Effet existant · dose à valider" },
  { id: "midnight-chocolate", name: "Chocolat de minuit", kind: "consumable", art: "chocolate", price: 8,
    description: "+1 jour d’expérience pour un coureur, sans fatigue supplémentaire.",
    effect: "Ajoute 1 jour d’expérience au coureur choisi, comme la Journée d’expérience existante. Ne rapporte ni points UCI ni résultat de course et n’ajoute aucune fatigue. Dose proposée, non activée dans cet aperçu.", status: "Effet existant · dose à valider" },
  { id: "spectres-tea", name: "Tisane du spectre", kind: "consumable", art: "slimming-tea", price: 25,
    description: "−1 kg sur un coureur, sans perte de forme. Une dose sur sa carrière.",
    effect: "Réduit durablement de 1 kg le poids actuel d’un coureur professionnel de votre équipe, sans coût de forme. Ne modifie ni son poids de référence, ni ses notes. La morphologie reste prise en compte par le moteur : peut aider en montagne, mais être moins favorable sur les pavés ou le plat. Ce n’est pas un bonus universel.",
    bodyChange: { attribute: "weightKg", delta: -1, limit: "Une seule dose de cette potion par coureur sur toute sa carrière, même s’il change d’équipe. Hors course uniquement. Utilisation refusée si le poids final passe sous le seuil du jeu : au moins 45 kg et le poids correspondant à un IMC de 18. Aucun effet partiel ni consommation en cas de refus." },
    status: "Nouvelle idée · à valider" },
  { id: "giants-syrup", name: "Sirop du géant", kind: "consumable", art: "growth-syrup", price: 25,
    description: "+2 cm sur un coureur, sans changer ses notes. Une dose sur sa carrière.",
    effect: "Augmente durablement de 2 cm la taille d’un coureur professionnel de votre équipe. Son poids, ses notes et son portrait restent inchangés. Influence légère et variable selon le terrain pour les coureurs dont la morphologie est active ; pour les anciens coureurs conservés en mode morphologie neutre, la taille reste descriptive. Aucun bonus de notes ajouté artificiellement.",
    bodyChange: { attribute: "heightCm", delta: 2, limit: "Une seule dose de cette potion par coureur sur toute sa carrière, même s’il change d’équipe. Hors course uniquement. Taille finale maximale : 210 cm ; même seuil morphologique que la tisane (au moins 45 kg et le poids correspondant à un IMC de 18 après croissance). Aucun effet partiel ni consommation en cas de refus." },
    status: "Nouvelle idée · à valider" },
  { id: "anti-curse-salt", name: "Sel anti-malédiction", kind: "consumable", art: "salt", price: null,
    description: "Retire le costume vampire ou momie et restaure votre avatar. Gratuit.",
    effect: "Retire le costume vampire ou momie. Aucun achat obligatoire pour revenir à son avatar normal.", status: "Nouvelle idée · à valider" },
  { id: "immortality-pact", name: "Pacte d’immortalité", kind: "consumable", art: "immortality", price: 900,
    description: "Protection contre le déclin lié à l’âge pendant 84 matinées d’entraînement.",
    effect: "Annule uniquement la régression naturelle des notes liée à l’âge pendant les 84 prochaines matinées d’entraînement. Ne restaure aucune note déjà perdue, ne rajeunit pas le coureur et n’annule ni les blessures, ni les pertes de forme, ni la retraite. La protection reste liée au coureur s’il change d’équipe.",
    relic: { availability: "shop-only", limit: "1 achat par DS et par événement. 1 pacte par coureur sur toute sa carrière, non cumulable. Objet non échangeable." },
    status: "Nouvelle idée · à valider" },
  { id: "mummy-resurrection", name: "Résurrection de la momie", kind: "consumable", art: "resurrection", price: 360,
    description: "Guérison immédiate de la blessure d’un coureur pro. Sa forme reste inchangée.",
    effect: "Supprime toute la durée restante de la blessure d’un coureur professionnel de votre équipe. Ne remonte pas sa forme et ne modifie aucun résultat ni aucune course déjà commencée. Utilisation hors course uniquement.",
    relic: { availability: "shop-only", limit: "1 achat par DS et par événement. Usage unique, objet non échangeable." },
    status: "Nouvelle idée · à valider" },
  { id: "full-moon-elixir", name: "Élixir de pleine lune", kind: "consumable", art: "elixir", price: 280,
    description: "Forme remise à 100 % pour un coureur pro. Ne guérit pas les blessures.",
    effect: "Remonte la forme d’un coureur professionnel de votre équipe à 100 %, quel que soit son niveau initial. Ne guérit aucune blessure, n’efface pas la fatigue du moteur de course et ne change aucune note. Utilisation hors course uniquement.",
    relic: { availability: "shop-only", limit: "1 achat par DS et par événement. Usage unique, objet non échangeable." },
    status: "Nouvelle idée · à valider" },
  { id: "cursed-builders-seal", name: "Sceau du bâtisseur maudit", kind: "consumable", art: "builder-seal", price: 450,
    description: "Achève instantanément un chantier d’équipe déjà payé. Hors fédé et écoles internationales.",
    effect: "Achève une construction ou montée de niveau déjà en cours dans votre équipe. Le prix du chantier doit avoir été payé normalement : aucun remboursement, niveau gratuit ou déblocage de prérequis. Exclut les bâtiments fédéraux et les écoles internationales.",
    relic: { availability: "shop-only", limit: "1 achat par DS et par événement. Un seul chantier, objet non échangeable." },
    status: "Nouvelle idée · à valider" },
  { id: "witches-star", name: "Étoile de la sorcière", kind: "consumable", art: "witches-star", price: 1800,
    description: "+1 étoile de potentiel pour un coureur pro de 3 étoiles ou moins. Maximum 4 étoiles.",
    effect: "Ajoute définitivement 1 étoile de potentiel à un coureur professionnel de votre équipe. Le coureur doit avoir 3 étoiles ou moins : le gain est toujours d’une étoile entière, sans dépasser le plafond de 4 étoiles. Favorise ses futures progressions, mais n’augmente immédiatement aucune note et ne donne aucune capacité spéciale. Au-delà de 3 étoiles, l’utilisation est refusée sans consommation.",
    relic: { availability: "shop-and-rare-draw", limit: "1 exemplaire maximum par DS sur l’événement, achat ou tirage confondus. 1 utilisation de cette relique par coureur sur toute sa carrière, même après un transfert. Hors course uniquement, objet non échangeable. Après obtention, le tirage rare donnera 15 roues démoniaques à la place (toujours 0,1 %)." },
    status: "Nouvelle idée · à valider" },
  { id: "youth-fountain", name: "Fontaine de jouvence", kind: "consumable", art: "youth-fountain", price: 3000,
    description: "Rajeunit de 1 an un coureur pro de 25 ans ou plus. Une utilisation sur sa carrière.",
    effect: "Retire exactement 1 an à l’âge actuel d’un coureur professionnel actif de votre équipe : par exemple, 35 ans deviennent 34 ans. Le vieillissement annuel reprend normalement ensuite. Les prochaines séances d’entraînement et la régression naturelle suivent les règles du nouvel âge, sans restaurer les notes déjà perdues ni augmenter immédiatement les notes ou le potentiel. La forme et les blessures restent inchangées. Ne réécrit ni les résultats passés, ni l’expérience, ni les contrats et ne rend pas un retraité actif.",
    ageChange: { deltaYears: -1, minimumAge: 25 },
    relic: { availability: "shop-only", tier: "ultimate", limit: "1 achat par DS et par événement. 1 utilisation par coureur sur toute sa carrière, même après un transfert. Réservée aux pros de 25 ans ou plus : l’âge final reste au moins de 24 ans, sans retour dans les catégories jeunes. Hors course uniquement, objet non échangeable. Utilisation refusée sans consommation si une condition n’est pas remplie. Exclusivité boutique : absente de Trick or Treat." },
    status: "Nouvelle idée · à valider" },
  { id: "vampire-kiss", name: "Baiser du vampire", kind: "transformation", art: "vampire", price: 14,
    description: "Deux crocs, une cape noire et un regard de noctambule.",
    effect: "Envoie à un autre DS un costume vampire pendant 24 h maximum. Il conserve son score, mais perd 10 % des roues de sa prochaine poursuite. Le sort disparaît ensuite. Portrait original conservé ; retrait gratuit à tout moment.", status: "Transformation temporaire · sans malus" },
  { id: "mummy-curse", name: "Malédiction de la momie", kind: "transformation", art: "mummy", price: 12,
    description: "Quelques bandelettes, deux yeux bien éveillés et un costume millénaire.",
    effect: "Envoie à un autre DS un costume de momie pendant 24 h maximum. Son prochain cadeau est emballé dans cinq bandelettes : il les retire pour tout récupérer, sans perte. Portrait original conservé ; retrait gratuit à tout moment.", status: "Transformation temporaire · sans malus" },
  { id: "headless-skin", name: "Tenue de l’équipier sans tête", kind: "cosmetic", art: "headless-frame", price: null,
    description: "La tenue exclusive du vainqueur de Cycling Hollow.",
    effect: "Récompense du classement final uniquement. Conservée après l’événement, elle n’est ni achetable ni disponible dans les tirages.", status: "Cosmétique" },
];
