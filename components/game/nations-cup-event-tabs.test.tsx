import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NationsCupEventTabs } from "./nations-cup-event-tabs";

describe("NationsCupEventTabs", () => {
  it("présente les cinq courses comme des onglets dans une page commune", () => {
    const events = [
      ["montagne", "Montagne", "mountain"],
      ["vallons", "Vallons", "hilly"],
      ["sprint", "Sprint", "sprint"],
      ["paves", "Pavés", "cobbles"],
      ["clm", "Contre-la-montre", "time_trial"],
    ].map(([slug, name, profileType]) => ({
      id: slug,
      slug: `nations-cup-${slug}`,
      name,
      profileType,
      status: "planned",
    }));

    const markup = renderToStaticMarkup(
      <NationsCupEventTabs events={events} />,
    );

    expect(markup.match(/role="tab"/g)).toHaveLength(5);
    expect(markup.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(markup).toContain("Les cinq épreuves");
    expect(markup).toContain("Nations Cup · Montagne");
    expect(markup).toContain('href="/jeu/courses/nations-cup-montagne"');
  });
});
