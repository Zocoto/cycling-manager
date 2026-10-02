export const PCM_SPECTATOR_TEAM_ID = 243;
export const PCM_SPECTATOR_RIDER_IDS = [9001, 9002, 9003, 9004, 9005, 9006, 9007] as const;

export type PcmStartlistTeam = {
  teamId: number;
  riderIds: number[];
};

export function createPcmStartlistXml(teams: readonly PcmStartlistTeam[]) {
  validatePcmStartlist(teams);

  const lines = ['<?xml version="1.0" encoding="utf-8"?>', "<startlist>"];
  for (const team of teams) {
    lines.push(`  <team id="${team.teamId}">`);
    for (const riderId of team.riderIds) {
      lines.push(`    <cyclist id="${riderId}" />`);
    }
    lines.push("  </team>");
  }
  lines.push("</startlist>", "");

  return lines.join("\r\n");
}

export function validatePcmStartlist(teams: readonly PcmStartlistTeam[]) {
  const teamIds = new Set<number>();
  const riderIds = new Set<number>();

  for (const team of teams) {
    if (!Number.isInteger(team.teamId) || team.teamId <= 0) {
      throw new Error("Identifiant PCM d’équipe invalide dans la startlist.");
    }
    if (teamIds.has(team.teamId)) {
      throw new Error(`Équipe PCM ${team.teamId} présente plusieurs fois.`);
    }
    if (team.riderIds.length === 0 || team.riderIds.length > 9) {
      throw new Error(`Effectif PCM invalide pour l’équipe ${team.teamId}.`);
    }
    teamIds.add(team.teamId);

    for (const riderId of team.riderIds) {
      if (!Number.isInteger(riderId) || riderId <= 0) {
        throw new Error(`Identifiant de coureur PCM invalide : ${riderId}.`);
      }
      if (riderIds.has(riderId)) {
        throw new Error(`Coureur PCM ${riderId} présent plusieurs fois.`);
      }
      riderIds.add(riderId);
    }
  }
}

