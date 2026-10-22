import Image from "next/image";
import {
  getQuadrennialChampionLabel,
  QUADRENNIAL_CHAMPION_JERSEY,
  QUADRENNIAL_GAMES_EMBLEM,
  type QuadrennialChampionshipDiscipline,
} from "@/lib/game/quadrennial-games";

export function QuadrennialChampionJersey({ championshipType = "road", className = "h-64 w-56 drop-shadow-xl" }: {
  championshipType?: QuadrennialChampionshipDiscipline;
  className?: string;
}) {
  return <Image data-quadrennial-champion-jersey src={QUADRENNIAL_CHAMPION_JERSEY}
    width={900} height={902} sizes="(max-width: 640px) 160px, 224px"
    alt={getQuadrennialChampionLabel(championshipType)} className={`object-contain ${className}`} />;
}

export function QuadrennialGamesEmblem({ className = "h-auto w-40" }: { className?: string }) {
  return <Image src={QUADRENNIAL_GAMES_EMBLEM} width={900} height={305}
    sizes="(max-width: 640px) 160px, 224px" alt="Emblème des Jeux quadriennaux" className={`object-contain ${className}`} />;
}

export function QuadrennialChampionPrize({ championshipType, compact = false }: {
  championshipType?: QuadrennialChampionshipDiscipline;
  compact?: boolean;
}) {
  return <aside data-quadrennial-champion-prize className={`flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-[#DCC785]/50 bg-[linear-gradient(135deg,#FFFFFF,#F3F5F8)] text-[#102A36] sm:gap-4 ${compact ? "my-4 p-3 sm:px-5" : "mt-6 p-3 sm:p-5"}`}>
    <QuadrennialChampionJersey championshipType={championshipType} className={compact ? "h-20 w-20 shrink-0 drop-shadow-md sm:h-24 sm:w-24" : "h-24 w-24 shrink-0 drop-shadow-lg sm:h-36 sm:w-32"} />
    <div className="min-w-0">
      <QuadrennialGamesEmblem className="h-auto w-32 max-w-full sm:w-40" />
      <p className="mt-2 text-sm font-black sm:text-base">Le maillot du champion</p>
      <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-[#536777]">
        {championshipType === "road" ? "Le vainqueur de la course en ligne porte ce maillot jusqu’aux Jeux suivants."
          : championshipType === "time_trial" ? "Le vainqueur du contre-la-montre porte ce maillot jusqu’aux Jeux suivants."
            : "Deux titres, un maillot distinctif : les champions route et CLM le conservent jusqu’aux Jeux suivants."}
      </p>
    </div>
  </aside>;
}
