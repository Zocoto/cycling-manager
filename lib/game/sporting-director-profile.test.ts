import { describe, expect, it } from "vitest";

import { getSportingDirectorProfileHref } from "./sporting-director-profile";

describe("getSportingDirectorProfileHref", () => {
  it("builds a stable profile link from the sporting director id", () => {
    expect(
      getSportingDirectorProfileHref(
        "2c7e28fd-86ce-4db7-9f2b-a8beb0d1fd98",
      ),
    ).toBe(
      "/jeu/directeurs-sportifs/2c7e28fd-86ce-4db7-9f2b-a8beb0d1fd98",
    );
  });

  it("falls back to the director rankings when the id is missing", () => {
    expect(getSportingDirectorProfileHref("   ")).toBe(
      "/jeu/classements?vue=equipes",
    );
  });
});