import { formatTrophySeasons, type CareerTrophy } from "@/lib/game/trophy-gallery";

export function TrophySeasons({
  trophy,
  className,
}: {
  trophy: CareerTrophy;
  className: string;
}) {
  const seasons = (trophy.seasonNames ?? [trophy.seasonName]).join(", ");
  return (
    <span
      data-trophy-seasons
      className={className}
      aria-label={`Saisons ou éditions remportées : ${seasons}`}
      title={seasons}
    >
      {formatTrophySeasons(trophy)}
    </span>
  );
}
