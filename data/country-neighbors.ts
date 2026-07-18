/**
 * Référentiel des pays voisins utilisé pour la génération
 * des propositions de sponsors.
 *
 * Les codes correspondent à la norme ISO 3166-1 alpha-2,
 * comme la colonne countries.iso_alpha2 dans Supabase.
 *
 * Ce premier référentiel couvre principalement l'Europe
 * occidentale. Il pourra être enrichi avec le catalogue.
 */
export const COUNTRY_NEIGHBORS: Readonly<
  Record<string, readonly string[]>
> = {
  AD: ["FR", "ES"],
  AT: ["DE", "CZ", "SK", "HU", "SI", "IT", "CH", "LI"],
  BE: ["FR", "LU", "DE", "NL"],
  CH: ["FR", "DE", "AT", "LI", "IT"],
  DE: ["DK", "PL", "CZ", "AT", "CH", "FR", "LU", "BE", "NL"],
  DK: ["DE"],
  ES: ["PT", "FR", "AD"],
  FR: ["BE", "LU", "DE", "CH", "IT", "MC", "ES", "AD"],
  IT: ["FR", "CH", "AT", "SI", "SM", "VA"],
  LI: ["CH", "AT"],
  LU: ["BE", "DE", "FR"],
  MC: ["FR"],
  NL: ["BE", "DE"],
  PT: ["ES"],
  SI: ["IT", "AT", "HU", "HR"],
};

/**
 * Retourne les pays voisins d'un pays.
 * Un tableau vide est retourné lorsque le pays
 * n'est pas encore présent dans le référentiel.
 */
export function getNeighboringCountryCodes(
  countryCode: string
): readonly string[] {
  const normalizedCountryCode = countryCode.trim().toUpperCase();

  return COUNTRY_NEIGHBORS[normalizedCountryCode] ?? [];
}