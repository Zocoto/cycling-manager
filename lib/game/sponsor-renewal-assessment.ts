/** The database computes this bilan again when an unsigned renewal is signed. */
export type SponsorRenewalAssessment = {
  contractId: string;
  sponsorId: string;
  averageSatisfaction: number;
  minimumSatisfaction: number;
  seasonsEvaluated: number;
  reputationDiscount: number;
  refused: boolean;
};

export function readSponsorRenewalAssessment(value: unknown): SponsorRenewalAssessment {
  if (!value || typeof value !== "object") {
    throw new Error("Le bilan de reconduction du sponsor est indisponible.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.contractId !== "string" || typeof row.sponsorId !== "string" ||
    typeof row.refused !== "boolean" ||
    ![row.averageSatisfaction, row.minimumSatisfaction, row.seasonsEvaluated, row.reputationDiscount]
      .every((number) => typeof number === "number" && Number.isFinite(number)) ||
    Number(row.averageSatisfaction) < 0 || Number(row.averageSatisfaction) > 100 ||
    Number(row.minimumSatisfaction) < 0 || Number(row.minimumSatisfaction) > 100 ||
    !Number.isInteger(row.seasonsEvaluated) || Number(row.seasonsEvaluated) < 1
  ) {
    throw new Error("Le bilan de reconduction du sponsor est invalide.");
  }
  return row as SponsorRenewalAssessment;
}
