import Link from "@/components/ui/app-link";
import type { ReactNode } from "react";

import { RiderAvatar } from "@/components/game/rider-avatar";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";
import type { PublicGameNewsItem } from "@/lib/game/public-game-news";

export function CyclogazetteNewspaper({ edition }: { edition: CyclogazetteEdition }) {
  const { lead, raceStories, mercatoStories, reactions } = edition.content;

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

          {raceStories.length > 0 ? (
            <section className="mt-7 border-t-4 border-double border-[#241F18] pt-4">
              <SectionTitle eyebrow="Sur les routes" title="Les courses du jour" />
              <div className="mt-4 columns-1 gap-6 sm:columns-2">
                {raceStories.map((item) => <NewsBrief key={item.id} item={item} />)}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="p-5 sm:p-8 lg:col-span-4">
          <SectionTitle eyebrow="Télégrammes" title="Le carnet du mercato" />
          <div className="mt-4 divide-y divide-[#806C45]/35 border-y border-[#806C45]/45">
            {mercatoStories.length > 0 ? mercatoStories.map((item) => (
              <NewsBrief key={item.id} item={item} compact />
            )) : (
              <p className="py-5 font-serif text-sm italic text-[#695D43]">Le marché est resté calme aujourd’hui.</p>
            )}
          </div>

          <section className="mt-7 border-2 border-[#241F18] p-4">
            <SectionTitle eyebrow="Après l’arrivée" title="Le micro aux DS" />
            <div className="mt-4 space-y-6">
              {reactions.length > 0 ? reactions.map((reaction) => (
                <blockquote key={reaction.interviewId} className="relative border-t border-[#806C45]/30 pt-4 first:border-t-0 first:pt-0">
                  <span aria-hidden="true" className="absolute -left-1 top-0 font-serif text-5xl leading-none text-[#A12742]/25">“</span>
                  <p className="relative pl-4 font-serif text-base font-bold leading-6">{reaction.answer}</p>
                  <footer className="mt-3 flex items-center gap-3">
                    <SportingDirectorAvatar avatarKey={reaction.directorAvatarKey} size="small" label={`Portrait de ${reaction.directorName}`} />
                    <div>
                      <p className="text-xs font-black">{reaction.directorName}</p>
                      <Link href={`/jeu/equipes/${reaction.teamId}`} className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A12742] hover:underline">
                        {reaction.teamName}
                      </Link>
                      <p className="text-[10px] text-[#695D43]">après {reaction.stageName}</p>
                    </div>
                  </footer>
                </blockquote>
              )) : (
                <p className="font-serif text-sm italic text-[#695D43]">Aucune déclaration n’est parvenue à la rédaction avant le bouclage.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-double border-[#241F18] px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-[#695D43] sm:px-8">
        <span>La Cyclogazette · Toute l’actualité du monde de Cyclo Stratège</span>
        <span>Prochaine édition demain à 20 h</span>
      </footer>
    </article>
  );
}

function LeadStory({ item }: { item: PublicGameNewsItem }) {
  return (
    <section>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">La une</p>
      <StoryLink item={item} className="group block">
        <h2 className="mt-2 max-w-4xl font-serif text-4xl font-black leading-[0.95] tracking-[-0.035em] group-hover:text-[#A12742] sm:text-6xl">
          {item.title}
        </h2>
      </StoryLink>
      <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
        <NewsPortrait item={item} large />
        <div>
          <p className="font-serif text-lg font-medium leading-7 first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-6xl first-letter:font-black first-letter:leading-[0.75]">
            {item.detail}
          </p>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#695D43]">
            {formatNewsTime(item.happenedAt)} · Par la rédaction
          </p>
        </div>
      </div>
    </section>
  );
}

function NewsBrief({ item, compact = false }: { item: PublicGameNewsItem; compact?: boolean }) {
  return (
    <article className={`${compact ? "py-4" : "mb-6 break-inside-avoid"}`}>
      <div className="flex items-start gap-3">
        <NewsPortrait item={item} />
        <div className="min-w-0">
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

function formatIssueDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(`${value}T12:00:00Z`));
}

function formatNewsTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(value));
}
