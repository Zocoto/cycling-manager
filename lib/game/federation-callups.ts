export type FederationSelectionSchedule = {
  slot_key: string;
  label: string;
  rider_category: "professional" | "junior";
  race_edition_id: string | null;
  race_href: string | null;
  departure_at: string | null;
  closes_at: string | null;
  is_open: boolean;
  can_prepare?: boolean;
  qualification_status?: "pending" | "qualified" | "not_qualified" | "not_applicable";
  qualification_day_number?: number | null;
};

export function getFederationPreselectionAvailabilityMessage(schedule: FederationSelectionSchedule | undefined) {
  if (schedule?.qualification_status === "not_qualified") {
    return "Cette fédération n’est pas qualifiée pour cette compétition. Les convocations sont fermées.";
  }
  if (!schedule?.closes_at) return "Les modifications seront disponibles lorsque le calendrier sera confirmé.";
  if (schedule.qualification_status === "pending" && schedule.can_prepare) {
    return `Qualification nationale en attente · gel prévu à J${schedule.qualification_day_number ?? 8}. Vous pouvez préparer et enregistrer votre brouillon dès maintenant. L’envoi aux DS sera disponible après qualification, jusqu’au ${formatFederationSelectionDeadline(schedule.closes_at)} (heure de Paris).`;
  }
  return (schedule.can_prepare ?? schedule.is_open)
    ? `Modifications possibles jusqu’au ${formatFederationSelectionDeadline(schedule.closes_at)} (heure de Paris).`
    : "Date limite dépassée : les convocations sont verrouillées.";
}

export type FederationSelectionSlotTiming = {
  competitionCode: string;
  riderCategory: "professional" | "junior";
  departureAt: string | null;
};

export type FederationCallup = {
  member_id: string;
  country_code: string;
  country_name: string;
  slot_key: string;
  competition_label: string;
  rider_id: string;
  rider_name: string;
  rider_category: "professional" | "junior";
  response_status: "pending" | "confirmed" | "declined";
  published_at: string;
  closes_at: string | null;
  can_respond: boolean;
  race_href: string | null;
  conflicting_race_names: string[];
};

export function splitFederationCallups(callups: FederationCallup[]) {
  return {
    pending: callups.filter((callup) => callup.response_status === "pending" && callup.can_respond),
    history: callups.filter((callup) => callup.response_status !== "pending" || !callup.can_respond),
  };
}

export function filterFederationCallupsByCategory(
  callups: FederationCallup[],
  category: FederationCallup["rider_category"],
) {
  return callups.filter((callup) => callup.rider_category === category);
}

export function getFederationCallupResponseClosesAt({
  competitionCode,
  riderCategory,
  departureAt,
}: FederationSelectionSlotTiming) {
  if (!departureAt) return null;

  const departure = new Date(departureAt);
  if (Number.isNaN(departure.getTime())) return null;

  const leadHours =
    riderCategory === "junior"
      ? 0
      : competitionCode === "world_championship"
        ? 24
        : 1;

  return new Date(
    departure.getTime() - leadHours * 60 * 60 * 1_000,
  ).toISOString();
}

export function isFederationCallupResponseOpen(
  timing: FederationSelectionSlotTiming,
  now = new Date(),
) {
  const closesAt = getFederationCallupResponseClosesAt(timing);
  return closesAt !== null && now.getTime() < new Date(closesAt).getTime();
}

export function formatFederationSelectionDeadline(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) : "Calendrier indisponible";
}
