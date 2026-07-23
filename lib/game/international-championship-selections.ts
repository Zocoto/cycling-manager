export type InternationalSelectionDecisionStatus =
  | "pending"
  | "confirmed"
  | "automatic"
  | "declined"
  | "ineligible_injury"
  | "unavailable";

export function canRespondToInternationalSelection({
  isSelected,
  responseStatus,
  departureAt,
  now,
}: {
  isSelected: boolean;
  responseStatus: InternationalSelectionDecisionStatus;
  departureAt: string;
  now: Date;
}) {
  const departureTimestamp = Date.parse(departureAt);

  return (
    isSelected &&
    responseStatus === "pending" &&
    Number.isFinite(departureTimestamp) &&
    departureTimestamp > now.getTime()
  );
}

export function shouldDisplayInternationalSelection({
  isSelected,
  wasSelected,
  responseStatus,
}: {
  isSelected: boolean;
  wasSelected: boolean;
  responseStatus: InternationalSelectionDecisionStatus;
}) {
  return (
    isSelected ||
    wasSelected ||
    responseStatus === "confirmed" ||
    responseStatus === "automatic" ||
    responseStatus === "declined"
  );
}
