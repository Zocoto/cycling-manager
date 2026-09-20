export type CyclogazetteGameType = "sudoku" | "crossword";

export type CyclogazetteGameDifficulty = "facile" | "moyen" | "difficile";

export type CyclogazetteSudokuPuzzle = {
  difficulty: CyclogazetteGameDifficulty;
  cells: Array<number | null>;
};

export type CyclogazetteCrosswordCell = {
  index: number;
  row: number;
  column: number;
  number: number | null;
};

export type CyclogazetteCrosswordEntry = {
  number: number;
  direction: "horizontal" | "vertical";
  row: number;
  column: number;
  length: number;
  clue: string;
};

export type CyclogazetteCrosswordPuzzle = {
  difficulty: CyclogazetteGameDifficulty;
  rows: number;
  columns: number;
  cells: CyclogazetteCrosswordCell[];
  entries: CyclogazetteCrosswordEntry[];
};

export type CyclogazetteDailyGames = {
  issueNumber: number;
  sudoku: CyclogazetteSudokuPuzzle;
  crossword: CyclogazetteCrosswordPuzzle;
};

export type CyclogazetteGameSolutions = {
  issueNumber: number;
  sudokuRows: string[];
  crosswordRows: string[];
};

type PrivateSudokuPuzzle = CyclogazetteSudokuPuzzle & { solution: string };
type PrivateCrosswordPuzzle = CyclogazetteCrosswordPuzzle & {
  solution: string;
};

type CrosswordWord = {
  answer: string;
  clue: string;
};

type PlacedCrosswordWord = CrosswordWord & {
  row: number;
  column: number;
  direction: "horizontal" | "vertical";
};

type CrosswordGridCell = {
  letter: string;
  directions: Set<"horizontal" | "vertical">;
};

const SUDOKU_TEMPLATES: Record<
  CyclogazetteGameDifficulty,
  { puzzle: string; solution: string }
> = {
  facile: {
    puzzle:
      "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
    solution:
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
  },
  moyen: {
    puzzle:
      "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
    solution:
      "435269781682571493197834562826195347374682915951743628519326874248957136763418259",
  },
  difficile: {
    puzzle:
      "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
};

const CYCLING_CROSSWORD_WORDS: readonly CrosswordWord[] = [
  { answer: "BIDON", clue: "Réserve portée sur le cadre" },
  { answer: "BRAQUET", clue: "Rapport choisi avant d’appuyer sur les pédales" },
  { answer: "CADRE", clue: "Squelette de la machine" },
  { answer: "CASQUE", clue: "Protection indispensable du coureur" },
  { answer: "CHAINE", clue: "Elle transmet l’effort à la roue arrière" },
  { answer: "COL", clue: "Sommet routier cher aux grimpeurs" },
  { answer: "DOSSARD", clue: "Numéro porté en course" },
  { answer: "EQUIPE", clue: "Collectif autour d’un leader" },
  { answer: "ETAPE", clue: "Une journée dans un grand tour" },
  { answer: "FANION", clue: "Petit drapeau annonçant parfois un danger" },
  { answer: "FREIN", clue: "Il aide à négocier la descente" },
  { answer: "GUIDON", clue: "Le coureur y pose ses mains" },
  { answer: "JANTE", clue: "Cercle extérieur d’une roue" },
  { answer: "MAILLOT", clue: "Couleur portée par le leader" },
  { answer: "MOYEU", clue: "Cœur mécanique de la roue" },
  { answer: "PAVE", clue: "Pierre redoutée des classiques du Nord" },
  { answer: "PEDALE", clue: "Point d’appui du pied" },
  { answer: "PELOTON", clue: "Groupe principal d’une course" },
  { answer: "PIGNON", clue: "Roue dentée de la cassette" },
  { answer: "POMPE", clue: "Elle rend de l’air au pneu" },
  { answer: "RAVITO", clue: "Abrégé de la zone où l’on se nourrit" },
  { answer: "RELAIS", clue: "Passage en tête entre compagnons d’échappée" },
  { answer: "ROUE", clue: "Elle tourne autour de son moyeu" },
  { answer: "SELLE", clue: "Assise du cycliste" },
  { answer: "SPRINT", clue: "Explication très rapide pour la victoire" },
  { answer: "VELO", clue: "Machine à deux roues du peloton" },
  { answer: "VIRAGE", clue: "Courbe qui exige une bonne trajectoire" },
  { answer: "BORDURE", clue: "Cassure provoquée par le vent de côté" },
  { answer: "DANSEUSE", clue: "Position debout sur les pédales" },
  { answer: "ECHAPPEE", clue: "Groupe parti à l’avant" },
  { answer: "FLAMME", clue: "Elle marque le dernier kilomètre" },
  { answer: "GRIMPEUR", clue: "Spécialiste des fortes pentes" },
  { answer: "LEADER", clue: "Coureur protégé par ses équipiers" },
  { answer: "MUSSETTE", clue: "Sac remis au ravitaillement" },
  { answer: "OREILLETTE", clue: "Lien radio entre le DS et le coureur" },
  { answer: "POINTEUR", clue: "Coureur surveillé au classement général" },
  { answer: "PROLOGUE", clue: "Très court contre-la-montre d’ouverture" },
  { answer: "ROULEUR", clue: "Spécialiste des longs efforts réguliers" },
  { answer: "SOIGNEUR", clue: "Membre du staff présent au ravitaillement" },
  { answer: "VENTOUX", clue: "Géant chauve de Provence" },
  { answer: "ARDENNES", clue: "Massif associé aux classiques vallonnées" },
  { answer: "DOMESTIQUE", clue: "Équipier dévoué à son leader" },
  { answer: "POURSUITE", clue: "Chasse menée derrière les attaquants" },
  { answer: "CLASSEMENT", clue: "Ordre établi après l’arrivée" },
  { answer: "CHRONO", clue: "Autre nom du contre-la-montre" },
  { answer: "TACTIQUE", clue: "Plan imaginé depuis la voiture du DS" },
  { answer: "ASCENSION", clue: "Longue montée vers un sommet" },
  { answer: "DESCENTE", clue: "Partie où la trajectoire compte beaucoup" },
] as const;

const GENERAL_CROSSWORD_WORDS: readonly CrosswordWord[] = [
  { answer: "OCEAN", clue: "Immense étendue d’eau salée" },
  { answer: "FLEUVE", clue: "Cours d’eau qui rejoint la mer" },
  { answer: "ILE", clue: "Terre entourée d’eau" },
  { answer: "CAP", clue: "Pointe de terre avancée dans la mer" },
  { answer: "DELTA", clue: "Embouchure ramifiée d’un fleuve" },
  { answer: "VOLCAN", clue: "Montagne qui peut entrer en éruption" },
  { answer: "DESERT", clue: "Région où la pluie se fait rare" },
  { answer: "SAVANE", clue: "Grande prairie des régions tropicales" },
  { answer: "FORET", clue: "Vaste territoire couvert d’arbres" },
  { answer: "LAC", clue: "Étendue d’eau entourée de terres" },
  { answer: "RIVIERE", clue: "Cours d’eau qui rejoint souvent un fleuve" },
  { answer: "VALLEE", clue: "Creux naturel entre deux reliefs" },
  { answer: "FALAISE", clue: "Paroi rocheuse dominant la mer" },
  { answer: "PRAIRIE", clue: "Terrain couvert d’herbe" },
  { answer: "GLACIER", clue: "Fleuve de glace en mouvement lent" },
  { answer: "AIGLE", clue: "Grand rapace aux yeux perçants" },
  { answer: "LOUP", clue: "Canidé qui vit souvent en meute" },
  { answer: "LOUTRE", clue: "Mammifère joueur des rivières" },
  { answer: "PANDA", clue: "Mammifère amateur de bambou" },
  { answer: "TIGRE", clue: "Grand félin rayé" },
  { answer: "BALEINE", clue: "Géant marin qui respire de l’air" },
  { answer: "CORAIL", clue: "Animal marin bâtisseur de récifs" },
  { answer: "HERON", clue: "Grand oiseau pêcheur aux longues pattes" },
  { answer: "RENARD", clue: "Canidé réputé rusé" },
  { answer: "CHOUETTE", clue: "Rapace nocturne sans aigrettes" },
  { answer: "DAUPHIN", clue: "Mammifère marin réputé sociable" },
  { answer: "ORQUE", clue: "Cétacé noir et blanc" },
  { answer: "CASTOR", clue: "Rongeur qui construit des barrages" },
  { answer: "BISON", clue: "Grand bovidé à la bosse imposante" },
  { answer: "ZEBRE", clue: "Équidé aux rayures noires et blanches" },
  { answer: "KOALA", clue: "Marsupial friand d’eucalyptus" },
  { answer: "LYNX", clue: "Félin aux oreilles terminées par un pinceau" },
  { answer: "OURS", clue: "Grand mammifère qui hiverne parfois" },
  { answer: "OPERA", clue: "Spectacle où le théâtre se chante" },
  { answer: "ROMAN", clue: "Long récit de fiction" },
  { answer: "POEME", clue: "Texte rythmé fait de vers ou de prose" },
  { answer: "MUSEE", clue: "Lieu où sont conservées des collections" },
  { answer: "SCENE", clue: "Espace où jouent les artistes" },
  { answer: "ACTEUR", clue: "Interprète d’un rôle" },
  { answer: "CINEMA", clue: "Septième art" },
  { answer: "PIANO", clue: "Instrument à touches noires et blanches" },
  { answer: "VIOLON", clue: "Instrument à quatre cordes joué avec un archet" },
  { answer: "FRESQUE", clue: "Peinture réalisée sur un mur" },
  { answer: "STATUE", clue: "Œuvre sculptée en trois dimensions" },
  { answer: "THEATRE", clue: "Art de raconter une histoire sur scène" },
  { answer: "BALLET", clue: "Spectacle raconté par la danse" },
  { answer: "MELODIE", clue: "Suite de notes facile à fredonner" },
  { answer: "RIME", clue: "Sons semblables à la fin de deux vers" },
  { answer: "LIVRE", clue: "Ouvrage composé de pages reliées" },
  { answer: "ATOME", clue: "Très petite unité de matière" },
  { answer: "COMETE", clue: "Astre glacé parfois suivi d’une longue traîne" },
  { answer: "ORBITE", clue: "Trajectoire d’un astre autour d’un autre" },
  { answer: "PLANETE", clue: "Astre qui tourne autour d’une étoile" },
  { answer: "ETOILE", clue: "Boule de gaz qui produit sa propre lumière" },
  { answer: "GALAXIE", clue: "Immense ensemble d’étoiles" },
  { answer: "LASER", clue: "Faisceau lumineux très concentré" },
  { answer: "ROBOT", clue: "Machine capable d’exécuter des tâches" },
  { answer: "SATURNE", clue: "Planète célèbre pour ses anneaux" },
  { answer: "ECLIPSE", clue: "Disparition apparente d’un astre" },
  { answer: "FUSEE", clue: "Véhicule propulsé vers l’espace" },
  { answer: "MICROBE", clue: "Organisme invisible à l’œil nu" },
  { answer: "CACAO", clue: "Graine à l’origine du chocolat" },
  { answer: "VANILLE", clue: "Épice parfumée issue d’une orchidée" },
  { answer: "SAFRAN", clue: "Épice obtenue à partir de fins stigmates rouges" },
  { answer: "CITRON", clue: "Agrume jaune au goût acide" },
  { answer: "OLIVE", clue: "Petit fruit dont on tire une huile" },
  { answer: "BRIOCHE", clue: "Viennoiserie riche en beurre" },
  { answer: "FROMAGE", clue: "Produit obtenu à partir de lait caillé" },
  { answer: "EPICE", clue: "Substance qui parfume un plat" },
  { answer: "MIEL", clue: "Douceur fabriquée par les abeilles" },
  { answer: "RAISIN", clue: "Fruit qui peut devenir du vin" },
  { answer: "CERISE", clue: "Petit fruit rouge à noyau" },
  { answer: "TOMATE", clue: "Fruit rouge souvent cuisiné comme un légume" },
  { answer: "NOUGAT", clue: "Confiserie au miel et aux fruits secs" },
  { answer: "PRALINE", clue: "Amande ou noisette enrobée de sucre cuit" },
  { answer: "MIROIR", clue: "Surface qui renvoie une image" },
  { answer: "HORLOGE", clue: "Instrument qui indique l’heure" },
  { answer: "JARDIN", clue: "Terrain où l’on cultive fleurs et légumes" },
  { answer: "PONT", clue: "Ouvrage permettant de franchir un obstacle" },
  { answer: "PHARE", clue: "Tour lumineuse qui guide les navires" },
  { answer: "TRAIN", clue: "Suite de wagons tirés sur des rails" },
  { answer: "NUAGE", clue: "Masse de gouttelettes suspendue dans le ciel" },
  { answer: "PLAGE", clue: "Rivage couvert de sable ou de galets" },
  { answer: "CHATEAU", clue: "Grande demeure fortifiée ou d’apparat" },
  { answer: "CABANE", clue: "Petite construction simple servant d’abri" },
  { answer: "VOYAGE", clue: "Déplacement vers une destination lointaine" },
  { answer: "ENIGME", clue: "Question qui demande de trouver une solution" },
  { answer: "SOURIRE", clue: "Expression joyeuse dessinée par la bouche" },
  { answer: "ABRICOT", clue: "Fruit orangé au noyau lisse" },
  { answer: "ACCUEIL", clue: "Manière de recevoir une personne" },
  { answer: "ADRESSE", clue: "Indication d’un lieu ou habileté remarquable" },
  { answer: "ANNEAUX", clue: "Cercles portés aux doigts ou autour de Saturne" },
  { answer: "ARCHIVE", clue: "Document conservé pour mémoire" },
  { answer: "BALANCE", clue: "Instrument servant à peser" },
  { answer: "BATEAUX", clue: "Ils naviguent sur l’eau" },
  { answer: "BOUQUET", clue: "Assemblage de fleurs" },
  { answer: "BUREAUX", clue: "Meubles de travail ou locaux professionnels" },
  { answer: "CABINET", clue: "Petite pièce de travail ou groupe de conseillers" },
  { answer: "CAPITAL", clue: "Essentiel, ou relatif à une capitale" },
  { answer: "CHANSON", clue: "Texte mis en musique pour être chanté" },
  { answer: "CHEMISE", clue: "Vêtement boutonné couvrant le torse" },
  { answer: "COURAGE", clue: "Force permettant d’affronter une difficulté" },
  { answer: "CRAYONS", clue: "Outils de dessin et d’écriture" },
  { answer: "CUISINE", clue: "Pièce où l’on prépare les repas" },
  { answer: "DESSERT", clue: "Dernier plat souvent sucré" },
  { answer: "DIAMANT", clue: "Pierre précieuse d’une grande dureté" },
  { answer: "DRAPEAU", clue: "Étoffe portant les couleurs d’un pays" },
  { answer: "FAMILLE", clue: "Ensemble de personnes unies par la parenté" },
  { answer: "FENETRE", clue: "Ouverture vitrée pratiquée dans un mur" },
  { answer: "HORIZON", clue: "Ligne où le ciel semble rejoindre la terre" },
  { answer: "JOURNAL", clue: "Publication qui paraît régulièrement" },
  { answer: "LECTURE", clue: "Action de parcourir un texte" },
  { answer: "LUMIERE", clue: "Ce qui rend les objets visibles" },
  { answer: "MACHINE", clue: "Ensemble mécanique conçu pour effectuer un travail" },
  { answer: "MAGIQUE", clue: "Qui semble produit par un pouvoir surnaturel" },
  { answer: "MANTEAU", clue: "Vêtement porté par-dessus les autres" },
  { answer: "MESSAGE", clue: "Information transmise à quelqu’un" },
  { answer: "OISEAUX", clue: "Animaux pourvus de plumes" },
  { answer: "PASSAGE", clue: "Endroit ou action permettant de passer" },
  { answer: "PEINTRE", clue: "Artiste qui travaille avec des couleurs" },
  { answer: "PENDULE", clue: "Horloge ou masse qui oscille" },
  { answer: "PLAFOND", clue: "Surface supérieure d’une pièce" },
  { answer: "POISSON", clue: "Animal aquatique muni de nageoires" },
  { answer: "PORTAIL", clue: "Grande porte marquant une entrée" },
  { answer: "POTAGER", clue: "Jardin consacré aux légumes" },
  { answer: "RECETTE", clue: "Instructions de cuisine ou somme encaissée" },
  { answer: "ROYAUME", clue: "Territoire gouverné par un roi ou une reine" },
  { answer: "SILENCE", clue: "Absence de bruit" },
  { answer: "SOMMEIL", clue: "État naturel pendant lequel on dort" },
  { answer: "TABLEAU", clue: "Œuvre peinte ou panneau présentant des données" },
  { answer: "TEMPETE", clue: "Violente perturbation atmosphérique" },
  { answer: "TERRAIN", clue: "Étendue de sol aux limites définies" },
  { answer: "VILLAGE", clue: "Petite agglomération rurale" },
  { answer: "AEROPORT", clue: "Lieu de départ et d’arrivée des avions" },
  { answer: "AVENTURE", clue: "Expérience comportant imprévu et découverte" },
  { answer: "BATIMENT", clue: "Construction destinée à abriter des activités" },
  { answer: "BRACELET", clue: "Bijou porté autour du poignet" },
  { answer: "CHOCOLAT", clue: "Aliment obtenu à partir du cacao" },
  { answer: "COULEURS", clue: "Sensations produites par la lumière" },
  { answer: "ELEPHANT", clue: "Grand mammifère à trompe" },
  { answer: "ESCARGOT", clue: "Mollusque avançant avec sa coquille" },
  { answer: "FESTIVAL", clue: "Série de manifestations artistiques" },
  { answer: "HERITAGE", clue: "Ce qui est transmis par les générations précédentes" },
  { answer: "HISTOIRE", clue: "Récit d’événements réels ou imaginaires" },
  { answer: "LANTERNE", clue: "Lampe protégée par une enveloppe transparente" },
  { answer: "PAPILLON", clue: "Insecte aux ailes souvent colorées" },
  { answer: "PYRAMIDE", clue: "Monument à base large et sommet pointu" },
  { answer: "QUESTION", clue: "Phrase formulée pour obtenir une réponse" },
  { answer: "RENCONTRE", clue: "Fait de se trouver face à quelqu’un" },
  { answer: "TERRASSE", clue: "Espace extérieur plat attenant à un bâtiment" },
  { answer: "TRAVERSEE", clue: "Action de passer d’un côté à l’autre" },
  { answer: "TRIANGLE", clue: "Figure géométrique à trois côtés" },
  { answer: "VACANCES", clue: "Période consacrée au repos" },
  { answer: "BOUTEILLE", clue: "Récipient allongé muni d’un goulot" },
  { answer: "CARROUSEL", clue: "Manège tournant ou suite d’images" },
  { answer: "DINOSAURE", clue: "Reptile ayant vécu aux temps préhistoriques" },
  { answer: "ENVELOPPE", clue: "Pochette de papier destinée au courrier" },
  { answer: "SPECTACLE", clue: "Représentation donnée devant un public" },
  { answer: "SYMPHONIE", clue: "Grande composition écrite pour orchestre" },
  { answer: "TELEPHONE", clue: "Appareil permettant de communiquer à distance" },
] as const;


const GENERAL_CROSSWORDS_FROM_ISSUE = 47;
const LARGE_CONNECTED_CROSSWORDS_FROM_ISSUE = 57;
// Keep every published grid stable: the diversified rotation starts with the
// first unpublished issue after the report concerning issues 63 and 65.
const DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE = 66;
const CROSSWORD_EXACT_CONTENT_COOLDOWN = 28;

type DenseCrosswordSquare = readonly [string, string, string, string];

const DENSE_CROSSWORD_SQUARES: readonly DenseCrosswordSquare[] = [
  ["ELLE", "LOUP", "LUNE", "EPEE"],
  ["VOIR", "ONDE", "IDEE", "REEL"],
  ["PERE", "EGAL", "RAIL", "ELLE"],
  ["VRAI", "ROND", "ANGE", "IDEE"],
  ["TARD", "AVEU", "REVE", "DUEL"],
  ["TRUC", "ROSE", "USER", "CERF"],
  ["PART", "AGIR", "RIRE", "TRES"],
  ["CHER", "HOTE", "ETRE", "REEL"],
  ["PAPA", "ABRI", "PRES", "AISE"],
  ["VERS", "EPEE", "RECU", "SEUL"],
  ["FILM", "IDEE", "LEUR", "MERE"],
  ["ARME", "RAIL", "MIEL", "ELLE"],
  ["CAFE", "AOUT", "FUIR", "ETRE"],
  ["PLAN", "LABO", "ABRI", "NOIR"],
  ["PLAN", "LAME", "AMER", "NERF"],
  ["BRAS", "ROUE", "AURA", "SEAU"],
  ["ETAT", "TOUR", "AUBE", "TRES"],
  ["PRET", "RAGE", "EGAL", "TELE"],
  ["CHEF", "HOTE", "ETAT", "FETE"],
  ["SALE", "AVEU", "LEUR", "EURO"],
] as const;

const DENSE_CROSSWORD_CLUES: Readonly<Record<string, string>> = {
  ABRI: "Lieu où l’on peut se protéger",
  AGIR: "Passer à l’action",
  AISE: "État de celui qui se sent bien",
  AMER: "Qui laisse une saveur peu douce",
  ANGE: "Messager ailé des représentations célestes",
  AOUT: "Huitième mois de l’année",
  ARME: "Objet conçu pour combattre",
  AUBE: "Premières lueurs du jour",
  AURA: "Temps du verbe avoir au futur",
  AVEU: "Reconnaissance d’un fait",
  BRAS: "Membre entre l’épaule et la main",
  CAFE: "Boisson obtenue à partir de grains torréfiés",
  CERF: "Grand animal des bois portant des bois",
  CHEF: "Personne qui dirige une équipe",
  CHER: "Dont le prix est élevé",
  DUEL: "Affrontement entre deux adversaires",
  EGAL: "Ni supérieur ni inférieur",
  ELLE: "Pronom personnel féminin",
  EPEE: "Arme blanche à longue lame",
  ETAT: "Situation dans laquelle se trouve quelque chose",
  ETRE: "Verbe essentiel de la langue française",
  EURO: "Monnaie commune à plusieurs pays européens",
  FETE: "Moment organisé pour célébrer",
  FILM: "Œuvre destinée au cinéma",
  FUIR: "S’éloigner rapidement d’un danger",
  HOTE: "Personne qui reçoit ou qui est reçue",
  IDEE: "Représentation née dans l’esprit",
  LABO: "Abrégé d’un lieu d’expérimentation",
  LAME: "Partie tranchante d’un outil",
  LEUR: "Adjectif possessif de la troisième personne du pluriel",
  LOUP: "Canidé sauvage vivant souvent en meute",
  LUNE: "Satellite naturel de la Terre",
  MERE: "Parent qui a donné naissance",
  MIEL: "Douceur fabriquée par les abeilles",
  NERF: "Faisceau qui transmet un message dans le corps",
  NOIR: "Couleur de la nuit sans lumière",
  ONDE: "Vibration qui se propage",
  PAPA: "Mot familier pour désigner un père",
  PART: "Portion d’un ensemble",
  PERE: "Parent masculin",
  PLAN: "Représentation ou projet préparé à l’avance",
  PRES: "À faible distance",
  PRET: "Disposé à commencer",
  RAGE: "Colère très intense",
  RAIL: "Barre métallique guidant un train",
  RECU: "Document attestant un paiement",
  REEL: "Qui existe véritablement",
  REVE: "Histoire produite pendant le sommeil",
  RIRE: "Exprimer sa gaieté par des sons",
  ROND: "Qui a la forme d’un cercle",
  ROSE: "Fleur souvent offerte",
  ROUE: "Pièce circulaire tournant autour d’un axe",
  SALE: "Qui manque de propreté",
  SEAU: "Récipient muni d’une anse",
  SEUL: "Sans compagnie",
  TARD: "Après le moment attendu",
  TELE: "Abrégé courant de télévision",
  TOUR: "Mouvement complet autour d’un axe",
  TRES: "Adverbe qui marque une forte intensité",
  TRUC: "Mot familier pour une chose indéterminée",
  USER: "Détériorer progressivement par le frottement",
  VERS: "Dans la direction de",
  VOIR: "Percevoir avec les yeux",
  VRAI: "Conforme à la réalité",
} as const;

type ConnectedCrosswordTemplate = {
  rows: readonly string[];
};

const CONNECTED_CROSSWORD_TEMPLATES: readonly ConnectedCrosswordTemplate[] = [
  {
    rows: [
      "RIEN#TROP",
      "ELLE##O#R",
      "F#URGENCE",
      "LA#FOND#S",
      "E#D###E#E",
      "C#AUTO#IN",
      "HONNEUR#T",
      "I#S##RATE",
      "REEL#STAR",
    ],
  },
  {
    rows: [
      "A#T#SVP##",
      "CIAO#I#LE",
      "T#PRODUIT",
      "ICI#HE#SE",
      "VASE#ROTI",
      "IN#CA#BEN",
      "TOURNEE#D",
      "EN#A#HIER",
      "##UNI#R#E",
    ],
  },
  {
    rows: [
      "SACRE##LA",
      "AIME#T##U",
      "US#GERANT",
      "V#SI#OSER",
      "ET#S#U#TE",
      "TEST#PA#M",
      "ALARME#CE",
      "G##E#AMEN",
      "EN##OUEST",
    ],
  },
  {
    rows: [
      "MAT#COMA#",
      "#CE#R#AMI",
      "#CALIBRE#",
      "ARME#AIL#",
      "HO#V#T#IN",
      "#CLE#TROU",
      "#HORREUR#",
      "NET#O#DE#",
      "#ROTI#ERE",
    ],
  },
  {
    rows: [
      "C#ET#AMI#",
      "ART##U#LA",
      "REALITE#P",
      "ACTE#OH#P",
      "VU#GYM#PA",
      "A#SE#NIER",
      "N#INSENSE",
      "EN#D##FOI",
      "#ILE#GO#L",
    ],
  },
  {
    rows: [
      "C#EN#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#SE#NIER", "N#INSENSE", "ET#D##FOI", "#ERE#GO#L",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#J###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#T##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "SACRE##TA", "AIME#T##U", "US#GERANT", "V#NI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "C#EN#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#NE#NIER", "N#INSENSE", "ET#D##FOI", "#ERE#HO#L",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#J###E#E",
      "C#AUTO#IN", "HONNEUR#T", "I#T##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "SACRE##LA", "AIME#T##U", "US#GERANT", "V#NI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "RAT#COMA#", "#CE#R#AMI", "#CALIBRE#", "ARME#AIL#", "HO#V#T#IN",
      "#CLE#TROU", "#HORREUR#", "NET#O#DE#", "#ROTI#ERE",
    ],
  },
  {
    rows: [
      "C#EN#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#NE#NIER", "N#INSENSE", "ET#D##FOI", "#ERE#GO#L",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#D###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#S##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "SACRE##TA", "AIME#T##U", "US#GERANT", "V#SI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "C#EN#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#SE#NIER", "N#INSENSE", "ET#D##FOI", "#ERE#GO#L",
    ],
  },
  {
    rows: [
      "SACRE##CA", "AIME#T##U", "US#GERANT", "V#NI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EN##OUEST",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#C###E#E",
      "C#AUTO#IN", "HONNEUR#T", "I#O##RATE", "ROND#STAR",
    ],
  },
  {
    rows: [
      "SACRE##CA", "AIME#T##U", "US#GERANT", "V#SI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LA#FOND#S", "E#J###E#E",
      "C#AUTO#IN", "HONNEUR#T", "I#T##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "SACRE##TA", "AIME#T##U", "US#GERANT", "V#SI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EN##OUEST",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LA#FOND#S", "E#D###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#S##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LA#FOND#S", "E#C###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#O##RATE", "ROND#STAR",
    ],
  },
  {
    rows: [
      "C#ET#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#SE#NIER", "N#INSENSE", "EN#D##FOI", "#ILE#HO#L",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LA#FOND#S", "E#C###E#E",
      "C#AUTO#IN", "HONNEUR#T", "I#O##RATE", "ROND#STAR",
    ],
  },
  {
    rows: [
      "SACRE##TA", "AIME#T##U", "US#GERANT", "V#NI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EN##OUEST",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#C###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#O##RATE", "ROND#STAR",
    ],
  },
  {
    rows: [
      "SACRE##CA", "AIME#T##U", "US#GERANT", "V#NI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "SACRE##CA", "AIME#T##U", "US#GERANT", "V#SI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EN##OUEST",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LA#FOND#S", "E#J###E#E",
      "C#AUTO#AN", "HONNEUR#T", "I#T##RATE", "REEL#STAR",
    ],
  },
  {
    rows: [
      "C#EN#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#SE#NIER", "N#INSENSE", "ET#D##FOI", "#ERE#HO#L",
    ],
  },
  {
    rows: [
      "SACRE##LA", "AIME#T##U", "US#GERANT", "V#SI#OSER", "ET#S#U#TE",
      "TEST#PA#M", "ALARME#CE", "G##E#AMEN", "EH##OUEST",
    ],
  },
  {
    rows: [
      "C#ET#AMI#", "ART##U#LA", "REALITE#P", "ACTE#OH#P", "VU#GYM#PA",
      "A#SE#NIER", "N#INSENSE", "EN#D##FOI", "#ERE#GO#L",
    ],
  },
  {
    rows: [
      "RIEN#TROP", "ELLE##O#R", "F#URGENCE", "LE#FOND#S", "E#D###E#E",
      "C#AUTO#IN", "HONNEUR#T", "I#S##RATE", "REEL#STAR",
    ],
  },
] as const;

const CONNECTED_CROSSWORD_CLUES: Readonly<Record<string, string>> = {
  ACCROCHER: "Fixer solidement ou captiver l’attention",
  ACTE: "Action accomplie",
  ACTIVITE: "Occupation ou ensemble de tâches",
  AH: "Interjection marquant une émotion vive",
  AIL: "Bulbe très parfumé utilisé en cuisine",
  AIME: "Éprouve de l’affection",
  AIS: "Planche de bois",
  ALARME: "Signal qui avertit d’un danger",
  AMELIORER: "Rendre meilleur",
  AMEN: "Mot qui conclut une prière",
  AMI: "Personne avec qui l’on partage une affection",
  AN: "Douze mois",
  APPAREIL: "Machine ou dispositif conçu pour une fonction",
  ART: "Création destinée à exprimer une idée ou une émotion",
  AS: "Champion dans son domaine",
  AUTO: "Abrégé courant d’automobile",
  AUTOMNE: "Saison située entre l’été et l’hiver",
  AUTREMENT: "D’une autre manière",
  BEN: "Interjection familière dans « eh ben »",
  BATTE: "Accessoire utilisé pour frapper une balle",
  CA: "Pronom démonstratif familier",
  CALIBRE: "Diamètre intérieur d’un tube ou format d’une munition",
  CANON: "Pièce d’artillerie ou règle esthétique",
  CARAVANE: "Groupe voyageant ensemble ou habitation mobile",
  CE: "Pronom ou adjectif démonstratif",
  CES: "Adjectif démonstratif au pluriel",
  CIAO: "Salut venu d’Italie",
  CLE: "Elle ouvre une serrure",
  CM: "Abréviation du centimètre",
  COMA: "État prolongé d’inconscience",
  CRI: "Son poussé avec force",
  DANSE: "Art du mouvement rythmé",
  DE: "Préposition marquant notamment l’origine",
  ECRAN: "Surface sur laquelle apparaît une image",
  EH: "Interjection servant à interpeller",
  ELU: "Choisi par un vote",
  EN: "Préposition indiquant notamment un lieu ou un état",
  ETEINDRE: "Faire cesser une lumière ou un feu",
  ET: "Conjonction qui relie deux éléments",
  ERE: "Longue période historique",
  FOND: "Partie la plus basse ou la plus éloignée",
  FOI: "Confiance profonde accordée à une croyance",
  GERANT: "Personne chargée d’administrer une activité",
  GO: "Jeu de stratégie asiatique à pierres noires et blanches",
  GYM: "Abrégé de gymnastique",
  HE: "Interjection pour appeler ou attirer l’attention",
  HIER: "Le jour qui précède aujourd’hui",
  HO: "Interjection employée pour appeler",
  HONNEUR: "Estime accordée au mérite",
  HORREUR: "Sentiment de répulsion ou de peur intense",
  ICI: "Dans le lieu où l’on se trouve",
  IL: "Pronom personnel masculin",
  ILE: "Terre entièrement entourée d’eau",
  IN: "À la mode, en langage familier",
  INFO: "Abrégé courant d’information",
  INSENSE: "Dépourvu de bon sens",
  LE: "Article défini masculin singulier",
  LEGENDE: "Récit transmis mêlant histoire et imaginaire",
  LEVER: "Faire passer d’une position basse à une position haute",
  LISTE: "Suite d’éléments rangés les uns après les autres",
  LA: "Article défini féminin ou note de musique",
  LOTO: "Jeu de hasard avec des numéros",
  MARI: "Époux",
  MAT: "Sans éclat ni brillance",
  ME: "Pronom personnel de la première personne",
  NET: "Clair, précis ou sans saleté",
  NE: "Élément de la négation",
  NI: "Conjonction employée dans une négation",
  NIER: "Refuser de reconnaître comme vrai",
  NU: "Qui n’est pas couvert",
  OBEIR: "Se conformer à un ordre",
  OH: "Interjection marquant la surprise",
  OR: "Métal précieux jaune",
  OSER: "Avoir l’audace de faire quelque chose",
  OUEST: "Point cardinal où le soleil se couche",
  OURS: "Grand mammifère à la fourrure épaisse",
  PA: "Syllabe familière pour désigner le père",
  PESO: "Nom de plusieurs monnaies",
  PRESENTER: "Montrer ou faire connaître",
  PRODUIT: "Résultat d’une fabrication ou d’une multiplication",
  RATE: "Organe situé dans la partie gauche de l’abdomen",
  RAT: "Petit rongeur très répandu",
  REALITE: "Ce qui existe effectivement",
  REFLECHIR: "Examiner une idée avant de décider",
  REGISTRE: "Livre ou support où l’on consigne des informations",
  RIEN: "Absence de toute chose",
  ROI: "Souverain d’un royaume",
  RONDE: "Qui présente une forme circulaire",
  ROTI: "Cuit au four ou à la broche",
  RUDE: "Dur, difficile ou peu doux",
  SACRE: "Consacré ou considéré comme inviolable",
  SA: "Adjectif possessif féminin singulier",
  SAUVETAGE: "Action de tirer quelqu’un d’un danger",
  SE: "Pronom personnel réfléchi",
  SI: "Conjonction exprimant une condition",
  STAR: "Personnalité très célèbre",
  SVP: "Formule abrégée de politesse",
  TA: "Adjectif possessif féminin singulier",
  TAPIS: "Pièce de tissu couvrant une partie du sol",
  TE: "Pronom personnel de la deuxième personne",
  TEAM: "Équipe, en anglais",
  TEL: "Semblable ou de cette nature",
  TEST: "Épreuve destinée à vérifier une capacité",
  TOURNEE: "Série de déplacements ou ensemble de consommations offertes",
  TROP: "En quantité excessive",
  TROU: "Ouverture ou cavité",
  TROUPEAU: "Groupe d’animaux élevés ensemble",
  UN: "Premier nombre entier",
  UNI: "Assemblé ou sans variation de couleur",
  URGENCE: "Situation qui exige une action immédiate",
  US: "Habitudes établies par l’usage",
  VASE: "Récipient décoratif destiné notamment aux fleurs",
  VIDER: "Retirer tout le contenu",
  VU: "Aperçu avec les yeux",
} as const;

const CROSSWORD_CLUES: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [...CYCLING_CROSSWORD_WORDS, ...GENERAL_CROSSWORD_WORDS].map((word) => [
      word.answer,
      word.clue,
    ]),
  ),
  ...DENSE_CROSSWORD_CLUES,
  ...CONNECTED_CROSSWORD_CLUES,
};

const DIFFICULTIES: readonly CyclogazetteGameDifficulty[] = [
  "facile",
  "moyen",
  "difficile",
];

export function getCyclogazetteDailyGames(
  issueNumber: number,
  variationKey?: string,
): CyclogazetteDailyGames {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  const normalizedVariationKey = normalizeVariationKey(variationKey);
  const sudoku = createSudokuPuzzle(normalizedIssueNumber);
  const crossword = createCrosswordPuzzle(
    normalizedIssueNumber,
    normalizedVariationKey,
  );

  return {
    issueNumber: normalizedIssueNumber,
    sudoku: { difficulty: sudoku.difficulty, cells: sudoku.cells },
    crossword: {
      difficulty: crossword.difficulty,
      rows: crossword.rows,
      columns: crossword.columns,
      cells: crossword.cells,
      entries: crossword.entries,
    },
  };
}

export function getCyclogazetteGameSolutions(
  issueNumber: number,
  variationKey?: string,
): CyclogazetteGameSolutions {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  const normalizedVariationKey = normalizeVariationKey(variationKey);
  const sudoku = createSudokuPuzzle(normalizedIssueNumber);
  const crossword = createCrosswordPuzzle(
    normalizedIssueNumber,
    normalizedVariationKey,
  );

  return {
    issueNumber: normalizedIssueNumber,
    sudokuRows: splitRows(sudoku.solution, 9),
    crosswordRows: splitRows(crossword.solution, crossword.columns),
  };
}

export function isCyclogazetteGameAnswerCorrect({
  issueNumber,
  gameType,
  answer,
  variationKey,
}: {
  issueNumber: number;
  gameType: CyclogazetteGameType;
  answer: string;
  variationKey?: string;
}) {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  const normalizedVariationKey = normalizeVariationKey(variationKey);
  if (gameType === "sudoku") {
    return normalizeSudokuAnswer(answer) === createSudokuPuzzle(normalizedIssueNumber).solution;
  }

  return (
    normalizeCrosswordAnswer(answer) ===
    createCrosswordPuzzle(normalizedIssueNumber, normalizedVariationKey).solution
  );
}

export function isCyclogazetteGameType(
  value: string,
): value is CyclogazetteGameType {
  return value === "sudoku" || value === "crossword";
}

function createSudokuPuzzle(issueNumber: number): PrivateSudokuPuzzle {
  const difficulty = getDifficulty(issueNumber, 0);
  const template = SUDOKU_TEMPLATES[difficulty];
  const random = createSeededRandom(issueNumber * 7919 + 104729);
  const digitOrder = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const rowOrder = createSudokuLineOrder(random);
  const columnOrder = createSudokuLineOrder(random);
  const transform = (source: string) => {
    let transformed = "";
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        const value = Number(source[rowOrder[row] * 9 + columnOrder[column]]);
        transformed += value === 0 ? "0" : String(digitOrder[value - 1]);
      }
    }
    return transformed;
  };
  const puzzle = transform(template.puzzle);
  const solution = transform(template.solution);

  return {
    difficulty,
    cells: [...puzzle].map((value) => (value === "0" ? null : Number(value))),
    solution,
  };
}

function createSudokuLineOrder(random: () => number) {
  const bands = shuffle([0, 1, 2], random);
  return bands.flatMap((band) =>
    shuffle([0, 1, 2], random).map((line) => band * 3 + line),
  );
}

function createCrosswordPuzzle(
  issueNumber: number,
  variationKey = "",
): PrivateCrosswordPuzzle {
  const variationSeed = hashVariationKey(variationKey);
  if (issueNumber >= LARGE_CONNECTED_CROSSWORDS_FROM_ISSUE) {
    const { templateIndex, transpose } =
      issueNumber >= DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE
        ? getDiverseConnectedCrosswordSelection(issueNumber)
        : getLegacyConnectedCrosswordSelection(issueNumber);
    return buildConnectedCrosswordPuzzle(
      CONNECTED_CROSSWORD_TEMPLATES[templateIndex],
      getDifficulty(issueNumber, 1),
      transpose,
    );
  }

  const difficulty = getDifficulty(issueNumber, 1);

  if (issueNumber < 45) {
    const targetCount =
      difficulty === "facile" ? 6 : difficulty === "moyen" ? 7 : 8;
    const wordPool = getCrosswordWordPool(issueNumber, variationSeed);
    let best: PlacedCrosswordWord[] = [];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const random = createSeededRandom(
        createCrosswordSeed(
          issueNumber,
          variationSeed,
          attempt * 32452843 + 49999,
        ),
      );
      const candidate = placeCrosswordWords(
        shuffle([...wordPool], random),
        targetCount,
        random,
      );
      if (candidate.length > best.length) best = candidate;
      if (candidate.length >= targetCount) break;
    }

    return buildCrosswordPuzzle(best, difficulty);
  }

  const templateOffset = issueNumber - 45 + variationSeed;
  const template =
    CONNECTED_CROSSWORD_TEMPLATES[
      templateOffset % CONNECTED_CROSSWORD_TEMPLATES.length
    ];
  if (!template) {
    const random = createSeededRandom(
      createCrosswordSeed(issueNumber, variationSeed, 49999),
    );
    const squares = shuffle([...DENSE_CROSSWORD_SQUARES], random).slice(0, 4);
    return buildDenseCrosswordPuzzle(squares, difficulty);
  }

  const transpose =
    Math.floor(templateOffset / CONNECTED_CROSSWORD_TEMPLATES.length) % 2 ===
    1;
  return buildConnectedCrosswordPuzzle(template, difficulty, transpose);
}

type ConnectedCrosswordSelection = {
  templateIndex: number;
  transpose: boolean;
};

const diverseConnectedCrosswordSelections: ConnectedCrosswordSelection[] = [];
const connectedCrosswordAnswerCache = new WeakMap<
  ConnectedCrosswordTemplate,
  ReadonlySet<string>
>();
const connectedCrosswordPatternCache = new WeakMap<
  ConnectedCrosswordTemplate,
  string
>();

function getLegacyConnectedCrosswordSelection(
  issueNumber: number,
): ConnectedCrosswordSelection {
  const sequence = issueNumber - LARGE_CONNECTED_CROSSWORDS_FROM_ISSUE;
  return {
    templateIndex:
      (sequence * 13 + 7) % CONNECTED_CROSSWORD_TEMPLATES.length,
    transpose:
      Math.floor(sequence / CONNECTED_CROSSWORD_TEMPLATES.length) % 2 === 1,
  };
}

function getDiverseConnectedCrosswordSelection(
  issueNumber: number,
): ConnectedCrosswordSelection {
  const targetIndex = issueNumber - DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE;

  while (diverseConnectedCrosswordSelections.length <= targetIndex) {
    const nextIssueNumber =
      DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE +
      diverseConnectedCrosswordSelections.length;
    const history = getConnectedCrosswordSelectionHistory(nextIssueNumber);
    const templateUsage = new Map<number, number>();
    history.forEach(({ templateIndex }) =>
      templateUsage.set(
        templateIndex,
        (templateUsage.get(templateIndex) ?? 0) + 1,
      ),
    );

    const rankedCandidates = CONNECTED_CROSSWORD_TEMPLATES.map(
      (_, templateIndex) => ({
        templateIndex,
        score: getConnectedCrosswordVarietyScore({
          templateIndex,
          issueNumber: nextIssueNumber,
          history,
          usageCount: templateUsage.get(templateIndex) ?? 0,
        }),
      }),
    ).sort((left, right) => compareNumberTuples(left.score, right.score));

    const templateIndex = rankedCandidates[0]?.templateIndex ?? 0;
    diverseConnectedCrosswordSelections.push({
      templateIndex,
      transpose:
        (nextIssueNumber + templateIndex + (templateUsage.get(templateIndex) ?? 0)) %
          2 ===
        1,
    });
  }

  return diverseConnectedCrosswordSelections[targetIndex];
}

function getConnectedCrosswordSelectionHistory(issueNumber: number) {
  const firstIssueNumber = Math.max(
    LARGE_CONNECTED_CROSSWORDS_FROM_ISSUE,
    issueNumber - CROSSWORD_EXACT_CONTENT_COOLDOWN,
  );

  return Array.from(
    { length: issueNumber - firstIssueNumber },
    (_, offset): ConnectedCrosswordSelection => {
      const historyIssueNumber = firstIssueNumber + offset;
      return historyIssueNumber < DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE
        ? getLegacyConnectedCrosswordSelection(historyIssueNumber)
        : diverseConnectedCrosswordSelections[
            historyIssueNumber - DIVERSE_CONNECTED_CROSSWORDS_FROM_ISSUE
          ];
    },
  );
}

function getConnectedCrosswordVarietyScore({
  templateIndex,
  issueNumber,
  history,
  usageCount,
}: {
  templateIndex: number;
  issueNumber: number;
  history: ConnectedCrosswordSelection[];
  usageCount: number;
}) {
  const recentTwo = history.slice(-2);
  const recentEight = history.slice(-8);
  const candidateTemplate = CONNECTED_CROSSWORD_TEMPLATES[templateIndex];
  const candidatePattern = getConnectedCrosswordPattern(candidateTemplate);
  const candidateAnswers = getConnectedCrosswordAnswers(candidateTemplate);
  const hasSamePattern = (selection: ConnectedCrosswordSelection) =>
    getConnectedCrosswordPattern(
      CONNECTED_CROSSWORD_TEMPLATES[selection.templateIndex],
    ) === candidatePattern;
  const answerSimilarity = (selection: ConnectedCrosswordSelection) =>
    getCrosswordAnswerSimilarity(
      candidateAnswers,
      getConnectedCrosswordAnswers(
        CONNECTED_CROSSWORD_TEMPLATES[selection.templateIndex],
      ),
    );

  // Sort priorities are deliberate: never repeat an answer set within a full
  // season, then maximize short-term lexical and visual distance. The last
  // rank only makes ties deterministic, so one issue always keeps one grid.
  return [
    history.some((selection) => answerSimilarity(selection) === 1) ? 1 : 0,
    Math.max(0, ...recentTwo.map(answerSimilarity)),
    recentTwo.some(hasSamePattern) ? 1 : 0,
    recentEight.filter(hasSamePattern).length,
    Math.max(0, ...recentEight.map(answerSimilarity)),
    usageCount,
    getStableCrosswordCandidateRank(issueNumber, templateIndex),
  ];
}

function getConnectedCrosswordPattern(template: ConnectedCrosswordTemplate) {
  const cachedPattern = connectedCrosswordPatternCache.get(template);
  if (cachedPattern) return cachedPattern;

  const directPattern = template.rows
    .map((row) => row.replace(/[A-Z]/g, "."))
    .join("");
  const transposedPattern = transposeCrosswordRows(template.rows)
    .map((row) => row.replace(/[A-Z]/g, "."))
    .join("");
  const pattern =
    directPattern < transposedPattern ? directPattern : transposedPattern;
  connectedCrosswordPatternCache.set(template, pattern);
  return pattern;
}

function getConnectedCrosswordAnswers(template: ConnectedCrosswordTemplate) {
  const cachedAnswers = connectedCrosswordAnswerCache.get(template);
  if (cachedAnswers) return cachedAnswers;

  const answers = new Set<string>();

  for (const direction of ["horizontal", "vertical"] as const) {
    const fixedLimit =
      direction === "horizontal" ? template.rows.length : template.rows[0].length;
    const movingLimit =
      direction === "horizontal" ? template.rows[0].length : template.rows.length;
    for (let fixed = 0; fixed < fixedLimit; fixed += 1) {
      let moving = 0;
      while (moving < movingLimit) {
        while (
          moving < movingLimit &&
          readCrosswordCell(template.rows, direction, fixed, moving) === "#"
        ) {
          moving += 1;
        }
        const start = moving;
        while (
          moving < movingLimit &&
          readCrosswordCell(template.rows, direction, fixed, moving) !== "#"
        ) {
          moving += 1;
        }
        if (moving - start < 2) continue;
        answers.add(
          Array.from(
            { length: moving - start },
            (_, index) =>
              readCrosswordCell(
                template.rows,
                direction,
                fixed,
                start + index,
              ),
          ).join(""),
        );
      }
    }
  }

  connectedCrosswordAnswerCache.set(template, answers);
  return answers;
}

function getCrosswordAnswerSimilarity(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
) {
  let intersectionSize = 0;
  left.forEach((answer) => {
    if (right.has(answer)) intersectionSize += 1;
  });
  return intersectionSize / (left.size + right.size - intersectionSize);
}

function getStableCrosswordCandidateRank(
  issueNumber: number,
  templateIndex: number,
) {
  return (
    Math.imul(issueNumber + 1, 1_103_515_245) ^
    Math.imul(templateIndex + 1, 12_345)
  ) >>> 0;
}

function compareNumberTuples(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function buildDenseCrosswordPuzzle(
  squares: DenseCrosswordSquare[],
  difficulty: CyclogazetteGameDifficulty,
): PrivateCrosswordPuzzle {
  const rows = 9;
  const columns = 9;
  const letters = Array<string>(rows * columns).fill("#");
  const placements: PlacedCrosswordWord[] = [];

  squares.forEach((square, squareIndex) => {
    const rowOffset = squareIndex >= 2 ? 5 : 0;
    const columnOffset = squareIndex % 2 === 1 ? 5 : 0;

    square.forEach((answer, wordIndex) => {
      const clue = DENSE_CROSSWORD_CLUES[answer];
      if (!clue) throw new Error(`Définition manquante pour ${answer}.`);

      placements.push({
        answer,
        clue,
        row: rowOffset + wordIndex,
        column: columnOffset,
        direction: "horizontal",
      });
      placements.push({
        answer,
        clue,
        row: rowOffset,
        column: columnOffset + wordIndex,
        direction: "vertical",
      });

      for (let letterIndex = 0; letterIndex < answer.length; letterIndex += 1) {
        letters[(rowOffset + wordIndex) * columns + columnOffset + letterIndex] =
          answer[letterIndex];
      }
    });
  });

  const numberByStart = new Map<string, number>();
  const starts = [
    ...new Set(placements.map((word) => `${word.row}:${word.column}`)),
  ]
    .map((key) => {
      const [row, column] = key.split(":").map(Number);
      return { key, row, column };
    })
    .sort((left, right) => left.row - right.row || left.column - right.column);
  starts.forEach((start, index) => numberByStart.set(start.key, index + 1));

  const cells = letters.flatMap<CyclogazetteCrosswordCell>((letter, index) => {
    if (letter === "#") return [];
    const row = Math.floor(index / columns);
    const column = index % columns;
    return [
      {
        index,
        row,
        column,
        number: numberByStart.get(`${row}:${column}`) ?? null,
      },
    ];
  });
  const entries = placements
    .map<CyclogazetteCrosswordEntry>((word) => ({
      number: numberByStart.get(`${word.row}:${word.column}`) ?? 0,
      direction: word.direction,
      row: word.row,
      column: word.column,
      length: word.answer.length,
      clue: word.clue,
    }))
    .sort(
      (left, right) =>
        left.number - right.number ||
        Number(left.direction === "vertical") -
          Number(right.direction === "vertical"),
    );

  return {
    difficulty,
    rows,
    columns,
    cells,
    entries,
    solution: letters.join(""),
  };
}

function buildConnectedCrosswordPuzzle(
  template: ConnectedCrosswordTemplate,
  difficulty: CyclogazetteGameDifficulty,
  transpose: boolean,
): PrivateCrosswordPuzzle {
  const sourceRows = transpose
    ? transposeCrosswordRows(template.rows)
    : [...template.rows];
  const rows = sourceRows.length;
  const columns = sourceRows[0]?.length ?? 0;
  const placements: PlacedCrosswordWord[] = [];

  for (const direction of ["horizontal", "vertical"] as const) {
    const fixedLimit = direction === "horizontal" ? rows : columns;
    const movingLimit = direction === "horizontal" ? columns : rows;
    for (let fixed = 0; fixed < fixedLimit; fixed += 1) {
      let moving = 0;
      while (moving < movingLimit) {
        while (
          moving < movingLimit &&
          readCrosswordCell(sourceRows, direction, fixed, moving) === "#"
        ) {
          moving += 1;
        }
        const start = moving;
        while (
          moving < movingLimit &&
          readCrosswordCell(sourceRows, direction, fixed, moving) !== "#"
        ) {
          moving += 1;
        }
        if (moving - start < 2) continue;

        const answer = Array.from(
          { length: moving - start },
          (_, index) =>
            readCrosswordCell(sourceRows, direction, fixed, start + index),
        ).join("");
        const clue = CROSSWORD_CLUES[answer];
        if (!clue) throw new Error(`Définition manquante pour ${answer}.`);
        placements.push({
          answer,
          clue,
          row: direction === "horizontal" ? fixed : start,
          column: direction === "horizontal" ? start : fixed,
          direction,
        });
      }
    }
  }

  const numberByStart = new Map<string, number>();
  const starts = [
    ...new Set(placements.map((word) => `${word.row}:${word.column}`)),
  ]
    .map((key) => {
      const [row, column] = key.split(":").map(Number);
      return { key, row, column };
    })
    .sort((left, right) => left.row - right.row || left.column - right.column);
  starts.forEach((start, index) => numberByStart.set(start.key, index + 1));

  const cells = sourceRows.flatMap<CyclogazetteCrosswordCell>(
    (rowValue, row) =>
      [...rowValue].flatMap((letter, column) => {
        if (letter === "#") return [];
        return [
          {
            index: row * columns + column,
            row,
            column,
            number: numberByStart.get(`${row}:${column}`) ?? null,
          },
        ];
      }),
  );
  const entries = placements
    .map<CyclogazetteCrosswordEntry>((word) => ({
      number: numberByStart.get(`${word.row}:${word.column}`) ?? 0,
      direction: word.direction,
      row: word.row,
      column: word.column,
      length: word.answer.length,
      clue: word.clue,
    }))
    .sort(
      (left, right) =>
        left.number - right.number ||
        left.row - right.row ||
        left.column - right.column,
    );

  return {
    difficulty,
    rows,
    columns,
    cells,
    entries,
    solution: sourceRows.join(""),
  };
}

function transposeCrosswordRows(rows: readonly string[]) {
  return Array.from({ length: rows[0]?.length ?? 0 }, (_, column) =>
    rows.map((row) => row[column]).join(""),
  );
}

function readCrosswordCell(
  rows: readonly string[],
  direction: "horizontal" | "vertical",
  fixed: number,
  moving: number,
) {
  return direction === "horizontal"
    ? rows[fixed][moving]
    : rows[moving][fixed];
}

function getCrosswordWordPool(issueNumber: number, variationSeed = 0) {
  if (issueNumber < GENERAL_CROSSWORDS_FROM_ISSUE) {
    return CYCLING_CROSSWORD_WORDS;
  }

  const cyclingOffset =
    (issueNumber + variationSeed) % CYCLING_CROSSWORD_WORDS.length;
  const cyclingTouches = Array.from({ length: 8 }, (_, index) =>
    CYCLING_CROSSWORD_WORDS[
      (cyclingOffset + index * 5) % CYCLING_CROSSWORD_WORDS.length
    ],
  );

  return [...GENERAL_CROSSWORD_WORDS, ...cyclingTouches];
}

function placeCrosswordWords(
  words: CrosswordWord[],
  targetCount: number,
  random: () => number,
) {
  const size = 15;
  const grid = Array.from({ length: size }, () =>
    Array<CrosswordGridCell | null>(size).fill(null),
  );
  const first = words.shift();
  if (!first) return [];

  const placed: PlacedCrosswordWord[] = [];
  const firstPlacement: PlacedCrosswordWord = {
    ...first,
    row: Math.floor(size / 2),
    column: Math.floor((size - first.answer.length) / 2),
    direction: "horizontal",
  };
  writeCrosswordWord(grid, firstPlacement);
  placed.push(firstPlacement);

  let madeProgress = true;
  while (placed.length < targetCount && madeProgress) {
    madeProgress = false;
    for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
      const word = words[wordIndex];
      const placements = findCrosswordPlacements(grid, word, random);
      const selected = placements[0];
      if (!selected) continue;

      writeCrosswordWord(grid, selected);
      placed.push(selected);
      words.splice(wordIndex, 1);
      wordIndex -= 1;
      madeProgress = true;
      if (placed.length >= targetCount) break;
    }
  }

  return placed;
}

function findCrosswordPlacements(
  grid: Array<Array<CrosswordGridCell | null>>,
  word: CrosswordWord,
  random: () => number,
) {
  const placements: Array<PlacedCrosswordWord & { score: number }> = [];
  const size = grid.length;

  for (let letterIndex = 0; letterIndex < word.answer.length; letterIndex += 1) {
    const letter = word.answer[letterIndex];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const existing = grid[row][column];
        if (!existing || existing.letter !== letter) continue;

        for (const direction of ["horizontal", "vertical"] as const) {
          if (existing.directions.has(direction)) continue;
          const startRow = direction === "vertical" ? row - letterIndex : row;
          const startColumn =
            direction === "horizontal" ? column - letterIndex : column;
          const validation = validateCrosswordPlacement(
            grid,
            word.answer,
            startRow,
            startColumn,
            direction,
          );
          if (!validation.valid) continue;

          const centerDistance =
            Math.abs(startRow - size / 2) + Math.abs(startColumn - size / 2);
          placements.push({
            ...word,
            row: startRow,
            column: startColumn,
            direction,
            score: validation.crossings * 100 - centerDistance + random(),
          });
        }
      }
    }
  }

  return placements
    .sort((left, right) => right.score - left.score)
    .map((placement) => ({
      answer: placement.answer,
      clue: placement.clue,
      row: placement.row,
      column: placement.column,
      direction: placement.direction,
    }));
}

function validateCrosswordPlacement(
  grid: Array<Array<CrosswordGridCell | null>>,
  answer: string,
  row: number,
  column: number,
  direction: "horizontal" | "vertical",
) {
  const size = grid.length;
  const endRow = row + (direction === "vertical" ? answer.length - 1 : 0);
  const endColumn =
    column + (direction === "horizontal" ? answer.length - 1 : 0);
  if (row < 0 || column < 0 || endRow >= size || endColumn >= size) {
    return { valid: false, crossings: 0 };
  }

  const beforeRow = row - (direction === "vertical" ? 1 : 0);
  const beforeColumn = column - (direction === "horizontal" ? 1 : 0);
  const afterRow = endRow + (direction === "vertical" ? 1 : 0);
  const afterColumn = endColumn + (direction === "horizontal" ? 1 : 0);
  if (
    isOccupied(grid, beforeRow, beforeColumn) ||
    isOccupied(grid, afterRow, afterColumn)
  ) {
    return { valid: false, crossings: 0 };
  }

  let crossings = 0;
  for (let index = 0; index < answer.length; index += 1) {
    const currentRow = row + (direction === "vertical" ? index : 0);
    const currentColumn = column + (direction === "horizontal" ? index : 0);
    const existing = grid[currentRow][currentColumn];
    if (existing) {
      if (
        existing.letter !== answer[index] ||
        existing.directions.has(direction)
      ) {
        return { valid: false, crossings: 0 };
      }
      crossings += 1;
      continue;
    }

    const perpendicularNeighbours =
      direction === "horizontal"
        ? [
            [currentRow - 1, currentColumn],
            [currentRow + 1, currentColumn],
          ]
        : [
            [currentRow, currentColumn - 1],
            [currentRow, currentColumn + 1],
          ];
    if (
      perpendicularNeighbours.some(([nearRow, nearColumn]) =>
        isOccupied(grid, nearRow, nearColumn),
      )
    ) {
      return { valid: false, crossings: 0 };
    }
  }

  return { valid: crossings > 0, crossings };
}

function writeCrosswordWord(
  grid: Array<Array<CrosswordGridCell | null>>,
  placement: PlacedCrosswordWord,
) {
  for (let index = 0; index < placement.answer.length; index += 1) {
    const row =
      placement.row + (placement.direction === "vertical" ? index : 0);
    const column =
      placement.column + (placement.direction === "horizontal" ? index : 0);
    const existing = grid[row][column];
    if (existing) {
      existing.directions.add(placement.direction);
    } else {
      grid[row][column] = {
        letter: placement.answer[index],
        directions: new Set([placement.direction]),
      };
    }
  }
}

function buildCrosswordPuzzle(
  placed: PlacedCrosswordWord[],
  difficulty: CyclogazetteGameDifficulty,
): PrivateCrosswordPuzzle {
  const minRow = Math.min(...placed.map((word) => word.row));
  const minColumn = Math.min(...placed.map((word) => word.column));
  const maxRow = Math.max(
    ...placed.map(
      (word) =>
        word.row + (word.direction === "vertical" ? word.answer.length - 1 : 0),
    ),
  );
  const maxColumn = Math.max(
    ...placed.map(
      (word) =>
        word.column +
        (word.direction === "horizontal" ? word.answer.length - 1 : 0),
    ),
  );
  const rows = maxRow - minRow + 1;
  const columns = maxColumn - minColumn + 1;
  const normalized = placed.map((word) => ({
    ...word,
    row: word.row - minRow,
    column: word.column - minColumn,
  }));
  const numberByStart = new Map<string, number>();
  const starts = [...new Set(normalized.map((word) => `${word.row}:${word.column}`))]
    .map((key) => {
      const [row, column] = key.split(":").map(Number);
      return { key, row, column };
    })
    .sort((left, right) => left.row - right.row || left.column - right.column);
  starts.forEach((start, index) => numberByStart.set(start.key, index + 1));

  const letters = Array<string>(rows * columns).fill("#");
  for (const word of normalized) {
    for (let index = 0; index < word.answer.length; index += 1) {
      const row = word.row + (word.direction === "vertical" ? index : 0);
      const column =
        word.column + (word.direction === "horizontal" ? index : 0);
      letters[row * columns + column] = word.answer[index];
    }
  }

  const cells = letters.flatMap<CyclogazetteCrosswordCell>((letter, index) => {
    if (letter === "#") return [];
    const row = Math.floor(index / columns);
    const column = index % columns;
    return [
      {
        index,
        row,
        column,
        number: numberByStart.get(`${row}:${column}`) ?? null,
      },
    ];
  });
  const entries = normalized
    .map<CyclogazetteCrosswordEntry>((word) => ({
      number: numberByStart.get(`${word.row}:${word.column}`) ?? 0,
      direction: word.direction,
      row: word.row,
      column: word.column,
      length: word.answer.length,
      clue: word.clue,
    }))
    .sort(
      (left, right) =>
        left.number - right.number ||
        Number(left.direction === "vertical") -
          Number(right.direction === "vertical"),
    );

  return {
    difficulty,
    rows,
    columns,
    cells,
    entries,
    solution: letters.join(""),
  };
}

function getDifficulty(issueNumber: number, offset: number) {
  return DIFFICULTIES[(issueNumber - 1 + offset) % DIFFICULTIES.length];
}

function normalizeIssueNumber(value: number) {
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function normalizeVariationKey(value: string | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function hashVariationKey(value: string) {
  if (!value) return 0;

  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function createCrosswordSeed(
  issueNumber: number,
  variationSeed: number,
  salt: number,
) {
  if (variationSeed === 0) {
    return issueNumber * 15485863 + salt;
  }

  return (
    Math.imul(issueNumber, 15485863) +
    Math.imul(variationSeed, 2654435761) +
    salt
  );
}

function normalizeSudokuAnswer(value: string) {
  return value.replace(/[^1-9]/g, "");
}

function normalizeCrosswordAnswer(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z#]/g, "");
}

function splitRows(value: string, columns: number) {
  return Array.from(
    { length: Math.ceil(value.length / columns) },
    (_, index) => value.slice(index * columns, (index + 1) * columns),
  );
}

function isOccupied(
  grid: Array<Array<CrosswordGridCell | null>>,
  row: number,
  column: number,
) {
  return Boolean(grid[row]?.[column]);
}

function shuffle<T>(values: T[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [values[index], values[nextIndex]] = [values[nextIndex], values[index]];
  }
  return values;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let current = value;
    current = Math.imul(current ^ (current >>> 15), current | 1);
    current ^= current + Math.imul(current ^ (current >>> 7), current | 61);
    return ((current ^ (current >>> 14)) >>> 0) / 4294967296;
  };
}
