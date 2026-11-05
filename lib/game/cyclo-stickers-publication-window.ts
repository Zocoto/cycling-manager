/** One S4→S5 edition. Reuses existing nightly and staff maintenance schedules. */
export function isCycloStickersPublicationWindow(at: Date): boolean {
  if (!Number.isFinite(at.getTime())) return false;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return day >= "2026-11-06" && day <= "2026-12-03";
}
