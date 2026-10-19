// Browser-only recovery data. Never submit a recovered draft automatically.
export const MANAGEMENT_DRAFT_TTL = 24 * 60 * 60 * 1000;
export const MANAGEMENT_DRAFT_MAX_SIZE = 100_000;

export function encodeManagementDraft(baseline: string, value: unknown, now = Date.now()) {
  const raw = JSON.stringify({ version: 1, savedAt: now, baseline, value });
  return raw.length <= MANAGEMENT_DRAFT_MAX_SIZE ? raw : null;
}

export function decodeManagementDraft(raw: string | null, baseline: string, now = Date.now()): { value: unknown } | null {
  if (!raw || raw.length > MANAGEMENT_DRAFT_MAX_SIZE) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || draft.baseline !== baseline ||
        !Number.isFinite(draft.savedAt) || draft.savedAt > now ||
        now - draft.savedAt >= MANAGEMENT_DRAFT_TTL || !("value" in draft)) return null;
    return { value: draft.value };
  } catch { return null; }
}

export function isDraftRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
