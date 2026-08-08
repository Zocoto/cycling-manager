export function resolveStageRaceRole<Role extends string>({
  riderId,
  generalRole,
  roleOverrides,
}: {
  riderId: string;
  generalRole: Role;
  roleOverrides?: Readonly<Record<string, Role>>;
}) {
  return roleOverrides?.[riderId] ?? generalRole;
}
