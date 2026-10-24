import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountrySelect } from "./country-select";

function render(count?: number, locked = false) {
  return renderToStaticMarkup(<CountrySelect id="country" value="fr" onChange={() => {}}
    countries={[{ id: "fr", name: "France", isoAlpha2: "FR", directorCount: count }]}
    placeholder="Choisir" listAriaLabel="Pays" locked={locked} />);
}

describe("country choice indicator", () => {
  it.each([0, 1, 12, 1234])("keeps the selected country's %i DS visible before confirmation", (count) => {
    expect(render(count)).toContain(`${count} DS`);
  });
  it("does not invent a count when unavailable", () => {
    expect(render()).not.toContain(" DS");
  });
  it("leaves previously confirmed nationality fields unchanged", () => {
    expect(render(12, true)).not.toContain("12 DS");
    expect(render(12, true)).toContain("disabled");
  });
});
