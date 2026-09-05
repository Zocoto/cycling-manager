"use client";

import Link from "@/components/ui/app-link";
import { useLocale } from "@/components/i18n/locale-provider";
import type { SeasonAward } from "@/services/season-awards";

const AWARD_COPY: Record<
  SeasonAward["key"],
  { symbol: string; fr: { title: string; description: string }; en: { title: string; description: string } }
> = {
  rider_of_year: {
    symbol: "★",
    fr: { title: "Coureur de l’année", description: "La référence du peloton au classement individuel de la saison." },
    en: { title: "Rider of the year", description: "The season’s leading rider in the individual ranking." },
  },
  team_of_year: {
    symbol: "◆",
    fr: { title: "Équipe de l’année", description: "Le collectif qui termine la saison au sommet du classement UCI." },
    en: { title: "Team of the year", description: "The team that finishes the season at the top of the UCI ranking." },
  },
  serial_winner: {
    symbol: "✦",
    fr: { title: "Chasseur de bouquets", description: "Le coureur qui a levé les bras le plus souvent cette saison." },
    en: { title: "Serial winner", description: "The rider who raised their arms most often this season." },
  },
  young_rider: {
    symbol: "↗",
    fr: { title: "Révélation de l’année", description: "Le meilleur coureur de 23 ans ou moins au classement individuel." },
    en: { title: "Breakthrough rider", description: "The best rider aged 23 or under in the individual ranking." },
  },
  director_of_year: {
    symbol: "♟",
    fr: { title: "Directeur Sportif de l’année", description: "Le DS du meilleur collectif humain au terme de la saison." },
    en: { title: "Sporting Director of the year", description: "The sporting director of the season’s best human-managed team." },
  },
};

export function CyclogazetteAwards({
  awards,
  mode = "archive",
}: {
  awards: SeasonAward[];
  mode?: "archive" | "day-one";
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const groups = groupAwardsBySeason(awards);

  if (groups.length === 0) {
    return mode === "day-one" ? null : (
      <section className="mx-auto max-w-[1380px] border border-[#8B7956]/40 bg-[#F4EBD2] px-6 py-16 text-center shadow-[0_30px_80px_rgba(45,34,20,0.18)]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">
          {isEnglish ? "The jury is deliberating" : "Le jury délibère"}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-black">
          {isEnglish ? "The first ceremony is coming" : "La première cérémonie se prépare"}
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-serif text-base italic text-[#695D43]">
          {isEnglish ? "The honours will be published here after the first completed season." : "Les distinctions seront publiées ici dès la première saison terminée."}
        </p>
      </section>
    );
  }

  if (mode === "day-one") {
    const latest = groups[0];
    return (
      <section
        data-gazette-day-one-awards="true"
        className="border-b-4 border-double border-[var(--gazette-ink)] bg-[linear-gradient(135deg,#F6E8BD,#FFF9E7)] px-5 py-6 sm:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#A12742]">
              {isEnglish ? "Season-opening special" : "Spécial ouverture de saison"}
            </p>
            <h2 className="mt-1 font-serif text-3xl font-black leading-none text-[#2F2618] sm:text-4xl">
              {isEnglish ? "Last season’s honours" : "Le palmarès de la saison passée"}
            </h2>
          </div>
          <span className="border border-[#2F2618] px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#2F2618]">
            {latest.seasonName}
          </span>
        </div>
        <p className="mt-3 max-w-3xl font-serif text-sm italic leading-5 text-[#695D43]">
          {isEnglish ? "Before the new peloton sets off, the Cyclogazette honours the five figures who shaped the previous campaign." : "Avant que le nouveau peloton ne s’élance, La Cyclogazette célèbre les cinq figures qui ont marqué la campagne précédente."}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {latest.awards.map((award) => <AwardCard key={award.id} award={award} compact />)}
        </div>
        <Link href="/jeu/gazette?onglet=awards" className="mt-5 inline-flex border-b border-[#A12742] pb-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#A12742]">
          {isEnglish ? "Browse the complete roll of honour →" : "Consulter tout le palmarès →"}
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1380px] border border-[#8B7956]/40 bg-[#F4EBD2] px-5 py-7 text-[#241F18] shadow-[0_35px_100px_rgba(45,34,20,0.2)] sm:px-8 sm:py-10">
      <header className="border-y-4 border-double border-[#241F18] py-5 text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#A12742]">
          {isEnglish ? "The Cyclogazette roll of honour" : "Le palmarès de La Cyclogazette"}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-black tracking-[-0.04em] sm:text-6xl">
          {isEnglish ? "Peloton Awards" : "Awards du peloton"}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl font-serif text-sm italic leading-6 text-[#695D43]">
          {isEnglish ? "Five season-ending honours for the riders, teams and sporting directors who wrote the year’s story." : "Cinq distinctions de fin de saison pour les coureurs, les équipes et les Directeurs Sportifs qui ont écrit l’année."}
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.seasonId} className="mt-8 border-t border-[#806C45]/40 pt-5 first:border-t-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A12742]">
                {isEnglish ? "Official honours" : "Distinctions officielles"}
              </p>
              <h2 className="mt-1 font-serif text-3xl font-black">{group.seasonName}</h2>
            </div>
            <span className="font-serif text-xl font-black text-[#806C45]">{group.gameYear}</span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.awards.map((award) => <AwardCard key={award.id} award={award} />)}
          </div>
        </section>
      ))}
    </section>
  );
}

function AwardCard({ award, compact = false }: { award: SeasonAward; compact?: boolean }) {
  const { locale } = useLocale();
  const copy = AWARD_COPY[award.key][locale];
  const href = award.riderId
    ? `/jeu/coureurs/${award.riderId}`
    : award.teamId
      ? `/jeu/equipes/${award.teamId}`
      : null;
  const recipient = <span className={`${compact ? "text-sm" : "text-lg"} font-black text-[#2F2618]`}>{award.recipientName}</span>;

  return (
    <article className={`border border-[#806C45]/35 bg-[#FFF9E7] ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#A12742]">{copy.title}</p>
          <div className="mt-1 truncate">{href ? <Link href={href} className="hover:underline">{recipient}</Link> : recipient}</div>
        </div>
        <span aria-hidden="true" className={`${compact ? "text-xl" : "text-2xl"} font-black text-[#9A711F]`}>{AWARD_COPY[award.key].symbol}</span>
      </div>
      {!compact ? <p className="mt-3 font-serif text-xs italic leading-5 text-[#695D43]">{copy.description}</p> : null}
      {award.teamName && award.teamName !== award.recipientName ? <p className="mt-1 truncate text-[9px] font-bold text-[#806C45]">{award.teamName}</p> : null}
      {award.statValue !== null && award.statLabel ? <p className={`${compact ? "mt-2 text-[9px]" : "mt-4 border-t border-[#806C45]/25 pt-3 text-xs"} font-black uppercase tracking-[0.1em] text-[#9A711F]`}>{award.statValue.toLocaleString(locale === "en" ? "en-GB" : "fr-FR")} {award.statLabel}</p> : null}
    </article>
  );
}

function groupAwardsBySeason(awards: SeasonAward[]) {
  const groups = new Map<string, { seasonId: string; seasonName: string; gameYear: number; awards: SeasonAward[] }>();
  for (const award of awards) {
    const group = groups.get(award.seasonId) ?? { seasonId: award.seasonId, seasonName: award.seasonName, gameYear: award.gameYear, awards: [] };
    group.awards.push(award);
    groups.set(award.seasonId, group);
  }
  return [...groups.values()].sort((left, right) => right.gameYear - left.gameYear);
}
