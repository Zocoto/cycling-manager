type SportingDirectorReputationProps = {
  reputationPoints: number;
  compact?: boolean;
};

type ReputationProgress = {
  level: number;
  pointsIntoLevel: number;
  pointsRequiredForLevel: number;
  progressPercentage: number;
};

export function SportingDirectorReputation({
  reputationPoints,
  compact = false,
}: SportingDirectorReputationProps) {
  const safeReputationPoints = Math.max(
    0,
    Math.floor(reputationPoints)
  );

  const reputation = calculateReputationProgress(
    safeReputationPoints
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
            Réputation
          </p>

          <p
            className={
              compact
                ? "mt-1 text-lg font-black text-[#FFFDF4]"
                : "mt-2 text-xl font-black text-[#183F37]"
            }
          >
            Niveau {reputation.level}
          </p>
        </div>

        <p
          className={
            compact
              ? "text-sm font-bold text-[#BFD1C6]"
              : "text-sm font-bold text-[#48665F]"
          }
        >
          {safeReputationPoints} points
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
            width: `${reputation.progressPercentage}%`,
          }}
          role="progressbar"
          aria-label={`Progression de réputation vers le niveau ${
            reputation.level + 1
          }`}
          aria-valuemin={0}
          aria-valuemax={
            reputation.pointsRequiredForLevel
          }
          aria-valuenow={reputation.pointsIntoLevel}
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
          {reputation.pointsIntoLevel} /{" "}
          {reputation.pointsRequiredForLevel}
        </span>

        <span>Niveau {reputation.level + 1}</span>
      </div>

      {!compact ? (
        <p className="mt-4 text-sm leading-6 text-[#60756E]">
          Votre réputation progressera grâce aux objectifs, aux
          résultats en course et aux réussites de votre
          carrière.
        </p>
      ) : null}
    </div>
  );
}

function calculateReputationProgress(
  reputationPoints: number
): ReputationProgress {
  let level = 0;
  let currentLevelThreshold = 0;
  let pointsRequiredForLevel =
    getPointsRequiredForNextLevel(level);

  while (
    reputationPoints >=
    currentLevelThreshold + pointsRequiredForLevel
  ) {
    currentLevelThreshold += pointsRequiredForLevel;
    level += 1;
    pointsRequiredForLevel =
      getPointsRequiredForNextLevel(level);
  }

  const pointsIntoLevel =
    reputationPoints - currentLevelThreshold;

  const progressPercentage = Math.min(
    100,
    Math.max(
      0,
      (pointsIntoLevel / pointsRequiredForLevel) * 100
    )
  );

  return {
    level,
    pointsIntoLevel,
    pointsRequiredForLevel,
    progressPercentage,
  };
}

function getPointsRequiredForNextLevel(
  currentLevel: number
): number {
  return 100 + currentLevel * 50;
}