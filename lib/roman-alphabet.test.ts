import { describe, expect, it } from "vitest";

import { usesRomanAlphabet } from "./roman-alphabet";

describe("usesRomanAlphabet", () => {
  it("accepte les noms latins, leurs accents et la ponctuation", () => {
    expect(usesRomanAlphabet("Clásica de l’Öresund — U23")).toBe(true);
    expect(usesRomanAlphabet("Gốm Lam Việt & Co.")).toBe(true);
    expect(usesRomanAlphabet("Łódź Stagecraft")).toBe(true);
  });

  it.each([
    "Бишкек Эмаль",
    "Γύρος Αθήνας",
    "東京サーキット",
    "평양 순환경주",
    "تور زاگرس",
    "Երևանի շրջան",
    "የአዲስ አበባ ዙር",
  ])("refuse les lettres d’un autre alphabet : %s", (value) => {
    expect(usesRomanAlphabet(value)).toBe(false);
  });
});

