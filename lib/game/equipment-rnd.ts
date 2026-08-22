export type EquipmentRndSpecialty =
  | "research_time"
  | "research_cost"
  | "research_success";

export const EQUIPMENT_RND_SPECIALTIES = [
  "research_time",
  "research_cost",
  "research_success",
] as const satisfies readonly EquipmentRndSpecialty[];

export type EquipmentRndEngineer = {
  contractId: string;
  name: string;
  level: number;
  specialties: EquipmentRndSpecialty[];
  /** Conservé pour les anciens appels internes ne connaissant qu'un talent. */
  specialty: EquipmentRndSpecialty | null;
};

export function isEquipmentRndSpecialty(
  value: string,
): value is EquipmentRndSpecialty {
  return EQUIPMENT_RND_SPECIALTIES.some((specialty) => specialty === value);
}

function getEngineerSpecialties(
  engineer: EquipmentRndEngineer | null | undefined,
): EquipmentRndSpecialty[] {
  if (!engineer) return [];
  if (engineer.specialties.length > 0) {
    return EQUIPMENT_RND_SPECIALTIES.filter((specialty) =>
      engineer.specialties.includes(specialty),
    );
  }
  return engineer.specialty ? [engineer.specialty] : [];
}

export function estimateEquipmentRndResearch(args: {
  labLevel: number;
  itemPrice: number;
  engineer?: EquipmentRndEngineer | null;
}) {
  const baseDays =
    [18, 16, 14, 12, 10, 9, 8][Math.max(1, args.labLevel) - 1] ?? 18;
  const engineer = args.engineer ?? null;
  const specialties = getEngineerSpecialties(engineer);
  const hasSpecialty = (specialty: EquipmentRndSpecialty) =>
    specialties.includes(specialty);
  const successRate = Math.min(
    95,
    45 +
      args.labLevel * 5 +
      (engineer && hasSpecialty("research_success") ? engineer.level * 3 : 0),
  );
  const durationDays = Math.max(
    4,
    baseDays -
      (engineer && hasSpecialty("research_time") ? engineer.level : 0),
  );
  const cost = Math.round(
    (100_000 + args.labLevel * 50_000 + Math.max(args.itemPrice, 1_000) * 12) *
      (1 -
        (engineer && hasSpecialty("research_cost")
          ? engineer.level * 0.05
          : 0)),
  );
  return { successRate, durationDays, cost };
}

export function describeEquipmentRndEngineerEffects(
  engineer: EquipmentRndEngineer,
): string[] {
  return getEngineerSpecialties(engineer).map((specialty) => {
    switch (specialty) {
      case "research_time":
        return `−${engineer.level} jour${engineer.level > 1 ? "s" : ""}`;
      case "research_cost":
        return `−${engineer.level * 5} % sur le coût`;
      case "research_success":
        return `+${engineer.level * 3} points de réussite`;
    }
  });
}
