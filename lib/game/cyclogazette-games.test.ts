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

  it("keeps one stable crossword per issue even if the edition identifier changes", () => {
    const issueNumber = 84;
    const editionKey = "edition-a";
    const rerollKey = "edition-b";
    const first = getCyclogazetteDailyGames(issueNumber, editionKey);
    const same = getCyclogazetteDailyGames(issueNumber, editionKey);
    const rerolled = getCyclogazetteDailyGames(issueNumber, rerollKey);
    const firstSolution = getCyclogazetteGameSolutions(issueNumber, editionKey);
    const rerolledSolution = getCyclogazetteGameSolutions(issueNumber, rerollKey);

    expect(first).toEqual(same);
    expect(first.crossword).toEqual(rerolled.crossword);
    expect(firstSolution.crosswordRows).toEqual(
      rerolledSolution.crosswordRows,
    );
    expect(
      isCyclogazetteGameAnswerCorrect({
        issueNumber,
        gameType: "crossword",
        answer: rerolledSolution.crosswordRows.join(""),
        variationKey: rerollKey,
      }),
    ).toBe(true);
    expect(
      isCyclogazetteGameAnswerCorrect({
        issueNumber,
        gameType: "crossword",
        answer: firstSolution.crosswordRows.join(""),
        variationKey: rerollKey,
      }),
    ).toBe(true);
  });

  it("préserve les numéros publiés puis écarte les quasi-doublons récents", () => {
    expect(getCyclogazetteGameSolutions(65).crosswordRows).toEqual([
      "RIEN#TROP",
      "ELLE##O#R",
      "F#URGENCE",
      "LE#FOND#S",
      "E#J###E#E",
      "C#AUTO#IN",
      "HONNEUR#T",
      "I#T##RATE",
      "REEL#STAR",
    ]);

    const recentAnswerSets: Set<string>[] = [];
    const recentAnswerSignatures: string[] = [];

    for (let issueNumber = 64; issueNumber <= 180; issueNumber += 1) {
      const answers = getCrosswordAnswers(issueNumber);
      const answerSignature = [...answers].sort().join("|");

      if (issueNumber >= 66) {
        for (const recentAnswers of recentAnswerSets.slice(-2)) {
          expect(getAnswerSetSimilarity(answers, recentAnswers)).toBeLessThan(
            0.8,
          );
        }
        expect(recentAnswerSignatures.slice(-28)).not.toContain(
          answerSignature,
        );
      }

      recentAnswerSets.push(answers);
      recentAnswerSignatures.push(answerSignature);
    }
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

      const numberByStart = new Map<string, number>();
      for (const entry of crossword.entries) {
        const start = `${entry.row}:${entry.column}`;
        const existingNumber = numberByStart.get(start);
        if (existingNumber !== undefined) {
          expect(entry.number).toBe(existingNumber);
        } else {
          expect([...numberByStart.values()]).not.toContain(entry.number);
          numberByStart.set(start, entry.number);
        }
      }
    }
  });

  it("sert à partir de la saison 3 une grande grille unique aux mots de tailles variées", () => {
    const signatures = new Set<string>();

    for (let issueNumber = 57; issueNumber <= 256; issueNumber += 1) {
      const crossword = getCyclogazetteDailyGames(issueNumber).crossword;
      const solutionRows =
        getCyclogazetteGameSolutions(issueNumber).crosswordRows;

      expect(crossword.rows).toBe(9);
      expect(crossword.columns).toBe(9);
      expect(crossword.cells.length).toBeGreaterThanOrEqual(60);
      expect(crossword.entries.length).toBeGreaterThanOrEqual(26);
      expect(
        new Set(crossword.entries.map((entry) => entry.length)).size,
      ).toBeGreaterThanOrEqual(5);
      expect(solutionRows.join("")).toContain("#");
      expect(
        solutionRows.every(
          (row) => row !== "#".repeat(crossword.columns),
        ),
      ).toBe(true);
      expect(isConnectedCrossword(solutionRows)).toBe(true);

      const numberedStarts = new Set(
        crossword.entries.map(
          (entry) => `${entry.number}:${entry.row}:${entry.column}`,
        ),
      );
      expect(numberedStarts.size).toBeGreaterThanOrEqual(20);

      signatures.add(solutionRows.join(""));
    }

    expect(signatures.size).toBeGreaterThanOrEqual(60);
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

function getCrosswordAnswers(issueNumber: number) {
  const crossword = getCyclogazetteDailyGames(issueNumber).crossword;
  const rows = getCyclogazetteGameSolutions(issueNumber).crosswordRows;

  return new Set(
    crossword.entries.map((entry) =>
      Array.from({ length: entry.length }, (_, index) => {
        const row =
          entry.row + (entry.direction === "vertical" ? index : 0);
        const column =
          entry.column + (entry.direction === "horizontal" ? index : 0);
        return rows[row][column];
      }).join(""),
    ),
  );
}

function getAnswerSetSimilarity(left: Set<string>, right: Set<string>) {
  const intersectionSize = [...left].filter((answer) =>
    right.has(answer),
  ).length;
  return intersectionSize / (left.size + right.size - intersectionSize);
}
