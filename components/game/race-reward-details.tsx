import {
  calculateNationalChampionshipReward,
  calculateRaceReward,
  calculateStageReward,
  type RaceReward,
  type RaceRewardScope,
} from "@/lib/game/economy";
import type { RaceCalendarEdition } from "@/lib/game/race-calendar";

type RewardEdition = Pick<
  RaceCalendarEdition,
  | "categoryCode"
  | "categoryName"
  | "competitionType"
  | "raceFormat"
  | "stages"
>;

type RewardRange = {
  firstRank: number;
  lastRank: number;
  reward: RaceReward;
};

export function RaceRewardDetails({
  edition,
  tone = "light",
  compact = false,
  className = "",
}: {
  edition: RewardEdition;
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  const preview = buildRewardPreview(edition);
  const headline = preview.general[0];
  const isDark = tone === "dark";

  if (!headline) return null;

  return (
    <details
      className={`group overflow-hidden rounded-xl border ${
        isDark
          ? "border-white/12 bg-white/[0.06] text-white"
          : "border-[#315B3E]/12 bg-white text-[#0B302B] shadow-sm"
      } ${className}`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 px-4 ${
          compact ? "py-2.5" : "py-3"
        } transition marker:content-none [&::-webkit-details-marker]:hidden ${
          isDark ? "hover:bg-white/[0.05]" : "hover:bg-[#F3F8F5]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-black ${
            isDark
              ? "bg-[#F2C94C]/15 text-[#F7DA72]"
              : "bg-[#F2C94C]/20 text-[#775900]"
          }`}
        >
          €
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[9px] font-black uppercase tracking-[0.18em] ${
              isDark ? "text-[#9BE0BC]" : "text-[#278B70]"
            }`}
          >
            Dotations
          </span>
          <span
            className={`mt-0.5 block truncate text-[11px] font-bold ${
              isDark ? "text-[#D6DFD2]" : "text-[#5F766E]"
            }`}
          >
            Victoire · {formatRewardInline(headline.reward)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`text-sm transition group-open:rotate-180 ${
            isDark ? "text-[#9BE0BC]" : "text-[#688176]"
          }`}
        >
          ⌄
        </span>
      </summary>

      <div
        className={`border-t px-4 pb-4 pt-3 ${
          isDark
            ? "border-white/10 bg-black/10"
            : "border-[#315B3E]/10 bg-[#F8FBF9]"
        }`}
      >
        <p
          className={`text-[10px] font-bold ${
            isDark ? "text-[#BFD1C6]" : "text-[#688176]"
          }`}
        >
          {edition.categoryName} · {preview.formatLabel}
        </p>

        <div
          className={`mt-3 grid gap-4 ${
            preview.stage.length > 0 ? "lg:grid-cols-2" : ""
          }`}
        >
          <RewardTable
            title={preview.generalTitle}
            ranges={preview.general}
            isDark={isDark}
          />
          {preview.stage.length > 0 ? (
            <RewardTable
              title={
                preview.hasTeamTimeTrial
                  ? "Chaque étape · rang équipe en TTT"
                  : "Chaque étape"
              }
              ranges={preview.stage}
              isDark={isDark}
            />
          ) : null}
        </div>

        {preview.secondary || preview.prime ? (
          <div
            className={`mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 ${
              isDark ? "border-white/10" : "border-[#315B3E]/10"
            }`}
          >
            {preview.secondary ? (
              <RewardSupplement
                label="Classement annexe remporté"
                reward={preview.secondary}
                isDark={isDark}
              />
            ) : null}
            {preview.prime ? (
              <RewardSupplement
                label="GPM ou sprint intermédiaire"
                reward={preview.prime}
                isDark={isDark}
              />
            ) : null}
          </div>
        ) : null}

        <p
          className={`mt-3 text-[9px] font-semibold leading-4 ${
            isDark ? "text-[#9FB6AB]" : "text-[#789087]"
          }`}
        >
          Les primes d’étape et de parcours s’ajoutent au classement final.
          Les sommes sont versées à l’équipe ; l’expérience et les points au
          coureur.
          {preview.hasTeamTimeTrial ? (
            <>
              {" "}Exception en CLM par équipes : la place et tous les gains du
              barème sont attribués une seule fois à l’équipe.
            </>
          ) : null}
        </p>
      </div>
    </details>
  );
}

function RewardTable({
  title,
  ranges,
  isDark,
}: {
  title: string;
  ranges: RewardRange[];
  isDark: boolean;
}) {
  return (
    <section>
      <h3
        className={`text-[9px] font-black uppercase tracking-[0.16em] ${
          isDark ? "text-[#F7DA72]" : "text-[#7B5A00]"
        }`}
      >
        {title}
      </h3>
      <dl className="mt-1.5 space-y-1.5">
        {ranges.map((range) => (
          <div
            key={`${range.firstRank}-${range.lastRank}`}
            className="flex items-start justify-between gap-3 text-[10px]"
          >
            <dt
              className={`shrink-0 font-black ${
                isDark ? "text-white" : "text-[#173E35]"
              }`}
            >
              {formatRankRange(range)}
            </dt>
            <dd
              className={`text-right font-bold ${
                isDark ? "text-[#D6DFD2]" : "text-[#5F766E]"
              }`}
            >
              {formatRewardInline(range.reward)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RewardSupplement({
  label,
  reward,
  isDark,
}: {
  label: string;
  reward: RaceReward;
  isDark: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        isDark ? "bg-white/[0.06]" : "bg-white"
      }`}
    >
      <p
        className={`text-[9px] font-black uppercase tracking-wide ${
          isDark ? "text-[#9BE0BC]" : "text-[#278B70]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-[10px] font-bold ${
          isDark ? "text-[#D6DFD2]" : "text-[#5F766E]"
        }`}
      >
        {formatRewardInline(reward)}
      </p>
    </div>
  );
}

function buildRewardPreview(edition: RewardEdition) {
  if (edition.competitionType !== "standard") {
    return {
      generalTitle: "Classement final",
      formatLabel: "Championnat",
      general: groupRewardRanges(
        (rank) => calculateNationalChampionshipReward({ finalRank: rank }),
        10
      ),
      stage: [] as RewardRange[],
      secondary: null,
      prime: null,
      hasTeamTimeTrial: false,
    };
  }

  const scope = getRewardScope(edition);
  const rewardInput = {
    tier: edition.categoryCode,
    scope,
  } as const;
  const hasTeamTimeTrial = edition.stages.some(
    (stage) => stage.stageType === "team_time_trial",
  );

  return {
    generalTitle:
      edition.raceFormat === "one_day"
        ? "Classement"
        : "Classement général",
    formatLabel: getFormatLabel(scope),
    general: groupRewardRanges(
      (rank) => calculateRaceReward({ ...rewardInput, finalRank: rank }),
      50
    ),
    stage:
      edition.raceFormat === "stage_race"
        ? groupRewardRanges(
            (rank) =>
              calculateStageReward({
                tier: edition.categoryCode,
                finalRank: rank,
              }),
            20
          )
        : [],
    secondary: calculateRaceReward({
      ...rewardInput,
      finalRank: null,
      secondaryClassifications: ["mountain"],
    }),
    prime: calculateRaceReward({
      ...rewardInput,
      finalRank: null,
      mountainPrimesWon: 1,
    }),
    hasTeamTimeTrial,
  };
}

function getRewardScope(edition: RewardEdition): RaceRewardScope {
  if (edition.raceFormat === "one_day") return "one_day";
  return edition.categoryCode === "elite" && edition.stages.length >= 7
    ? "grand_tour"
    : "tour";
}

function getFormatLabel(scope: RaceRewardScope) {
  if (scope === "one_day") return "Course d’un jour";
  if (scope === "grand_tour") return "Grand tour";
  return "Course par étapes";
}

function groupRewardRanges(
  getReward: (rank: number) => RaceReward,
  maximumRank: number
) {
  const ranges: RewardRange[] = [];
  let firstRank = 1;
  let previousReward = getReward(1);

  for (let rank = 2; rank <= maximumRank + 1; rank += 1) {
    const reward =
      rank <= maximumRank ? getReward(rank) : emptyReward();
    if (sameReward(previousReward, reward)) continue;

    if (hasReward(previousReward)) {
      ranges.push({
        firstRank,
        lastRank: rank - 1,
        reward: previousReward,
      });
    }
    firstRank = rank;
    previousReward = reward;
  }

  return ranges;
}

function formatRankRange({ firstRank, lastRank }: RewardRange) {
  const first = formatRank(firstRank);
  return firstRank === lastRank ? first : `${first}–${formatRank(lastRank)}`;
}

function formatRank(rank: number) {
  return rank === 1 ? "1er" : `${rank}e`;
}

function formatRewardInline(reward: RaceReward) {
  return [
    reward.cashPrize > 0
      ? `${reward.cashPrize.toLocaleString("fr-FR")} €`
      : null,
    reward.uciPoints > 0
      ? `${reward.uciPoints.toLocaleString("fr-FR")} pts UCI`
      : null,
    reward.experience > 0
      ? `${reward.experience.toLocaleString("fr-FR")} XP`
      : null,
    reward.reputation > 0 ? `+${reward.reputation} rép.` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function hasReward(reward: RaceReward) {
  return (
    reward.reputation > 0 ||
    reward.experience > 0 ||
    reward.cashPrize > 0 ||
    reward.uciPoints > 0
  );
}

function sameReward(first: RaceReward, second: RaceReward) {
  return (
    first.reputation === second.reputation &&
    first.experience === second.experience &&
    first.cashPrize === second.cashPrize &&
    first.uciPoints === second.uciPoints
  );
}

function emptyReward(): RaceReward {
  return { reputation: 0, experience: 0, cashPrize: 0, uciPoints: 0 };
}
