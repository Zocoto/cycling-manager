export type SitePresence = { total: number; visitors: number; players: { id: string; name: string }[] };
export const SITE_PRESENCE_REFRESH_MS = 120_000;
export const SITE_PRESENCE_SNAPSHOT_KEY = "cyclostratege:site-presence:snapshot:v1";
const ATTEMPT_KEY = "cyclostratege:site-presence:last-attempt:v1";
type PresenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function normalizeSitePresence(value: unknown): SitePresence | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!Number.isInteger(row.total) || Number(row.total) < 0
    || !Number.isInteger(row.visitors) || Number(row.visitors) < 0 || !Array.isArray(row.players)
    || row.players.some((p) => !p || typeof p !== "object" || typeof p.id !== "string" || typeof p.name !== "string")) return null;
  // Only the public counter/list is shared across tabs, never account/session data.
  return { total: Number(row.total), visitors: Number(row.visitors), players: row.players.map((p) => ({ id: p.id, name: p.name })) };
}

export function readSitePresenceSnapshot(storage: PresenceStorage | null, now: number): SitePresence | null {
  try {
    const raw = storage?.getItem(SITE_PRESENCE_SNAPSHOT_KEY);
    if (!raw || raw.length > 1_000_000) return null;
    const snapshot = JSON.parse(raw) as { recordedAt?: unknown; data?: unknown };
    if (typeof snapshot.recordedAt !== "number" || !Number.isFinite(snapshot.recordedAt)
      || now < snapshot.recordedAt || now - snapshot.recordedAt >= SITE_PRESENCE_REFRESH_MS) return null;
    return normalizeSitePresence(snapshot.data);
  } catch { return null; }
}

export function claimSitePresenceRefresh(storage: PresenceStorage | null, now: number) {
  try {
    const raw = storage?.getItem(ATTEMPT_KEY);
    const last = raw === null || raw === undefined ? NaN : Number(raw);
    if (Number.isFinite(last) && now >= last && now - last < SITE_PRESENCE_REFRESH_MS) return false;
    storage?.setItem(ATTEMPT_KEY, String(now));
  } catch { /* The local single-flight guard still works without storage. */ }
  return true;
}

export function storeSitePresenceSnapshot(storage: PresenceStorage | null, recordedAt: number, data: SitePresence) {
  try { storage?.setItem(SITE_PRESENCE_SNAPSHOT_KEY, JSON.stringify({ recordedAt, data })); } catch { /* Optional cross-tab optimization. */ }
}

export function releaseFailedSitePresenceRefresh(storage: PresenceStorage | null, attemptedAt: number) {
  try { if (storage?.getItem(ATTEMPT_KEY) === String(attemptedAt)) storage.removeItem(ATTEMPT_KEY); } catch { /* Retry on next visit/tick. */ }
}
