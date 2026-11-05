import definitions from "./consumable-equivalences.json";

const byEffect = new Map(definitions.flatMap((group) => group.members.map((member) =>
  [`${member.source}:${member.key}:${member.kind}:${stablePayload(member.payload)}`, group] as const,
)));

// Only audited ordinary catalogues participate. Unknown/event items fail closed;
// even an existing key stops merging if any part of its effect changes.
export function findConsumableEquivalence({
  source, key, kind, payload,
}: {
  source: string;
  key: string | null | undefined;
  kind: string;
  payload: Record<string, unknown> | undefined;
}) {
  if (!key || !payload) return null;
  return byEffect.get(`${source}:${key}:${kind}:${stablePayload(payload)}`) ?? null;
}

function stablePayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePayload).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stablePayload(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
