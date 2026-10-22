import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import bank from "./cyclogazette-crossword-bank.json";
import baseline from "./fixtures/cyclogazette-crossword-legacy.json";
import { getCyclogazetteDailyGames, getCyclogazetteGameSolutions, isCyclogazetteGameAnswerCorrect } from "./cyclogazette-games";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mask = (rows: readonly string[]) => rows.join("").replace(/[A-Z]/g, ".");
const words = (rows: readonly string[]) => [...rows, ...Array.from({length:9}, (_, column) => rows.map(row => row[column]).join(""))].flatMap(line => line.split("#").filter(word => word.length >= 2));

describe("expanded Cyclogazette crossword vocabulary", () => {
  it("freezes the new content epoch: append a future bank rather than rerolling published games", () => {
    expect(hash(bank)).toBe("732b5f74aa2a436620ee3bb9c17d3ec0bb3d70471994756c8e234b43265d170d");
  });
  it("preserves every published grid, clue, answer and Sudoku, including edition-specific legacy games", () => {
    expect(bank.firstIssue).toBe(baseline.publishedThrough + 1);
    for (const [key, expected] of Object.entries(baseline.published)) {
      for (let issue=1; issue<=baseline.publishedThrough; issue++) {
        expect(hash([getCyclogazetteDailyGames(issue,key),getCyclogazetteGameSolutions(issue,key)]), `issue ${issue}, key ${key}`).toBe(expected[issue-1]);
      }
    }
  });

  it("keeps the exact daily cell mask, dimensions, numbering, directions and word lengths for 1,000 issues", () => {
    baseline.layouts.forEach((expected,index) => {
      const issue=baseline.layoutFromIssue+index;
      const puzzle=getCyclogazetteDailyGames(issue).crossword;
      expect(hash({rows:puzzle.rows,columns:puzzle.columns,cells:puzzle.cells,entries:puzzle.entries.map(entry=>({number:entry.number,direction:entry.direction,row:entry.row,column:entry.column,length:entry.length}))}), `layout issue ${issue}`).toBe(expected);
    });
  });

  it("provides a much larger usable bank, with at least a season of distinct fillings for every original mask", () => {
    expect(bank.templates.length).toBeGreaterThanOrEqual(320);
    const pools=new Map<string,number>();const used=new Set<string>();const signatures=new Set<string>();
    const clues: Readonly<Record<string,string>>=bank.clues;
    for(const template of bank.templates) {
      expect(template.rows).toHaveLength(9);
      expect(template.rows.every(row=>/^[A-Z#]{9}$/.test(row))).toBe(true);
      pools.set(mask(template.rows),(pools.get(mask(template.rows))??0)+1);
      const answers=words(template.rows);
      expect(answers.length).toBeGreaterThanOrEqual(26);
      expect(answers.length).toBeLessThanOrEqual(29);
      expect(new Set(answers).size).toBe(answers.length);
      for(const answer of answers) {
        expect(clues[answer]?.length,answer).toBeGreaterThanOrEqual(3);
        used.add(answer);
      }
      signatures.add(template.rows.join(""));
    }
    expect(pools.size).toBe(5);
    expect([...pools.values()]).toEqual([64,64,64,64,64]);
    expect(signatures.size).toBe(bank.templates.length);
    expect(used.size).toBeGreaterThanOrEqual(1300);
    expect([...used].sort()).toEqual(Object.keys(clues).sort());
    expect(used.has("MUSSETTE")).toBe(false);
  });

  it("keeps answers valid and varied across future issues without changing the issue when its edition id changes", () => {
    const recent:string[]=[];const used=new Set<string>();
    for(let issue=bank.firstIssue;issue<bank.firstIssue+640;issue++) {
      const rows=getCyclogazetteGameSolutions(issue).crosswordRows;
      const answers=words(rows);const signature=[...answers].sort().join("|");
      expect(recent.slice(-28)).not.toContain(signature);recent.push(signature);
      answers.forEach(word=>used.add(word));
      expect(isCyclogazetteGameAnswerCorrect({issueNumber:issue,gameType:"crossword",answer:rows.join("")})).toBe(true);
      expect(getCyclogazetteGameSolutions(issue,"edition-rerolled").crosswordRows).toEqual(rows);
    }
    expect(used.size).toBeGreaterThan(850);
  });

  it("keeps the authored source dictionary free from duplicates, fragments and placeholder clues", () => {
    const entries=readFileSync(new URL("./cyclogazette-crossword-vocabulary.txt",import.meta.url),"utf8").split(/\r?\n/).filter(line=>line&&!line.startsWith("#"));
    const answers=entries.map(line=>line.split("|")[0]);
    expect(entries.length).toBeGreaterThan(2000);
    expect(new Set(answers).size).toBe(answers.length);
    expect(entries.every(line=>/^[A-Z]+\|.{8,}$/.test(line)&&!/(?:Entrée non|Entrée volontairement|\.\.\.)/i.test(line))).toBe(true);
  });
});
