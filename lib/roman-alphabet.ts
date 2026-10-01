const LETTER_PATTERN = /^\p{Letter}$/u;
const LATIN_LETTER_PATTERN = /^\p{Script=Latin}$/u;

export const ROMAN_ALPHABET_NAME_ERROR =
  "Utilise l’alphabet latin pour que le nom reste lisible par tous les managers.";

/**
 * Accents, chiffres, espaces et ponctuation restent autorisés. Seules les
 * lettres appartenant à un autre système d’écriture sont refusées.
 */
export function usesRomanAlphabet(value: string): boolean {
  return Array.from(value.normalize("NFC")).every(
    (character) =>
      !LETTER_PATTERN.test(character) || LATIN_LETTER_PATTERN.test(character),
  );
}

