import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyCyclogazettePollVote } from "@/services/cyclogazette-games";

const sidebar = readFileSync(
  join(process.cwd(), "components/game/cyclogazette-games-sidebar.tsx"),
  "utf8",
);
const actions = readFileSync(
  join(process.cwd(), "app/jeu/gazette/actions.ts"),
  "utf8",
);

describe("interactions des jeux de La Cyclogazette", () => {
  it("affiche le résultat dans une modale sans rafraîchir la Gazette", () => {
    expect(sidebar).toContain('aria-modal="true"');
    expect(sidebar).toContain('"Réussi !"');
    expect(sidebar).toContain('"Raté !"');
    expect(sidebar).toContain('"OK, reprendre la grille"');
    expect(sidebar).toContain("onSubmit={onValidate}");
    expect(sidebar).toContain("validationRequested &&");
    expect(sidebar).toContain("state !== dismissedResult");
    expect(sidebar).toContain("window.sessionStorage.setItem");
    expect(sidebar).toContain("useSyncExternalStore");
    expect(sidebar).not.toContain("router.refresh()");
    expect(sidebar).not.toContain("useRefreshAfterSuccess");

    const gameAction = actions.slice(
      actions.indexOf("export async function validateCyclogazetteGameAction"),
      actions.indexOf("export async function voteCyclogazettePollAction"),
    );
    const pollAction = actions.slice(
      actions.indexOf("export async function voteCyclogazettePollAction"),
      actions.indexOf("function failureState"),
    );
    expect(gameAction).not.toContain('revalidatePath("/jeu/gazette")');
    expect(pollAction).not.toContain('revalidatePath("/jeu/gazette")');
  });

  it("répercute immédiatement le vote dans les résultats locaux", () => {
    const poll = applyCyclogazettePollVote(
      {
        id: "poll-1",
        question: "Votre choix ?",
        options: [
          { id: "option-1", label: "A", votes: 2 },
          { id: "option-2", label: "B", votes: 1 },
        ],
        totalVotes: 3,
        viewerOptionId: null,
      },
      "option-2",
    );

    expect(poll.viewerOptionId).toBe("option-2");
    expect(poll.totalVotes).toBe(4);
    expect(poll.options).toEqual([
      { id: "option-1", label: "A", votes: 2 },
      { id: "option-2", label: "B", votes: 2 },
    ]);
  });

  it("n'ajoute jamais deux fois un vote déjà connu", () => {
    const original = {
      id: "poll-1",
      question: "Votre choix ?",
      options: [
        { id: "option-1", label: "A", votes: 2 },
        { id: "option-2", label: "B", votes: 1 },
      ],
      totalVotes: 3,
      viewerOptionId: "option-1",
    };

    expect(applyCyclogazettePollVote(original, "option-1")).toBe(original);
  });
});
