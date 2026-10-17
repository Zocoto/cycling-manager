import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NationalFederationJersey } from "./national-federation-jersey";
import { NationalFederationJerseyWorkshop } from "./national-federation-jersey-workshop";
import { PREVIEW_MAURITIUS_SELECTION as selection, PREVIEW_MAURITIUS_CHAMPION as champion, previewPublishedJersey } from "@/lib/game/federation-jersey-preview-fixtures";

describe("two official federation kits", () => {
  it("distinguishes the two independent published designs and renders selection text", () => {
    const markup = renderToStaticMarkup(<>
      <NationalFederationJersey countryCode="MU" countryName="Maurice" design={selection} />
      <NationalFederationJersey countryCode="MU" countryName="Maurice" kind="national_champion" design={champion} />
    </>);
    expect(markup).toContain('data-federation-jersey-kind="national_team"');
    expect(markup).toContain('data-federation-jersey-kind="national_champion"');
    expect(markup).toContain("MAURITIUS");
    expect(markup).toContain("champion-flag");
  });
  it("escapes text rather than interpreting markup", () => {
    const markup = renderToStaticMarkup(<NationalFederationJersey countryCode="MU" countryName="Maurice"
      design={{ ...selection, elements: [{ ...selection.elements.at(-1)!, text: "<script>alert(1)</script>" }] }} />);
    expect(markup).not.toContain("<script>"); expect(markup).toContain("&lt;script&gt;");
  });
  it("uses the flag when no federation artwork is published", () => {
    expect(renderToStaticMarkup(<NationalFederationJersey countryCode="MU" countryName="Maurice" />)).toContain('href="/images/flags/4x3/mu.svg"');
  });
  it("has two choices but only one editor and a clearly local preview validation", () => {
    const markup = renderToStaticMarkup(<NationalFederationJerseyWorkshop countryCode="MU" countryName="Maurice" selectionJersey={previewPublishedJersey(selection)}
      championJersey={previewPublishedJersey(champion)} canEdit previewOnly />);
    expect(markup.match(/Atelier présidentiel ·/g)).toHaveLength(1);
    expect(markup).toContain("Champions nationaux"); expect(markup).toContain("Sélection nationale");
    expect(markup).toContain("Tester la validation · aperçu local");
    expect(markup).toContain('name="jerseyKind" value="national_team"');
  });
});
