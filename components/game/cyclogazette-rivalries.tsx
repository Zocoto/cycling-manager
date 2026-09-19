"use client";

import { useActionState } from "react";

import {
  sendRivalryTauntAction,
  type RivalryTauntActionState,
} from "@/app/jeu/gazette/actions";
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
              ? "Teams are paired from the previous season's final UCI ranking. New teams are placed afterwards by arrival date."
              : "Les équipes sont appariées selon le classement UCI final de la saison précédente. Les nouvelles équipes viennent ensuite, par date d’arrivée."
          }
        />
        <RuleBlock
          number="02"
          title={isEnglish ? "How is a point scored?" : "Comment marque-t-on ?"}
          body={
            isEnglish
              ? "A common race is worth one point. If both directors trade a taunt beforehand, that next direct confrontation is worth two."
              : "Une course commune vaut un point. Si les deux DS se lancent une pique, cette prochaine confrontation directe en vaut deux."
          }
        />
        <RuleBlock
          number="03"
          title={isEnglish ? "What can be won?" : "Quels gains ?"}
          body={
            isEnglish
              ? "The winner earns +20 reputation and €200k to €300k depending on intensity. The opponent receives +5 and €50k; a contested draw gives +10 and €100k to €150k each."
              : "Le vainqueur gagne +20 de réputation et 200 à 300 k€ selon l’intensité. Son adversaire reçoit +5 et 50 k€ ; une égalité disputée donne +10 et 100 à 150 k€ chacun."
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
  const projectedReward = getProjectedReward(rivalry, own, opponent);
  const momentum = getMomentum(rivalry, own.id, opponent.id, isEnglish);

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
            {own.previousRank && opponent.previousRank ? (
              <p className="mt-2 text-[10px] font-bold text-[#776A50]">
                {isEnglish ? "Previous season" : "Saison précédente"} : #{own.previousRank} / #{opponent.previousRank}
              </p>
            ) : null}
          </div>

          {!archive ? (
            <RivalryChallengePanel
              rivalry={rivalry}
              ownTeamId={own.id}
              isEnglish={isEnglish}
            />
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric
              label={isEnglish ? "Intensity" : "Intensité"}
              value={`${rivalry.intensity}`}
              detail={intensityLabel}
            />
            <Metric
              label={isEnglish ? "Reputation" : "Réputation"}
              value={`+${projectedReward.reputation}`}
              detail={rivalry.status === "active" ? (isEnglish ? "projected" : "projection") : (isEnglish ? "awarded" : "attribuée")}
            />
            <Metric
              label={isEnglish ? "Cash prize" : "Prime"}
              value={formatCash(projectedReward.cash, isEnglish)}
              detail={rivalry.status === "active" ? (isEnglish ? "projected" : "projection") : (isEnglish ? "awarded" : "attribuée")}
            />
            <Metric
              label={isEnglish ? "Momentum" : "Dynamique"}
              value={momentum.value}
              detail={momentum.detail}
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

const INITIAL_TAUNT_STATE: RivalryTauntActionState = {
  result: "idle",
  errorCode: null,
};

const TAUNT_OPTIONS = [
  {
    code: "scoreboard",
    fr: "Regardez bien le score : la prochaine ligne sera encore pour nous.",
    en: "Watch the score: the next line will belong to us again.",
  },
  {
    code: "road",
    fr: "La route départagera les discours. Préparez-vous à suivre.",
    en: "The road will settle the talk. Be ready to follow.",
  },
  {
    code: "pressure",
    fr: "Cette rivalité commence à peser. De notre côté, elle nous porte.",
    en: "This rivalry is starting to weigh. On our side, it drives us.",
  },
  {
    code: "appointment",
    fr: "Rendez-vous sur la prochaine course commune : nous ne laisserons aucun doute.",
    en: "See you at the next common race: we will leave no doubt.",
  },
] as const;

function RivalryChallengePanel({
  rivalry,
  ownTeamId,
  isEnglish,
}: {
  rivalry: TeamRivalry;
  ownTeamId: string;
  isEnglish: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    sendRivalryTauntAction,
    INITIAL_TAUNT_STATE,
  );
  const pendingTaunts = rivalry.taunts.filter((taunt) => !taunt.resolvedAt);
  const ownPending = pendingTaunts.find(
    (taunt) => taunt.senderTeamId === ownTeamId,
  );
  const rivalPending = pendingTaunts.find(
    (taunt) => taunt.senderTeamId !== ownTeamId,
  );
  const stakesArmed = Boolean(ownPending && rivalPending);

  return (
    <section className="mt-4 border border-[#A12742]/35 bg-[#F7E8DF] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A12742]">
            {isEnglish ? "Mind games" : "Guerre des mots"}
          </p>
          <h3 className="mt-1 font-serif text-lg font-black">
            {stakesArmed
              ? isEnglish ? "Next duel worth 2 points" : "Prochain duel à 2 points"
              : rivalPending
                ? isEnglish ? "Your rival is waiting" : "Votre rival attend une réponse"
                : ownPending
                  ? isEnglish ? "Challenge sent" : "Pique envoyée"
                  : isEnglish ? "Raise the stakes" : "Faire monter les enjeux"}
          </h3>
        </div>
        {stakesArmed ? (
          <span className="bg-[#A12742] px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
            ×2
          </span>
        ) : null}
      </div>

      {rivalPending ? (
        <blockquote className="mt-3 border-l-4 border-[#A12742] pl-3 font-serif text-sm font-semibold italic leading-5 text-[#514833]">
          « {formatTauntQuote(rivalPending.code, rivalPending.quote, isEnglish)} »
        </blockquote>
      ) : null}

      {!ownPending ? (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="rivalryId" value={rivalry.id} />
          <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#695D43]" htmlFor={`taunt-${rivalry.id}`}>
            {isEnglish ? "Choose a public statement" : "Choisir une déclaration publique"}
          </label>
          <select
            id={`taunt-${rivalry.id}`}
            name="tauntCode"
            defaultValue="appointment"
            className="w-full border border-[#8E7B55]/50 bg-[#FBF6E8] px-3 py-2 font-serif text-sm font-semibold"
          >
            {TAUNT_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {isEnglish ? option.en : option.fr}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#234E3F] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#A12742] disabled:cursor-wait disabled:opacity-60"
          >
            {pending
              ? isEnglish ? "Sending…" : "Envoi…"
              : rivalPending
                ? isEnglish ? "Reply and activate ×2" : "Répondre et activer le ×2"
                : isEnglish ? "Send the challenge" : "Lancer la pique"}
          </button>
        </form>
      ) : !stakesArmed ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-[#695D43]">
          {isEnglish
            ? "It adds 2 intensity points. The double-points stake activates only if your rival replies."
            : "Elle ajoute 2 points d’intensité. Le duel à deux points ne s’active que si votre rival répond."}
        </p>
      ) : null}

      {state.result === "success" ? (
        <p aria-live="polite" className="mt-3 text-xs font-black text-[#234E3F]">
          {isEnglish ? "Challenge published in the Gazette." : "Pique publiée dans la Gazette."}
        </p>
      ) : state.result === "failure" ? (
        <p aria-live="polite" className="mt-3 text-xs font-black text-[#A12742]">
          {state.errorCode === "pending"
            ? isEnglish ? "Your previous challenge is still pending." : "Votre précédente pique est toujours active."
            : isEnglish ? "The challenge could not be sent." : "La pique n’a pas pu être envoyée."}
        </p>
      ) : null}

      {rivalry.taunts.length > 0 ? (
        <div className="mt-4 border-t border-[#8E7B55]/35 pt-3">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#776A50]">
            {isEnglish ? "Latest statements" : "Dernières déclarations"}
          </p>
          <ul className="mt-2 space-y-2">
            {rivalry.taunts.slice(0, 3).map((taunt) => (
              <li key={taunt.id} className="font-serif text-xs font-semibold leading-4 text-[#514833]">
                <span className="font-black">
                  {taunt.senderTeamId === ownTeamId
                    ? isEnglish ? "You" : "Vous"
                    : isEnglish ? "Rival" : "Rival"}
                </span>{" "}— « {formatTauntQuote(taunt.code, taunt.quote, isEnglish)} »
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
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
  const rivalPoint = ownIsA ? event.teamBPoints : event.teamAPoints;
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
      ? `${winner} scores ${event.wasHeated ? "two points after the exchanged challenges" : "one point"}: its best rider finished ${formatRank(Math.min(ownRank, rivalRank), true)}, against ${formatRank(Math.max(ownRank, rivalRank), true)} for the rival.`
      : `${winner} marque ${event.wasHeated ? "deux points après l’échange de piques" : "un point"} : son meilleur coureur termine ${formatRank(Math.min(ownRank, rivalRank), false)}, contre ${formatRank(Math.max(ownRank, rivalRank), false)} pour son rival.`;

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
              ? isEnglish ? `+${ownPoint} for you` : `+${ownPoint} pour vous`
              : isEnglish ? `+${rivalPoint} for the rival` : `+${rivalPoint} pour le rival`}
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

function getProjectedReward(
  rivalry: TeamRivalry,
  own: TeamRivalry["teamA"],
  opponent: TeamRivalry["teamA"],
) {
  if (rivalry.status === "completed") {
    return {
      reputation: own.reputationDelta ?? 0,
      cash: own.cashReward ?? 0,
    };
  }
  if (rivalry.sharedRaces === 0) {
    return { reputation: 0, cash: 0 };
  }
  if (own.wins === opponent.wins) {
    return {
      reputation: 10,
      cash: 100_000 + Math.min(50_000, rivalry.intensity * 2_500),
    };
  }
  return own.wins > opponent.wins
    ? {
        reputation: 20,
        cash: 200_000 + Math.min(100_000, rivalry.intensity * 5_000),
      }
    : { reputation: 5, cash: 50_000 };
}

function getMomentum(
  rivalry: TeamRivalry,
  ownTeamId: string,
  opponentTeamId: string,
  isEnglish: boolean,
) {
  const firstWinner = rivalry.events.find((event) => event.winnerTeamId)?.winnerTeamId;
  if (!firstWinner) {
    return {
      value: "—",
      detail: isEnglish ? "no streak" : "aucune série",
    };
  }
  let streak = 0;
  for (const event of rivalry.events) {
    if (event.winnerTeamId !== firstWinner) break;
    streak += 1;
  }
  const isOwn = firstWinner === ownTeamId;
  const isRival = firstWinner === opponentTeamId;
  return {
    value: `${streak}`,
    detail: isOwn
      ? isEnglish ? "your streak" : "votre série"
      : isRival
        ? isEnglish ? "rival streak" : "série adverse"
        : isEnglish ? "consecutive" : "consécutive(s)",
  };
}

function formatCash(value: number, isEnglish: boolean) {
  return new Intl.NumberFormat(isEnglish ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTauntQuote(
  code: TeamRivalry["taunts"][number]["code"],
  fallback: string,
  isEnglish: boolean,
) {
  const option = TAUNT_OPTIONS.find((candidate) => candidate.code === code);
  return option ? (isEnglish ? option.en : option.fr) : fallback;
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
