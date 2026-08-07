import Image from "next/image";
import Link from "@/components/ui/app-link";
import type { ReactNode } from "react";

import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { CyclogazetteCommunityPanel } from "@/components/game/cyclogazette-community";
import type { CyclogazetteCommunity, CyclogazetteEdition, CyclogazetteTourSummary } from "@/lib/game/cyclogazette";
import type {
  PublicGameNewsItem,
  PublicGameNewsTeamVisual,
} from "@/lib/game/public-game-news";

export function CyclogazetteNewspaper({ edition, community }: { edition: CyclogazetteEdition; community?: CyclogazetteCommunity }) {
  const { lead, raceStories, raceHighlights, mercatoStories, reactions, tourSummaries = [] } =
    edition.content;
  const winnerStories = uniqueStories(
    [lead, ...raceStories].filter(
      (item): item is PublicGameNewsItem => item?.kind === "victory",
    ),
  );
  const secondaryRaceStories = raceStories.filter(
    (item) => !winnerStories.some((winner) => winner.id === item.id),
  );

  return (
    <article
      aria-label={`La Cyclogazette numéro ${edition.issueNumber}`}
      className="relative mx-auto max-w-[1380px] overflow-hidden border border-[#9A8A65]/40 bg-[#F4EBD2] text-[#241F18] shadow-[0_35px_100px_rgba(45,34,20,0.25)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 10%,rgba(255,255,255,.68),transparent 28%),repeating-linear-gradient(0deg,rgba(80,61,31,.022) 0,rgba(80,61,31,.022) 1px,transparent 1px,transparent 4px)",
      }}
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-[#806C45]/10 lg:block" />
      <header className="border-b-4 border-double border-[#241F18] px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#241F18]/45 py-2 text-[9px] font-black uppercase tracking-[0.2em] sm:text-[10px]">
          <span>Le journal quotidien du peloton</span>
          <span>Saison {edition.seasonName} · Jour {edition.dayNumber}</span>
          <span>{formatIssueDate(edition.issueDate)} · Édition de 20 h</span>
        </div>
        <div className="grid items-end gap-3 py-4 sm:grid-cols-[1fr_auto_1fr]">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#695D43] sm:block">
            Courses · Mercato · Coulisses
          </p>
          <h1 className="text-center font-serif text-5xl font-black leading-none tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            La Cyclogazette
          </h1>
          <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#A12742] sm:text-right">
            N° {edition.issueNumber}
          </p>
        </div>
        <p className="border-t border-[#241F18]/40 pt-3 text-center font-serif text-lg font-black italic sm:text-2xl">
          {edition.subtitle}
        </p>
      </header>

      <div className="grid gap-0 lg:grid-cols-12">
        <main className="border-b border-[#806C45]/35 p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          {lead ? <LeadStory item={lead} /> : <QuietNewsroom />}

          {winnerStories.length > 1 ? (
            <section className="mt-7 border-t-4 border-double border-[#241F18] pt-4">
              <SectionTitle eyebrow="Tableau d’honneur" title="Les vainqueurs du jour" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {winnerStories.slice(1).map((item) => (
                  <WinnerCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {tourSummaries.length > 0 ? <section className="mt-7 border-t-4 border-double border-[#241F18] pt-4"><SectionTitle eyebrow="Les maillots du jour" title="Le point sur les tours" /><div className="mt-4 grid gap-4 sm:grid-cols-2">{tourSummaries.map((tour) => <TourClassificationCard key={`${tour.raceName}:${tour.stageLabel}`} tour={tour} />)}</div></section> : null}

          {raceHighlights.length > 0 ? (
            <section className="mt-7 border-t-4 border-double border-[#241F18] pt-4">
              <SectionTitle
                eyebrow="En bref"
                title="Les faits de course"
              />
              <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
                {raceHighlights.map((item) => (
                  <NewsBrief key={item.id} item={item} showRaceEvent />
                ))}
              </div>
            </section>
          ) : null}

          {secondaryRaceStories.length > 0 ? (
            <section className="mt-7 border-t-4 border-double border-[#241F18] pt-4">
              <SectionTitle eyebrow="Sur les routes" title="Au fil des arrivées" />
              <div className="mt-4 columns-1 gap-6 sm:columns-2">
                {secondaryRaceStories.map((item) => (
                  <NewsBrief key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="p-5 sm:p-8 lg:col-span-4">
          <section className="border-2 border-[#241F18] p-4">
            <SectionTitle eyebrow="Après l’arrivée" title="Le micro aux DS" />
            <div className="mt-4 space-y-6">
              {reactions.length > 0 ? (
                reactions.map((reaction) => (
                  <article
                    key={reaction.interviewId}
                    className="border-t border-[#806C45]/30 pt-4 first:border-t-0 first:pt-0"
                  >
                    <p className="text-[10px] font-bold italic leading-4 text-[#695D43]">
                      {reaction.question}
                    </p>
                    <blockquote className="relative mt-2">
                      <span
                        aria-hidden="true"
                        className="absolute -left-1 -top-2 font-serif text-5xl leading-none text-[#A12742]/25"
                      >
                        “
                      </span>
                      <p className="relative pl-4 font-serif text-base font-bold leading-6">
                        {reaction.answer}
                      </p>
                    </blockquote>
                    <footer className="mt-3 flex items-center gap-3">
                      <SportingDirectorAvatar
                        avatarKey={reaction.directorAvatarKey}
                        size="small"
                        label={`Portrait de ${reaction.directorName}`}
                      />
                      <div>
                        <p className="text-xs font-black">{reaction.directorName}</p>
                        {reaction.isEditorial ? <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A12742]">{reaction.teamName}</p> : <Link href={`/jeu/equipes/${reaction.teamId}`} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A12742] hover:underline">{reaction.teamName}</Link>}
                        <p className="text-[10px] text-[#695D43]">
                          après {reaction.stageName}
                        </p>
                      </div>
                    </footer>
                    <details className="group mt-3 border border-[#806C45]/40 bg-[#E9DDBC]/40">
                      <summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#A12742] marker:hidden">
                        <span className="flex items-center justify-between gap-2">
                          Détail de l’interview
                          <span aria-hidden="true" className="text-base transition group-open:rotate-45">
                            +
                          </span>
                        </span>
                      </summary>
                      <div className="space-y-4 border-t border-[#806C45]/35 px-3 py-3">
                        {reaction.answers.map((answer) => (
                          <div key={`${reaction.interviewId}:${answer.questionId}`}>
                            <p className="text-[10px] font-bold italic leading-4 text-[#695D43]">
                              {answer.question}
                            </p>
                            <p className="mt-1 font-serif text-sm font-semibold leading-5">
                              {answer.answer}
                            </p>
                          </div>
                        ))}
                        {reaction.closingNote ? (
                          <div className="border-t border-[#806C45]/35 pt-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#A12742]">
                              Le dernier mot du DS
                            </p>
                            <p className="mt-1 font-serif text-sm italic">
                              {reaction.closingNote}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </article>
                ))
              ) : (
                <p className="font-serif text-sm italic text-[#695D43]">
                  Aucune déclaration n’est parvenue à la rédaction avant le bouclage.
                </p>
              )}
            </div>
          </section>

          <section className="mt-7">
            <SectionTitle eyebrow="Télégrammes" title="Le carnet du mercato" />
            <div className="mt-4 divide-y divide-[#806C45]/35 border-y border-[#806C45]/45">
              {mercatoStories.length > 0 ? (
                mercatoStories.map((item) => (
                  <NewsBrief key={item.id} item={item} compact />
                ))
              ) : (
                <p className="py-5 font-serif text-sm italic text-[#695D43]">
                  Le marché est resté calme aujourd’hui.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <aside className="mx-5 border-y-2 border-dashed border-[#806C45]/60 bg-[#E7D7B6]/55 px-5 py-4 text-center sm:mx-8"><p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#695D43]">Annonce partenaire</p><p className="mt-1 font-serif text-lg font-black">{edition.issueNumber % 2 === 0 ? "Roulez plus loin : les bidons Altitude gardent le frais jusqu’au sommet." : "Atelier Roue Libre · une révision offerte à chaque nouveau départ."}</p></aside>
      {community ? <CyclogazetteCommunityPanel editionId={edition.id} community={community} /> : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-double border-[#241F18] px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-[#695D43] sm:px-8">
        <span>La Cyclogazette · Toute l’actualité du monde de Cyclo Stratège</span>
        <span>Prochaine édition demain à 20 h</span>
      </footer>
    </article>
  );
}

function TourClassificationCard({ tour }: { tour: CyclogazetteTourSummary }) {
  return <section className="border-2 border-[#241F18] bg-[#EFE4C8]/75 p-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A12742]">Après {tour.stageLabel}</p><Link href={tour.href} className="mt-1 block font-serif text-xl font-black hover:text-[#A12742]">{tour.raceName}</Link>{tour.generalLeader ? <p className="mt-3 border-y border-[#806C45]/35 py-2 text-sm"><span className="font-black">Maillot jaune :</span> {tour.generalLeader}</p> : null}{tour.jerseys.length > 0 ? <ul className="mt-3 space-y-1 text-xs">{tour.jerseys.map((jersey) => <li key={`${jersey.label}:${jersey.holder}`}><span className="font-black">{jersey.label} :</span> {jersey.holder}</li>)}</ul> : <p className="mt-3 text-xs italic text-[#695D43]">Les classements se précisent après cette étape.</p>}</section>;
}

function LeadStory({ item }: { item: PublicGameNewsItem }) {
  const profile = item.visual?.raceProfile;
  const team = item.visual?.team;

  return (
    <section className="relative isolate overflow-hidden border border-[#806C45]/45 bg-[#EADDBE]/55 px-4 py-5 sm:px-6 sm:py-6">
      {profile?.length ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-12 -z-10 scale-110 opacity-[0.18]"
        >
          <RaceStageProfile segments={profile} compact />
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 opacity-20"
        style={{
          background: team
            ? `linear-gradient(125deg, ${team.colors.background}, transparent 58%, ${team.colors.primary}55)`
            : undefined,
        }}
      />

      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">
        La Une · La course d’abord
      </p>
      <StoryLink item={item} className="group block">
        <h2 className="mt-2 max-w-4xl font-serif text-4xl font-black leading-[0.95] tracking-[-0.035em] group-hover:text-[#A12742] sm:text-6xl">
          {item.title}
        </h2>
      </StoryLink>
      <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(190px,0.8fr)_1.2fr] sm:items-center">
        <div className="flex items-end justify-center gap-2 sm:justify-start">
          <NewsPortrait item={item} large />
          {team ? <WinningTeamJersey team={team} /> : null}
        </div>
        <div className="border-t border-[#241F18]/35 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p className="font-serif text-lg font-medium leading-7 first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-6xl first-letter:font-black first-letter:leading-[0.75]">
            {item.detail}
          </p>
          {team ? (
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em]">
              Maillot vainqueur · {team.name}
            </p>
          ) : null}
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#695D43]">
            {formatNewsTime(item.happenedAt)} · Par la rédaction
          </p>
        </div>
      </div>
    </section>
  );
}

function WinnerCard({ item }: { item: PublicGameNewsItem }) {
  return (
    <article className="group relative isolate min-h-44 overflow-hidden border border-[#806C45]/40 bg-[#EADDBE]/55 p-4">
      {item.visual?.raceProfile?.length ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-2 -z-10 opacity-[0.15]"
        >
          <RaceStageProfile segments={item.visual.raceProfile} compact />
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <NewsPortrait item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black uppercase tracking-[0.17em] text-[#A12742]">
            Victoire
          </p>
          <StoryLink item={item}>
            <h3 className="mt-1 font-serif text-xl font-black leading-5 group-hover:text-[#A12742]">
              {item.title}
            </h3>
          </StoryLink>
        </div>
        {item.visual?.team ? (
          <WinningTeamJersey team={item.visual.team} compact />
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-5 text-[#493F2E]">
        {item.detail}
      </p>
    </article>
  );
}

function WinningTeamJersey({
  team,
  compact = false,
}: {
  team: PublicGameNewsTeamVisual;
  compact?: boolean;
}) {
  const className = compact
    ? "h-16 w-14 object-contain drop-shadow-[0_8px_8px_rgba(36,31,24,.25)]"
    : "h-28 w-24 object-contain drop-shadow-[0_12px_12px_rgba(36,31,24,.28)] sm:h-32 sm:w-28";

  if (team.jerseyArtwork.kind === "sponsor") {
    return (
      <Image
        src={team.jerseyArtwork.imagePath}
        alt={`Maillot de ${team.name}`}
        width={600}
        height={750}
        sizes={compact ? "56px" : "112px"}
        className={className}
      />
    );
  }

  return (
    <AmateurTeamJersey
      jersey={team.jerseyArtwork.jersey}
      teamName={team.name}
      className={className}
    />
  );
}

function NewsBrief({
  item,
  compact = false,
  showRaceEvent = false,
}: {
  item: PublicGameNewsItem;
  compact?: boolean;
  showRaceEvent?: boolean;
}) {
  return (
    <article className={`${compact ? "py-4" : "mb-6 break-inside-avoid"}`}>
      <div className="flex items-start gap-3">
        <NewsPortrait item={item} />
        <div className="min-w-0">
          {showRaceEvent ? <RaceEventLabel item={item} /> : null}
          <StoryLink item={item} className="group">
            <h3 className={`${compact ? "text-lg" : "text-xl"} font-serif font-black leading-5 group-hover:text-[#A12742]`}>{item.title}</h3>
          </StoryLink>
          <p className="mt-2 text-sm font-medium leading-5 text-[#493F2E]">{item.detail}</p>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#7A6B4B]">{formatNewsTime(item.happenedAt)}</p>
        </div>
      </div>
    </article>
  );
}

function RaceEventLabel({ item }: { item: PublicGameNewsItem }) {
  const label =
    item.raceEventKind === "incident"
      ? "Incident de course"
      : item.raceEventKind === "breakaway"
        ? "Animateur"
        : "Classement";
  return (
    <p
      className={`mb-1 text-[8px] font-black uppercase tracking-[0.16em] ${
        item.raceEventKind === "incident"
          ? "text-[#A12742]"
          : "text-[#426D58]"
      }`}
    >
      {label}
    </p>
  );
}

function StoryLink({ item, className, children }: { item: PublicGameNewsItem; className?: string; children: ReactNode }) {
  return item.href ? <Link href={item.href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

function NewsPortrait({ item, large = false }: { item: PublicGameNewsItem; large?: boolean }) {
  const person = item.visual?.person;
  const sizeClass = large ? "h-28 w-28 sm:h-36 sm:w-36" : "h-14 w-14";
  if (!person) return null;
  if (person.kind === "director") {
    return <SportingDirectorAvatar avatarKey={person.avatarKey} size={large ? "large" : "small"} label={person.label} className="grayscale-[20%]" />;
  }
  return (
    <RiderAvatar
      profileKey={person.profileKey}
      seed={person.seed}
      jersey={item.visual?.team?.jersey}
      label={person.label}
      className={`${sizeClass} border-2 border-[#241F18]/25 grayscale-[12%]`}
    />
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A12742]">{eyebrow}</p>
      <h2 className="mt-1 border-b border-[#241F18] pb-2 font-serif text-2xl font-black leading-none">{title}</h2>
    </div>
  );
}

function QuietNewsroom() {
  return (
    <section className="py-12 text-center sm:py-20">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">Édition spéciale</p>
      <h2 className="mt-3 font-serif text-4xl font-black">Une journée de calme dans le peloton</h2>
      <p className="mx-auto mt-4 max-w-xl font-serif italic text-[#695D43]">La rédaction reste à l’affût. Les prochains résultats, signatures et réactions paraîtront dans l’édition suivante.</p>
    </section>
  );
}

function uniqueStories(items: PublicGameNewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function formatIssueDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(`${value}T12:00:00Z`));
}

function formatNewsTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value));
}
