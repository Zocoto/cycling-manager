"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import type {
  CareerPalmares,
  CareerPalmaresAchievement,
  CareerPalmaresCategory,
} from "@/lib/game/career-palmares";

const CATEGORY_ICON: Record<CareerPalmaresCategory, string> = {
  grand_tour_monument: "★",
  elite: "E",
  world: "◎",
  continental: "C",
  national: "N",
  regional: "R",
  junior: "J",
};

const MAX_VISIBLE_ACHIEVEMENTS = 8;

export function CareerPalmaresCard({
  palmares,
  tone = "rider",
  className = "",
}: {
  palmares: CareerPalmares;
  tone?: "rider" | "team";
  className?: string;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const isTeam = tone === "team";
  const numberFormatter = new Intl.NumberFormat(isEnglish ? "en-GB" : "fr-FR");
  const categoryLabels: Record<CareerPalmaresCategory, string> = isEnglish
    ? {
        grand_tour_monument: "Grand Tours & Monuments",
        elite: "Elite races",
        world: "World",
        continental: "Continental",
        national: "National",
        regional: "Regional",
        junior: "Junior",
      }
    : {
        grand_tour_monument: "Grands Tours & Monuments",
        elite: "Courses Élite",
        world: "Mondial",
        continental: "Continental",
        national: "National",
        regional: "Régional",
        junior: "Juniors",
      };

  return (
    <section
      className={`overflow-hidden rounded-[2rem] border bg-white shadow-[0_16px_45px_rgba(19,60,46,0.08)] ${
        isTeam ? "border-[var(--team-line)]" : "border-[#315B3E]/12"
      } ${className}`.trim()}
    >
      <header
        className="flex flex-col gap-5 px-6 py-6 text-white sm:flex-row sm:items-end sm:justify-between sm:px-8"
        style={{
          background: isTeam
            ? "linear-gradient(120deg, var(--team-primary), var(--team-secondary))"
            : "linear-gradient(120deg, #0B3029, #176951)",
        }}
      >
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/65">
            {isEnglish ? "Career record" : "Bilan de carrière"}
          </p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            {isEnglish ? "Honours" : "Palmarès"}
          </h2>
          <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-white/70 sm:text-sm">
            {isEnglish
              ? "Overall classifications only · podium results grouped by race and season."
              : "Classements généraux uniquement · podiums regroupés par course et par saison."}
          </p>
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-2">
          <PalmaresMetric
            label={isEnglish ? "Wins" : "Victoires"}
            value={numberFormatter.format(palmares.victoryCount)}
          />
          <PalmaresMetric
            label={isEnglish ? "Podiums" : "Podiums"}
            value={numberFormatter.format(palmares.podiumCount)}
          />
        </dl>
      </header>

      {palmares.sections.length ? (
        <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">
          {palmares.sections.map((section) => {
            const sectionPodiumCount = section.achievements.reduce(
              (total, achievement) => total + achievement.count,
              0,
            );
            const visibleAchievements = section.achievements.slice(
              0,
              MAX_VISIBLE_ACHIEVEMENTS,
            );
            const hiddenAchievements = section.achievements.slice(
              MAX_VISIBLE_ACHIEVEMENTS,
            );

            return (
              <article
                key={section.category}
                className={`self-start overflow-hidden rounded-2xl border ${
                  isTeam
                    ? "border-[var(--team-line)] bg-[var(--team-surface)]"
                    : "border-[#315B3E]/12 bg-[#F8FBF9]"
                }`}
              >
                <div
                  className={`flex items-center gap-3 border-b px-4 py-3 ${
                    isTeam
                      ? "border-[var(--team-line)]"
                      : "border-[#315B3E]/10"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${
                      isTeam
                        ? "bg-[var(--team-primary)] text-white"
                        : "bg-[#176951] text-white"
                    }`}
                  >
                    {CATEGORY_ICON[section.category]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-black ${
                        isTeam
                          ? "text-[var(--team-ink)]"
                          : "text-[#183F37]"
                      }`}
                    >
                      {categoryLabels[section.category]}
                    </h3>
                    <p
                      className={`mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${
                        isTeam
                          ? "text-[var(--team-muted)]"
                          : "text-[#60756E]"
                      }`}
                    >
                      {numberFormatter.format(sectionPodiumCount)}{" "}
                      {sectionPodiumCount === 1
                        ? isEnglish
                          ? "podium"
                          : "podium"
                        : isEnglish
                          ? "podiums"
                          : "podiums"}
                    </p>
                  </div>
                </div>

                <ul className="divide-y divide-[#315B3E]/8 px-4">
                  {visibleAchievements.map((achievement) => (
                    <PalmaresAchievementRow
                      key={achievement.id}
                      achievement={achievement}
                      isEnglish={isEnglish}
                      isTeam={isTeam}
                    />
                  ))}
                </ul>

                {hiddenAchievements.length ? (
                  <details
                    className={`group border-t ${
                      isTeam
                        ? "border-[var(--team-line)]"
                        : "border-[#315B3E]/10"
                    }`}
                  >
                    <summary
                      className={`flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black marker:hidden ${
                        isTeam
                          ? "text-[var(--team-secondary)]"
                          : "text-[#176951]"
                      }`}
                    >
                      <span>
                        {isEnglish
                          ? `Show ${hiddenAchievements.length} more`
                          : `Afficher ${hiddenAchievements.length} ${
                              hiddenAchievements.length === 1
                                ? "autre"
                                : "autres"
                            }`}
                      </span>
                      <span
                        aria-hidden="true"
                        className="transition group-open:rotate-180"
                      >
                        ⌄
                      </span>
                    </summary>
                    <ul className="divide-y divide-[#315B3E]/8 border-t border-[#315B3E]/8 px-4">
                      {hiddenAchievements.map((achievement) => (
                        <PalmaresAchievementRow
                          key={achievement.id}
                          achievement={achievement}
                          isEnglish={isEnglish}
                          isTeam={isTeam}
                        />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-9 text-center sm:px-8">
          <span
            aria-hidden="true"
            className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl text-xl ${
              isTeam
                ? "bg-[var(--team-soft)] text-[var(--team-secondary)]"
                : "bg-[#E5F4ED] text-[#176951]"
            }`}
          >
            ◇
          </span>
          <p
            className={`mt-4 text-sm font-bold ${
              isTeam ? "text-[var(--team-muted)]" : "text-[#60756E]"
            }`}
          >
            {isEnglish
              ? "No official overall podium has been recorded yet."
              : "Aucun podium officiel au classement général n’est encore enregistré."}
          </p>
        </div>
      )}
    </section>
  );
}

function PalmaresMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <dt className="text-[9px] font-black uppercase tracking-[0.12em] text-white/60">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-black text-white">{value}</dd>
    </div>
  );
}

function PalmaresAchievementRow({
  achievement,
  isEnglish,
  isTeam,
}: {
  achievement: CareerPalmaresAchievement;
  isEnglish: boolean;
  isTeam: boolean;
}) {
  const rankLabel = isEnglish
    ? achievement.rank === 1
      ? "1st"
      : achievement.rank === 2
        ? "2nd"
        : "3rd"
    : achievement.rank === 1
      ? "1er"
      : achievement.rank === 2
        ? "2e"
        : "3e";
  const rankClass =
    achievement.rank === 1
      ? "border-[#C49516]/30 bg-[#FFF2C4] text-[#745300]"
      : achievement.rank === 2
        ? "border-[#8C9AA4]/30 bg-[#EEF2F4] text-[#55636C]"
        : "border-[#AD7048]/30 bg-[#F8E4D6] text-[#78472B]";

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 inline-flex min-w-10 shrink-0 justify-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${rankClass}`}
      >
        {rankLabel}
      </span>
      <p
        className={`min-w-0 text-xs font-semibold leading-5 ${
          isTeam ? "text-[var(--team-muted)]" : "text-[#48665F]"
        }`}
      >
        <strong
          className={isTeam ? "text-[var(--team-ink)]" : "text-[#183F37]"}
        >
          {achievement.count} × {achievement.raceName}
        </strong>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className="whitespace-normal">
          {achievement.seasonLabels.join(", ")}
        </span>
      </p>
    </li>
  );
}
