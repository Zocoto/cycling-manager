export function EquipmentRatingBonus({
  bonus,
  className = "",
}: {
  bonus: number | null | undefined;
  className?: string;
}) {
  const normalizedBonus = Number(bonus ?? 0);
  if (!Number.isFinite(normalizedBonus) || normalizedBonus <= 0) return null;

  const formattedBonus = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(normalizedBonus);

  return (
    <span
      aria-label={`Bonus équipement : +${formattedBonus}`}
      className={`ml-1 whitespace-nowrap font-black text-[#2E82C4] ${className}`.trim()}
    >
      +{formattedBonus}
    </span>
  );
}