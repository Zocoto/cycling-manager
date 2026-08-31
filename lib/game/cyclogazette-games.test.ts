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

    expect(signatures.size).toBeGreaterThanOrEqual(70);
  });

  it("propose dès le numéro 45 une vraie grille carrée, dense et généraliste", () => {
    const current = getCyclogazetteDailyGames(45).crossword;
    const currentSolution = getCyclogazetteGameSolutions(45).crosswordRows;
    const generalClues = Array.from({ length: 12 }, (_, offset) =>
      getCyclogazetteDailyGames(45 + offset).crossword.entries.map(
        (entry) => entry.clue,
      ),
    ).flat();

    expect(current.rows).toBe(9);
    expect(current.columns).toBe(9);
    expect(current.cells).toHaveLength(64);
    expect(current.entries).toHaveLength(32);
    expect(currentSolution).toHaveLength(9);
    expect(currentSolution[4]).toBe("#########");
    expect(
      generalClues.some((clue) =>
        [
          "Satellite naturel de la Terre",
          "Œuvre destinée au cinéma",
          "Boisson obtenue à partir de grains torréfiés",
          "Premières lueurs du jour",
        ].includes(clue),
      ),
    ).toBe(true);
  });
});
