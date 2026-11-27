import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CycloStickersQuizHostArtwork } from "./cyclo-stickers-quiz-host-artwork";

const print = () => renderToStaticMarkup(<svg viewBox="0 0 120 150"><CycloStickersQuizHostArtwork /></svg>);

describe("the chat quizmaster's printed pose", () => {
  it("preserves the real mascot's face, cap and moustache rather than inventing a presenter", () => {
    const source = readFileSync(path.join(process.cwd(), "public/images/chat/quizz-o-stratege.svg"), "utf8");
    const html = print();
    expect(html).toContain('data-quiz-host="quizz-o-stratege"');
    expect(html).toContain('data-quiz-host-source="/images/chat/quizz-o-stratege.svg"');
    // These defining shapes are checked against the actual chat asset, not a
    // duplicated expected portrait or a picture of another staff character.
    for (const ink of ["#EFE1B8", "#D8C38A", "#D7B15A", "#3B2821"]) {
      const geometry = source.match(new RegExp(`<path d="([^"]+)" fill="${ink}"`))?.[1];
      expect(geometry, ink).toBeTruthy();
      expect(html).toContain(`d="${geometry}" fill="${ink}"`);
    }
    expect(html).toContain('transform="translate(50 49)"');
    expect(html).toContain('transform="translate(70 49) scale(-1 1)"');
  });

  it("puts a yellow question card into two hands without the old circular badge or magnifier", () => {
    const html = print();
    const cardPosition = html.indexOf('data-quiz-cue-card="held"');
    expect(cardPosition).toBeGreaterThan(0);
    expect(html).toContain('fill="#EBC54C"');
    expect(html).toContain("QUIZZ</text>");
    expect(html).toContain(">?</text>");
    for (const side of ["left", "right"]) {
      expect(html.indexOf(`data-quiz-card-hand="${side}"`)).toBeGreaterThan(cardPosition);
    }
    expect(html).not.toMatch(/quiz-avatar-circle|clipPath|B48A37|<image\b|foreignObject|<filter\b|https?:\/\//);
  });

  it("can appear in several prints without fixed SVG identifiers or external assets", () => {
    const html = renderToStaticMarkup(<svg><CycloStickersQuizHostArtwork /><CycloStickersQuizHostArtwork /></svg>);
    expect(html.match(/data-quiz-host="quizz-o-stratege"/g)).toHaveLength(2);
    expect(html).not.toMatch(/\bid=|\bhref=|url\(/);
  });
});
