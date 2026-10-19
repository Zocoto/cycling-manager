import { existsSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import snapshot from "@/data/collector-album-pilot.json";
import type { CollectorCard } from "@/lib/game/collector-album";
import { CollectorCardBack, CollectorCardFace, formatCollectorHonour } from "./collector-card-face";

const cards = snapshot.cards as CollectorCard[];

describe("printed collector cards", () => {
  it.each(cards)("uses the local national flag for $name without changing the card data", card => {
    const before = JSON.stringify(card);
    const markup = renderToStaticMarkup(<CollectorCardFace card={card} season={3} />);
    const flagPath = `/images/flags/4x3/${card.countryCode.toLowerCase()}.svg`;
    expect(existsSync(path.join(process.cwd(), "public", flagPath))).toBe(true);
    expect(markup).toContain(`href="${flagPath}"`);
    expect(markup).toMatch(/<svg[^>]+aria-hidden="true"[^>]+focusable="false"><image aria-hidden="true"/);
    expect(markup).toContain(`Portrait de ${card.name}`);
    expect(markup).toContain(`>${card.name}</h3>`);
    for (const [stat, label] of [["mountain", "MO"], ["hills", "VAL"], ["flat", "PLA"], ["timeTrial", "CLM"], ["cobbles", "PAV"], ["sprint", "SPR"]] as const) {
      expect(markup).toContain(`<dt>${label}</dt><dd>${card.ratings[stat]}</dd>`);
    }
    expect(markup).toContain("ÉDITION S4");
    expect(markup).toContain("UCI S3");
    expect(JSON.stringify(card)).toBe(before);
  });

  it("does not construct a flag URL from malformed country input", () => {
    const markup = renderToStaticMarkup(<CollectorCardFace card={{...cards[0], countryCode:"../invalid"}} season={3} />);
    expect(markup).not.toContain("/images/flags/");
    expect(markup).toContain(cards[0].name);
  });

  it.each(cards)("shows only the frozen S3 honours on the back of $name",card=>{
    const markup=renderToStaticMarkup(<CollectorCardBack card={card} season={3}/>);
    expect(markup).toContain("SAISON 3");
    expect(markup.match(/<li>/g)?.length??0).toBe(card.honours.length);
    expect(markup).toContain("Résultats et notes figés en fin de saison 3");
    expect(markup).not.toContain("SAISON 4");
  });
  it("reserves the rainbow and white jersey for verified source-season world champions",()=>{
    const champion=cards.find(c=>c.name==="Mathieu Laurent")!;
    expect(renderToStaticMarkup(<CollectorCardFace card={champion} season={3}/>)).toContain("Champion du monde · Route · S3");
    expect(renderToStaticMarkup(<CollectorCardFace card={cards[0]} season={3}/>)).not.toContain("Champion du monde");
    expect(formatCollectorHonour({...cards[0].honours[0],kind:"stages",count:3})).toBe("3 victoires d’étapes");
    expect(formatCollectorHonour({...cards[0].honours[0],kind:"mountain"})).toBe("Meilleur grimpeur");
  });
});
