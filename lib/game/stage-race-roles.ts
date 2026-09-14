export function resolveStageRaceRole<Role extends string>({
  riderId,
  generalRole,
  roleOverrides,
  lockedLeaderRiderId,
}: {
  riderId: string;
  generalRole: Role;
  roleOverrides?: Readonly<Record<string, Role>>;
  lockedLeaderRiderId?: string | null;
}) {
  const stageRole = roleOverrides?.[riderId];

  if (lockedLeaderRiderId) {
    if (riderId === lockedLeaderRiderId) return generalRole;
    if (stageRole === "leader") return generalRole;
  }

  return stageRole ?? generalRole;
}
