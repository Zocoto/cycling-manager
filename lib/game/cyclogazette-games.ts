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

const CROSSWORD_WORDS: readonly CrosswordWord[] = [
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

const DIFFICULTIES: readonly CyclogazetteGameDifficulty[] = [
  "facile",
  "moyen",
  "difficile",
];

export function getCyclogazetteDailyGames(
  issueNumber: number,
): CyclogazetteDailyGames {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  const sudoku = createSudokuPuzzle(normalizedIssueNumber);
  const crossword = createCrosswordPuzzle(normalizedIssueNumber);

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
): CyclogazetteGameSolutions {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  const sudoku = createSudokuPuzzle(normalizedIssueNumber);
  const crossword = createCrosswordPuzzle(normalizedIssueNumber);

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
}: {
  issueNumber: number;
  gameType: CyclogazetteGameType;
  answer: string;
}) {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  if (gameType === "sudoku") {
    return normalizeSudokuAnswer(answer) === createSudokuPuzzle(normalizedIssueNumber).solution;
  }

  return (
    normalizeCrosswordAnswer(answer) ===
    createCrosswordPuzzle(normalizedIssueNumber).solution
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

function createCrosswordPuzzle(issueNumber: number): PrivateCrosswordPuzzle {
  const difficulty = getDifficulty(issueNumber, 1);
  const targetCount = difficulty === "facile" ? 6 : difficulty === "moyen" ? 7 : 8;
  let best: PlacedCrosswordWord[] = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const random = createSeededRandom(
      issueNumber * 15485863 + attempt * 32452843 + 49999,
    );
    const candidate = placeCrosswordWords(
      shuffle([...CROSSWORD_WORDS], random),
      targetCount,
      random,
    );
    if (candidate.length > best.length) best = candidate;
    if (candidate.length >= targetCount) break;
  }

  return buildCrosswordPuzzle(best, difficulty);
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
