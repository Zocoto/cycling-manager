import { describe, expect, it } from "vitest";

import { getLoginReturnPath } from "./login-return-path";

describe("getLoginReturnPath", () => {
  it.each([
    "/apercus/noel/index.html",
    "/apercus/noel/index.html#tournee",
  ])("preserves the explicitly allowed destination %s", (path) => {
    expect(getLoginReturnPath(path)).toBe(path);
  });

  it.each([
    undefined, null, "", "/jeu", [], {}, 123,
    "https://example.test/apercus/noel/index.html",
    "//example.test/apercus/noel/index.html",
    "\\\\example.test/apercus/noel/index.html",
    "/\\example.test/apercus/noel/index.html",
    "%2Fapercus%2Fnoel%2Findex.html",
    "/apercus/noel/../index.html",
    "/apercus/noel/index.html?returnTo=https://example.test",
    "/apercus/noel/index.html#other",
    "/apercus/noel/tournee.html",
    " /apercus/noel/index.html",
    "/apercus/noel/index.html\r\nLocation: https://example.test",
  ])("defaults invalid destinations to the game (%j)", (value) => {
    expect(getLoginReturnPath(value)).toBe("/jeu");
  });
});
