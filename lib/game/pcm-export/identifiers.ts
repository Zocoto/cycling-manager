import { createHash } from "node:crypto";

type TeamIdentifierSource = {
  team_id: string;
  display_name: string;
  short_name?: string | null;
};

export function normalizeAscii(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
}

function hashLetters(value: string) {
  const digest = createHash("sha256").update(value).digest();
  return [...digest.subarray(0, 6)].map((byte) =>
    String.fromCharCode(97 + (byte % 26)),
  );
}

export function createUniqueTeamCodes(
  teams: TeamIdentifierSource[],
  reservedCodes: unknown[] = [],
) {
  const used = new Set(
    reservedCodes.map((code) => String(code).toLowerCase()),
  );
  const result = new Map<string, string>();

  for (const team of [...teams].sort((left, right) =>
    left.team_id.localeCompare(right.team_id),
  )) {
    const cleanName = normalizeAscii(team.display_name || team.short_name);
    const words = cleanName.split(/\s+/).filter(Boolean);
    const readable =
      words.length >= 3
        ? words
            .slice(0, 3)
            .map((word) => word[0])
            .join("")
        : cleanName.replaceAll(" ", "").slice(0, 3);
    const hash = hashLetters(team.team_id);
    const candidates = [
      readable,
      `${readable.slice(0, 2)}${hash[0]}`,
      `${readable.slice(0, 1)}${hash[0]}${hash[1]}`,
      ...hash.slice(0, 4).map(
        (letter, index) =>
          `${letter}${hash[(index + 1) % hash.length]}${hash[(index + 2) % hash.length]}`,
      ),
    ]
      .map((candidate) => candidate.toLowerCase().padEnd(3, "x").slice(0, 3))
      .filter((candidate) => /^[a-z]{3}$/.test(candidate));

    const code = candidates.find((candidate) => !used.has(candidate));
    if (!code) {
      throw new Error(
        `Impossible d'attribuer un code PCM unique a ${team.display_name}.`,
      );
    }

    used.add(code);
    result.set(team.team_id, code);
  }

  return result;
}
