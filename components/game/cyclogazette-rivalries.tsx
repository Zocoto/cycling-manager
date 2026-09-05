"use client";

import Link from "@/components/ui/app-link";
import { useLocale } from "@/components/i18n/locale-provider";
import type {
  TeamRivalry,
  TeamRivalryEvent,
} from "@/services/team-rivalries";

export function CyclogazetteRivalries({
  rivalries,
}: {
  rivalries: TeamRivalry[];
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const active = rivalries.filter((rivalry) => rivalry.status === "active");
  const history = rivalries.filter((rivalry) => rivalry.status === "completed");

  return (
    <article
      data-cyclogazette-rivalries="true"
      className="mx-auto max-w-[1180px] border border-[#8E7B55]/55 bg-[#F4EBD2] text-[#241F18] shadow-[0_35px_100px_rgba(45,34,20,0.22)]"
    >
      <header className="border-b-4 border-double border-[#241F18] px-5 py-6 sm:px-9 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#A12742]">
              {isEnglish ? "The season serial" : "Le feuilleton de la saison"}
            </p>
            <h1 className="mt-2 font-serif text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              {isEnglish ? "Team rivalries" : "Rivalités d’équipes"}
            </h1>
          </div>
          <p className="max-w-md border-l-4 border-[#A12742] pl-4 font-serif text-sm font-semibold italic leading-6 text-[#695D43]">
            {isEnglish
              ? "The scorecard explains every point, every common race and the reputation at stake."
              : "La feuille de match explique chaque point, chaque course commune et la réputation en jeu."}
          </p>
        </div>
      </header>

      <section className="grid gap-5 border-b border-[#8E7B55]/45 px-5 py-6 sm:px-9 lg:grid-cols-3">
        <RuleBlock
          number="01"
          title={isEnglish ? "Why this rival?" : "Pourquoi ce rival ?"}
          body={
            isEnglish
              ? "Two human teams next to each other in the sporting order are paired when the rivalry is created."
              : "Deux équipes humaines voisines dans l’ordre sportif sont associées au moment de la création du duel."
          }
        />
        <RuleBlock
          number="02"
          title={isEnglish ? "How is a point scored?" : "Comment marque-t-on ?"}
          body={
            isEnglish
              ? "On every common race, the team whose best classified rider finishes highest scores one point. An equal rank is recorded as a draw."
              : "À chaque course commune, l’équipe dont le meilleur coureur classé termine le plus haut marque un point. Une même place vaut match nul."
          }
        />
        <RuleBlock
          number="03"
          title={isEnglish ? "What can be won?" : "Quels gains ?"}
          body={
            isEnglish
              ? "At season end: +6 reputation for the winner and +2 for the opponent; a draw gives +4 to each director."
              : "En fin de saison : +6 de réputation au vainqueur et +2 à son adversaire ; une égalité rapporte +4 à chaque DS."
          }
        />
      </section>

      <RivalryGroup
        title={isEnglish ? "Live scorecards" : "Feuilles de match en cours"}
        empty={
          isEnglish
            ? "No active rivalry for now. A duel will be created as soon as another human team is available."
            : "Aucune rivalité active pour le moment. Un duel sera créé dès qu’une autre équipe humaine sera disponible."
        }
        rivalries={active}
        isEnglish={isEnglish}
      />

      {history.length > 0 ? (
        <RivalryGroup
          title={isEnglish ? "Archives" : "Archives"}
          empty=""
          rivalries={history}
          isEnglish={isEnglish}
          archive
        />
      ) : null}
    </article>
  );
}

function RuleBlock({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  const { locale } = useLocale();
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#A12742]">
        {locale === "en" ? "Rule" : "Règle"} {number}
      </p>
      <h2 className="mt-1 font-serif text-xl font-black">{title}</h2>
      <p className="mt-2 font-serif text-sm font-medium leading-5 text-[#695D43]">
        {body}
      </p>
    </div>
  );
}

function RivalryGroup({
  title,
  empty,
  rivalries,
  isEnglish,
  archive = false,
}: {
  title: string;
  empty: string;
  rivalries: TeamRivalry[];
  isEnglish: boolean;
  archive?: boolean;
}) {
  return (
    <section className="px-5 py-7 sm:px-9">
      <h2 className="border-b-4 border-double border-[#241F18] pb-2 font-serif text-2xl font-black">
        {title}
      </h2>
      {rivalries.length ? (
        <div className="mt-5 space-y-7">
          {rivalries.map((rivalry) => (
            <RivalryDossier
              key={rivalry.id}
              rivalry={rivalry}
              isEnglish={isEnglish}
              archive={archive}
            />
          ))}
        </div>
      ) : (
        <p className="mt-5 border border-dashed border-[#8E7B55]/55 px-5 py-7 text-center font-serif text-sm italic text-[#695D43]">
          {empty}
        </p>
      )}
    </section>
  );
}

function RivalryDossier({
  rivalry,
  isEnglish,
  archive,
}: {
  rivalry: TeamRivalry;
  isEnglish: boolean;
  archive: boolean;
}) {
  const ownIsA = rivalry.ownTeamId === rivalry.teamA.id;
  const own = ownIsA ? rivalry.teamA : rivalry.teamB;
  const opponent = ownIsA ? rivalry.teamB : rivalry.teamA;
  const missingDetailedEvents = Math.max(
    0,
    rivalry.sharedRaces - rivalry.events.length,
  );
  const intensityLabel = rivalry.intensity >= 35
    ? isEnglish ? "heated" : "brûlante"
    : rivalry.intensity >= 15
      ? isEnglish ? "established" : "installée"
      : isEnglish ? "emerging" : "naissante";

  return (
    <article
      data-rivalry-dossier={rivalry.id}
      className={`border border-[#8E7B55]/50 bg-[#FBF6E8] ${archive ? "opacity-90" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8E7B55]/40 bg-[#E9DDBF] px-4 py-3 sm:px-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#695D43]">
          {rivalry.seasonName} · {rivalry.sharedRaces} {isEnglish ? "common races" : "courses communes"}
        </p>
        <span className="bg-[#A12742] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
          {rivalry.status === "active"
            ? isEnglish ? "Live" : "En cours"
            : isEnglish ? "Final" : "Terminé"}
        </span>
      </div>

      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <TeamIdentity team={own} label={isEnglish ? "Your team" : "Votre équipe"} />
            <div>
              <p className="font-serif text-4xl font-black tabular-nums">
                {own.wins}<span className="mx-2 text-[#9A8A65]">–</span>{opponent.wins}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#776A50]">
                {rivalry.draws} {isEnglish ? "draws" : "nuls"}
              </p>
            </div>
            <TeamIdentity team={opponent} label={isEnglish ? "Rival" : "Rival"} />
          </div>

          <div className="mt-5 border-y border-[#8E7B55]/35 py-4">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A12742]">
              {isEnglish ? "Origin of the rivalry" : "Origine de la rivalité"}
            </p>
            <p className="mt-2 font-serif text-sm font-semibold leading-5 text-[#514833]">
              {rivalry.pairingReason}
            </p>
            {own.pairingRank && opponent.pairingRank ? (
              <p className="mt-2 text-[10px] font-bold text-[#776A50]">
                {isEnglish ? "Pairing order" : "Ordre d’appariement"} : #{own.pairingRank} / #{opponent.pairingRank}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric
              label={isEnglish ? "Intensity" : "Intensité"}
              value={`${rivalry.intensity}`}
              detail={intensityLabel}
            />
            <Metric
              label={isEnglish ? "Reputation" : "Réputation"}
              value={formatOwnReward(rivalry, own, opponent)}
              detail={rivalry.status === "active" ? (isEnglish ? "projected" : "projection") : (isEnglish ? "awarded" : "attribuée")}
            />
          </div>
          <p className="mt-3 text-[10px] font-semibold leading-4 text-[#776A50]">
            {isEnglish
              ? "Intensity rises by 1 to 10 depending on how close the two best riders finish: the closer the ranks, the stronger the increase."
              : "L’intensité progresse de 1 à 10 selon l’écart entre les deux meilleurs coureurs : plus leurs places sont proches, plus elle augmente."}
          </p>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3 border-b-2 border-[#241F18] pb-2">
            <h3 className="font-serif text-xl font-black">
              {isEnglish ? "Point-by-point scorecard" : "Le score, point par point"}
            </h3>
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#A12742]">
              {rivalry.events.length} {isEnglish ? "detailed" : "détaillées"}
            </span>
          </div>
          {rivalry.events.length > 0 ? (
            <ol className="divide-y divide-[#8E7B55]/35">
              {rivalry.events.map((event) => (
                <RivalryEventLine
                  key={event.id}
                  event={event}
                  rivalry={rivalry}
                  ownIsA={ownIsA}
                  isEnglish={isEnglish}
                />
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center font-serif text-sm italic text-[#776A50]">
              {isEnglish
                ? "The first common finish will open the scorecard."
                : "La première arrivée commune ouvrira la feuille de match."}
            </p>
          )}
          {missingDetailedEvents > 0 ? (
            <p className="border-t border-[#8E7B55]/35 pt-3 text-[10px] font-semibold leading-4 text-[#776A50]">
              {isEnglish
                ? `${missingDetailedEvents} earlier confrontation(s) remain included in the total score; the point-by-point ledger starts with this update.`
                : `${missingDetailedEvents} confrontation(s) antérieure(s) restent incluses dans le score total ; le journal point par point démarre avec cette mise à jour.`}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TeamIdentity({
  team,
  label,
}: {
  team: TeamRivalry["teamA"];
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#776A50]">
        {label}
      </p>
      <Link
        href={`/jeu/equipes/${team.id}`}
        className="mt-1 block truncate font-serif text-sm font-black hover:text-[#A12742]"
      >
        {team.name}
      </Link>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#776A50]">
        {team.directorName}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-[#8E7B55]/35 bg-[#F4EBD2] p-3 text-center">
      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#776A50]">{label}</p>
      <p className="mt-1 font-serif text-2xl font-black">{value}</p>
      <p className="text-[9px] font-bold uppercase text-[#A12742]">{detail}</p>
    </div>
  );
}

function RivalryEventLine({
  event,
  rivalry,
  ownIsA,
  isEnglish,
}: {
  event: TeamRivalryEvent;
  rivalry: TeamRivalry;
  ownIsA: boolean;
  isEnglish: boolean;
}) {
  const ownRank = ownIsA ? event.teamARank : event.teamBRank;
  const rivalRank = ownIsA ? event.teamBRank : event.teamARank;
  const ownPoint = ownIsA ? event.teamAPoints : event.teamBPoints;
  const winner = event.winnerTeamId === rivalry.teamA.id
    ? rivalry.teamA.name
    : event.winnerTeamId === rivalry.teamB.id
      ? rivalry.teamB.name
      : null;
  const scoreAfter = ownIsA
    ? `${event.teamAScoreAfter}–${event.teamBScoreAfter}`
    : `${event.teamBScoreAfter}–${event.teamAScoreAfter}`;
  const explanation = event.isDraw
    ? isEnglish
      ? `Draw: both teams' best rider finished ${formatRank(ownRank, true)}. No point is awarded.`
      : `Match nul : le meilleur coureur de chaque équipe termine ${formatRank(ownRank, false)}. Aucun point n’est attribué.`
    : isEnglish
      ? `${winner} scores one point: its best rider finished ${formatRank(Math.min(ownRank, rivalRank), true)}, against ${formatRank(Math.max(ownRank, rivalRank), true)} for the rival.`
      : `${winner} marque un point : son meilleur coureur termine ${formatRank(Math.min(ownRank, rivalRank), false)}, contre ${formatRank(Math.max(ownRank, rivalRank), false)} pour son rival.`;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/jeu/courses/${event.raceSlug}`}
          className="font-serif text-sm font-black underline decoration-[#A12742]/45 underline-offset-2 hover:text-[#A12742]"
        >
          {event.raceName}
        </Link>
        <span className={`px-2 py-1 text-[9px] font-black uppercase ${ownPoint ? "bg-[#234E3F] text-white" : "bg-[#E9DDBF] text-[#695D43]"}`}>
          {event.isDraw
            ? isEnglish ? "Draw" : "Nul"
            : ownPoint
              ? isEnglish ? "+1 for you" : "+1 pour vous"
              : isEnglish ? "+1 for the rival" : "+1 pour le rival"}
        </span>
      </div>
      <p className="mt-2 font-serif text-xs font-semibold leading-5 text-[#514833]">
        {explanation}
      </p>
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#776A50]">
        {isEnglish ? "Score after the race" : "Score après la course"} {scoreAfter} · {isEnglish ? "Intensity" : "Intensité"} +{event.intensityDelta} → {event.intensityAfter}
      </p>
    </li>
  );
}

function formatOwnReward(
  rivalry: TeamRivalry,
  own: TeamRivalry["teamA"],
  opponent: TeamRivalry["teamA"],
) {
  if (rivalry.status === "completed") {
    return `${(own.reputationDelta ?? 0) >= 0 ? "+" : ""}${own.reputationDelta ?? 0}`;
  }
  if (own.wins === opponent.wins) return "+4";
  return own.wins > opponent.wins ? "+6" : "+2";
}

function formatRank(rank: number, isEnglish: boolean) {
  if (isEnglish) {
    const remainder = rank % 100;
    const suffix = remainder >= 11 && remainder <= 13
      ? "th"
      : rank % 10 === 1
        ? "st"
        : rank % 10 === 2
          ? "nd"
          : rank % 10 === 3
            ? "rd"
            : "th";
    return `${rank}${suffix}`;
  }
  return `${rank}${rank === 1 ? "er" : "e"}`;
}
