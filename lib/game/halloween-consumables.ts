import type { ItemTargetRider } from "./item-target-values";
import type { DailyRewardConstructionProject } from "./daily-rewards";

export const HALLOWEEN_SINGLE_DOSE_ITEMS = new Set(["full-moon-elixir", "mummy-resurrection", "cursed-builders-seal", "headless-frame-claim"]);
export function halloweenConsumableTarget(item: string): "rider" | "project" | "team" {
  if (item === "scouts-candy" || item === "headless-frame-claim") return "team";
  if (item === "gravediggers-hourglass" || item === "cursed-builders-seal") return "project";
  return "rider";
}

export function halloweenDoseLimit(item: string, stock: number, rider?: ItemTargetRider, project?: DailyRewardConstructionProject) {
  const limit = Math.min(30, stock);
  if (HALLOWEEN_SINGLE_DOSE_ITEMS.has(item)) {
    if (item === "full-moon-elixir" && rider && (rider.form >= 100 || rider.injury?.diagnosisCode === "fatigue_exhaustion")) return 0;
    if (item === "mummy-resurrection" && rider && !rider.injury) return 0;
    return Math.min(limit, 1);
  }
  if (item === "pumpkin-juice" && rider) return rider.injury?.diagnosisCode === "fatigue_exhaustion" ? 0 : Math.min(limit, Math.ceil((100 - rider.form) / 5));
  if (item === "mummy-bandage" && rider) return rider.injury?.canShorten ? Math.min(limit, Math.ceil(rider.injury.remainingHours / 12)) : 0;
  if (item === "witches-star" && rider) return Math.min(limit, Math.max(0, Math.floor((8 - rider.potentialSteps) / 2)));
  if (item === "youth-fountain" && rider) return Math.min(limit, Math.max(0, (rider.age ?? 24) - 24));
  if (item === "spectres-tea" && rider?.weightKg && rider.heightCm) return Math.min(limit, Math.max(0, Math.floor(rider.weightKg - Math.max(45, 18 * (rider.heightCm / 100) ** 2))));
  if (item === "giants-syrup" && rider?.heightCm && rider.weightKg) return rider.weightKg < 45 ? 0 : Math.min(limit, Math.max(0, Math.floor((Math.min(210, Math.sqrt(rider.weightKg / 18) * 100) - rider.heightCm) / 2)));
  if (item === "gravediggers-hourglass" && project) return Math.min(limit, Math.max(0, Math.ceil((project.remainingDays - 1) / 2)));
  return limit;
}

const number = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export function halloweenTargetDescription(item: string, rider: ItemTargetRider) {
  if (item === "pumpkin-juice" || item === "full-moon-elixir") return `Forme ${number(rider.form)}/100${rider.injury?.diagnosisCode === "fatigue_exhaustion" ? " · bloquée par une blessure de fatigue" : ""}`;
  if (item === "mummy-bandage" || item === "mummy-resurrection") return rider.injury ? `${rider.injury.label} · ${rider.injury.remainingHours} h restantes${item === "mummy-bandage" && !rider.injury.canShorten ? " · non raccourcissable" : ""}` : "Aucune blessure active";
  if (item === "midnight-chocolate") return `Expérience ${rider.experienceDays} jours`;
  if (item === "witches-star") return `Potentiel ${number(rider.potentialSteps / 2)}/4 ★`;
  if (item === "youth-fountain") return rider.age === null || rider.age === undefined ? "Âge indisponible" : `${rider.age} ans`;
  if (item === "spectres-tea" || item === "giants-syrup") return rider.weightKg && rider.heightCm ? `${number(rider.weightKg)} kg · ${number(rider.heightCm)} cm · IMC ${number(rider.weightKg / (rider.heightCm / 100) ** 2)}` : "Morphologie indisponible";
  if (item === "immortality-pact") return rider.protectionExpiresAt ? `Protection jusqu’au ${new Date(rider.protectionExpiresAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}` : "Aucune protection active";
  return "";
}

export function halloweenDosePreview(item: string, quantity: number, rider?: ItemTargetRider, project?: DailyRewardConstructionProject) {
  if (item === "pumpkin-juice" && rider) return `Forme : ${number(rider.form)} → ${number(Math.min(100, rider.form + 5 * quantity))}/100.`;
  if (item === "full-moon-elixir" && rider) return `Forme : ${number(rider.form)} → 100/100. La blessure et la fatigue restent inchangées.`;
  if (item === "midnight-chocolate" && rider) return `Expérience : ${rider.experienceDays} → ${rider.experienceDays + quantity} jours.`;
  if (item === "witches-star" && rider) return `Potentiel : ${number(rider.potentialSteps / 2)} → ${number(rider.potentialSteps / 2 + quantity)}/4 ★.`;
  if (item === "youth-fountain" && rider?.age) return `Âge : ${rider.age} → ${rider.age - quantity} ans.`;
  if (item === "spectres-tea" && rider?.weightKg) return `Poids : ${number(rider.weightKg)} → ${number(rider.weightKg - quantity)} kg. Sans perte de forme.`;
  if (item === "giants-syrup" && rider?.heightCm) return `Taille : ${number(rider.heightCm)} → ${number(rider.heightCm + 2 * quantity)} cm. Poids inchangé.`;
  if ((item === "mummy-bandage" || item === "mummy-resurrection") && rider?.injury) return `Blessure : ${rider.injury.remainingHours} → ${item === "mummy-resurrection" ? 0 : Math.max(0, rider.injury.remainingHours - quantity * 12)} h restantes. Forme inchangée.`;
  if (item === "scouts-candy") return `Ajoute ${quantity * 24} h de visibilité des notes et potentiels. Les durées se cumulent.`;
  if (item === "immortality-pact") return `Ajoute ${quantity * 84} matinées de protection contre le déclin lié à l’âge. Seule la durée se cumule.`;
  if (item === "gravediggers-hourglass" && project) return `Chantier : ${project.remainingDays} → ${Math.max(1, project.remainingDays - quantity * 2)} jours restants.`;
  if (item === "cursed-builders-seal") return "Achève le chantier sélectionné, sans remboursement de son prix.";
  if (item === "headless-frame-claim") return "Transfère le cadre remporté vers le matériel de votre équipe.";
  return "";
}
