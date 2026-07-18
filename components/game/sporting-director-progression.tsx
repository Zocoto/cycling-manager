import { calculateSportingDirectorProgression } from "../../lib/game/sporting-director-progression";

type SportingDirectorProgressionProps = {
  experiencePoints: number;
  compact?: boolean;
};

export function SportingDirectorProgression({
  experiencePoints,
  compact = false,
}: SportingDirectorProgressionProps) {
  const progression =
    calculateSportingDirectorProgression(
      experiencePoints
    );

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p
            className={
              compact
                ? "text-xs font-bold uppercase tracking-[0.12em] text-[#9FB5A8]"
                : "text-xs font-extrabold uppercase tracking-[0.16em] text-[#278B70]"
            }
          >
            Expérience
          </p>

          <p
            className={
              compact
                ? "mt-1 text-lg font-black text-[#FFFDF4]"
                : "mt-2 text-xl font-black text-[#183F37]"
            }
          >
            Niveau {progression.level}
          </p>
        </div>

        <p
          className={
            compact
              ? "text-sm font-bold text-[#BFD1C6]"
              : "text-sm font-bold text-[#48665F]"
          }
        >
          {progression.totalExperiencePoints} XP
        </p>
      </div>

      <div
        className={
          compact
            ? "mt-3 h-2.5 overflow-hidden rounded-full bg-white/15"
            : "mt-4 h-3 overflow-hidden rounded-full bg-[#D7E5DF]"
        }
      >
        <div
          className={
            compact
              ? "h-full rounded-full bg-[#F2C94C] transition-[width]"
              : "h-full rounded-full bg-[#42B99A] transition-[width]"
          }
          style={{
            width: `${progression.progressPercentage}%`,
          }}
          role="progressbar"
          aria-label={`Progression d’expérience vers le niveau ${
            progression.level + 1
          }`}
          aria-valuemin={0}
          aria-valuemax={
            progression.experienceRequiredForNextLevel
          }
          aria-valuenow={
            progression.experienceIntoLevel
          }
        />
      </div>

      <div
        className={
          compact
            ? "mt-2 flex justify-between gap-4 text-xs font-semibold text-[#9FB5A8]"
            : "mt-2 flex justify-between gap-4 text-xs font-semibold text-[#60756E]"
        }
      >
        <span>
          {progression.experienceIntoLevel} /{" "}
          {
            progression.experienceRequiredForNextLevel
          }{" "}
          XP
        </span>

        <span>
          Niveau {progression.level + 1}
        </span>
      </div>

      {!compact ? (
        <p className="mt-4 text-sm leading-6 text-[#60756E]">
          Votre Directeur Sportif gagnera de
          l’expérience au fil de sa carrière. Son niveau
          pourra plus tard débloquer des équipements,
          bâtiments et nouvelles possibilités de gestion.
        </p>
      ) : null}
    </div>
  );
}