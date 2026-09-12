export type FederationSelectionSchedule = {
  slot_key: string;
  label: string;
  rider_category: "professional" | "junior";
  race_edition_id: string | null;
  race_href: string | null;
  departure_at: string | null;
  closes_at: string | null;
  is_open: boolean;
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
};

export function splitFederationCallups(callups: FederationCallup[]) {
  return {
    pending: callups.filter((callup) => callup.response_status === "pending" && callup.can_respond),
    history: callups.filter((callup) => callup.response_status !== "pending" || !callup.can_respond),
  };
}
export function formatFederationSelectionDeadline(value: string | null) {
  return value ? new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) : "Calendrier indisponible";
}
