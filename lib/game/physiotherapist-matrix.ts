export type PhysiotherapistAssignment = Record<string, string | null>;

export function countPhysiotherapistAssignments(
  assignments: PhysiotherapistAssignment,
  staffContractId: string,
): number {
  return Object.values(assignments).filter(
    (assignedContractId) => assignedContractId === staffContractId,
  ).length;
}

export function togglePhysiotherapistAssignment({
  assignments,
  riderId,
  staffContractId,
  capacity,
}: {
  assignments: PhysiotherapistAssignment;
  riderId: string;
  staffContractId: string;
  capacity: number;
}): PhysiotherapistAssignment {
  const currentContractId = assignments[riderId] ?? null;

  if (currentContractId === staffContractId) {
    return { ...assignments, [riderId]: null };
  }

  if (
    countPhysiotherapistAssignments(assignments, staffContractId) >= capacity
  ) {
    return assignments;
  }

  return { ...assignments, [riderId]: staffContractId };
}

export function serializePhysiotherapistAssignments(
  assignments: PhysiotherapistAssignment,
) {
  return Object.entries(assignments).flatMap(
    ([riderId, staffContractId]) =>
      staffContractId ? [{ riderId, staffContractId }] : [],
  );
}
