import { describe, expect, it } from "vitest";

import {
  getCyclogazetteDailyGames,
  getCyclogazetteGameSolutions,
  isCyclogazetteGameAnswerCorrect,
} from "@/lib/game/cyclogazette-games";

describe("Cyclogazette daily games", () => {
  it("builds deterministic and rotating Sudoku grids with server-verifiable solutions", () => {
    const first = getCyclogazetteDailyGames(1);
    const same = getCyclogazetteDailyGames(1);
    const next = getCyclogazetteDailyGames(2);

    expect(first).toEqual(same);
    expect(first.sudoku.cells).toHaveLength(81);
    expect(first.sudoku.cells).not.toEqual(next.sudoku.cells);
    expect(first.sudoku.difficulty).not.toBe(next.sudoku.difficulty);

    for (let issueNumber = 1; issueNumber <= 84; issueNumber += 1) {
      const games = getCyclogazetteDailyGames(issueNumber);
      const solution = getCyclogazetteGameSolutions(issueNumber);
      expect(
        isCyclogazetteGameAnswerCorrect({
          issueNumber,
          gameType: "sudoku",
          answer: solution.sudokuRows.join(""),
        }),
      ).toBe(true);
      expect(games.sudoku.cells.filter(Boolean).length).toBeGreaterThanOrEqual(20);
    }
  });

  it("creates connected crossword grids that vary every day and validate exactly", () => {
    const signatures = new Set<string>();

    for (let issueNumber = 1; issueNumber <= 84; issueNumber += 1) {
      const games = getCyclogazetteDailyGames(issueNumber);
      const solution = getCyclogazetteGameSolutions(issueNumber);
      const crossword = games.crossword;
      const answer = solution.crosswordRows.join("");

      expect(crossword.entries.length).toBeGreaterThanOrEqual(6);
      expect(crossword.cells.length).toBeGreaterThan(20);
      expect(answer).toHaveLength(crossword.rows * crossword.columns);
      expect(
        isCyclogazetteGameAnswerCorrect({
          issueNumber,
          gameType: "crossword",
          answer,
        }),
      ).toBe(true);
      expect(
        isCyclogazetteGameAnswerCorrect({
          issueNumber,
          gameType: "crossword",
          answer: answer.replace(/[A-Z]/, "X"),
        }),
      ).toBe(false);
      signatures.add(answer);
    }

    expect(signatures.size).toBeGreaterThanOrEqual(50);
  });

  it("accepte indifféremment les lettres accentuées ou non", () => {
    const issueNumber = Array.from({ length: 84 }, (_, index) => index + 1).find(
      (candidate) =>
        getCyclogazetteGameSolutions(candidate)
          .crosswordRows.join("")
          .includes("E"),
    );
    expect(issueNumber).toBeDefined();

    const answer = getCyclogazetteGameSolutions(issueNumber ?? 1)
      .crosswordRows.join("")
      .replace("E", "É");

    expect(
      isCyclogazetteGameAnswerCorrect({
        issueNumber: issueNumber ?? 1,
        gameType: "crossword",
        answer,
      }),
    ).toBe(true);
  });

  it("propose dès le numéro 45 une seule grille carrée, dense et connectée", () => {
    for (let issueNumber = 45; issueNumber <= 54; issueNumber += 1) {
      const crossword = getCyclogazetteDailyGames(issueNumber).crossword;
      const solutionRows =
        getCyclogazetteGameSolutions(issueNumber).crosswordRows;

      expect(crossword.rows).toBe(9);
      expect(crossword.columns).toBe(9);
      expect(crossword.cells.length).toBeGreaterThanOrEqual(60);
      expect(crossword.entries.length).toBeGreaterThanOrEqual(26);
      expect(crossword.entries.length).toBeLessThanOrEqual(29);
      expect(solutionRows).toHaveLength(9);
      expect(solutionRows.every((row) => row !== "#########")).toBe(true);
      expect(isConnectedCrossword(solutionRows)).toBe(true);

      for (const direction of ["horizontal", "vertical"] as const) {
        const lineNumbers = new Set(
          crossword.entries
            .filter((entry) => entry.direction === direction)
            .map((entry) => entry.number),
        );
        expect(lineNumbers.size).toBeLessThanOrEqual(9);
      }
    }
  });

  it("renouvelle fortement le vocabulaire à partir de la saison 3", () => {
    const answersByIssue = new Map<number, Set<string>>();
    const vocabulary = new Set<string>();

    for (let issueNumber = 57; issueNumber <= 140; issueNumber += 1) {
      const crossword = getCyclogazetteDailyGames(issueNumber).crossword;
      const solutionRows =
        getCyclogazetteGameSolutions(issueNumber).crosswordRows;
      const answers = extractCrosswordAnswers(crossword, solutionRows);

      expect(crossword.entries.length).toBeGreaterThanOrEqual(15);
      expect(crossword.entries.length).toBeLessThanOrEqual(17);
      expect(answers.size).toBe(crossword.entries.length);
      expect(isConnectedCrossword(solutionRows)).toBe(true);

      for (let previousIssue = issueNumber - 9; previousIssue < issueNumber; previousIssue += 1) {
        const previousAnswers = answersByIssue.get(previousIssue);
        if (!previousAnswers) continue;
        expect([...answers].filter((answer) => previousAnswers.has(answer))).toEqual(
          [],
        );
      }

      answers.forEach((answer) => vocabulary.add(answer));
      answersByIssue.set(issueNumber, answers);
    }

    expect(vocabulary.size).toBeGreaterThanOrEqual(300);
  });
});

function isConnectedCrossword(rows: string[]) {
  const firstIndex = rows.join("").search(/[A-Z]/);
  if (firstIndex < 0) return false;
  const columns = rows[0]?.length ?? 0;
  const seen = new Set<number>();
  const queue = [firstIndex];

  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined || seen.has(index)) continue;
    const row = Math.floor(index / columns);
    const column = index % columns;
    if (rows[row]?.[column] === "#") continue;
    seen.add(index);
    if (row > 0) queue.push(index - columns);
    if (row < rows.length - 1) queue.push(index + columns);
    if (column > 0) queue.push(index - 1);
    if (column < columns - 1) queue.push(index + 1);
  }

  return seen.size === rows.join("").replaceAll("#", "").length;
}

function extractCrosswordAnswers(
  crossword: ReturnType<typeof getCyclogazetteDailyGames>["crossword"],
  solutionRows: string[],
) {
  return new Set(
    crossword.entries.map((entry) =>
      Array.from({ length: entry.length }, (_, index) =>
        entry.direction === "horizontal"
          ? solutionRows[entry.row][entry.column + index]
          : solutionRows[entry.row + index][entry.column],
      ).join(""),
    ),
  );
}
