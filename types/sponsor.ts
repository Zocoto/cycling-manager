export type SponsorPrestige = 1 | 2 | 3 | 4 | 5;

export type JerseyStyle = "classic" | "modern" | "bold";

export interface SponsorBudgetRange {
  min: number;
  max: number;
}

export interface SponsorContractDurationRange {
  min: number;
  max: number;
}

export interface SponsorColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface SponsorJersey {
  id: string;
  name: string;
  style: JerseyStyle;
  imagePath: string;
}

export interface Sponsor {
  /**
   * Clé stable utilisée dans le catalogue TypeScript
   * et dans sponsors.catalog_key sur Supabase.
   */
  id: string;

  name: string;
  shortName: string;
  countryCode: string;
  sector: string;
  description: string;

  prestige: SponsorPrestige;
  minimumReputation: number;
  budgetRange: SponsorBudgetRange;
  contractDurationRange: SponsorContractDurationRange;

  logoPath: string;
  jerseys: SponsorJersey[];
  colors: SponsorColors;
}

export interface SponsorProposal {
  sponsor: Sponsor;
  proposedBudget: number;
  contractDurationSeasons: number;
}