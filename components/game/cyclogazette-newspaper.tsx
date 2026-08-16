"use client";

import Image from "next/image";
import Link from "@/components/ui/app-link";
import type { CSSProperties, ReactNode } from "react";

import { AmateurTeamJersey } from "@/components/game/amateur-team-jersey";
import { RaceStageProfile } from "@/components/game/race-stage-profile";
import { RiderAvatar } from "@/components/game/rider-avatar";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { CyclogazetteCommunityPanel } from "@/components/game/cyclogazette-community";
import { isItalianGrandTourGazetteDay } from "@/lib/game/cyclogazette";
import type {
  CyclogazetteCommunity,
  CyclogazetteEdition,
  CyclogazetteReaction,
  CyclogazetteTourSummary,
} from "@/lib/game/cyclogazette";
import type {
  PublicGameNewsItem,
  PublicGameNewsTeamVisual,
} from "@/lib/game/public-game-news";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  localizeCyclogazetteText,
  localizePublicGameNewsItem,
} from "@/lib/i18n/cyclogazette-en";

type ItalianGazettaAdvertisement = {
  headline: string;
  copy: string;
};

type ItalianGazettaIncident = {
  title: string;
  copy: string;
};

const ITALIAN_GAZETTA_INCIDENTS: readonly ItalianGazettaIncident[] = [
  {
    title: "Le chat Coppi neutralise le peloton",
    copy: "Installé sur la ligne blanche, il a refusé de bouger sans parmesan. Quatre minutes d’arrêt et le prix de la combativité pour le chat.",
  },
  {
    title: "Un mécanicien gonfle un ravioli à huit bars",
    copy: "La confusion avec un boyau n’a été découverte qu’au contrôle technique. Le ravioli a tenu la pression et négocie déjà un contrat pour les pavés.",
  },
  {
    title: "Une attaque déclenchée par le mot « pasta »",
    copy: "La radio disait « resta », le coureur a compris « pasta ». Résultat : 38 secondes d’avance et une réservation pour quatre au sommet.",
  },
  {
    title: "Le bus des DS doublé par une Vespa",
    copy: "La Vespa transportait douze espressos dans un lacet. Les commissaires réclament désormais un contrôle moteur de la machine à café.",
  },
  {
    title: "Un sprinteur porte plainte contre la tour de Pise",
    copy: "Il juge la ligne d’arrivée « manifestement pas verticale ». Réclamation rejetée : la tour conserve la victoire à la photo-finish.",
  },
  {
    title: "Le classement général bouleversé par un tiramisù",
    copy: "Une deuxième part aurait été comptée comme bonification. Les commissaires ont mangé la preuve : enquête classée, assiettes léchées.",
  },
];

const ITALIAN_GAZETTA_INCIDENTS_EN: readonly ItalianGazettaIncident[] = [
  { title: "Coppi the cat neutralises the peloton", copy: "Sitting on the white line, he refused to move without parmesan. A four-minute stop and the combativity prize for the cat." },
  { title: "A mechanic inflates a raviolo to eight bars", copy: "The mix-up with a tubular tyre was discovered at inspection. The raviolo held its pressure and is already negotiating a cobbles contract." },
  { title: "An attack triggered by the word ‘pasta’", copy: "The radio said ‘resta’; the rider heard ‘pasta’. The result: a 38-second lead and a table for four at the summit." },
  { title: "The SD bus overtaken by a Vespa", copy: "The Vespa carried twelve espressos through a hairpin. Commissaires now demand a motor check on the coffee machine." },
  { title: "A sprinter files a complaint against the Leaning Tower", copy: "He considers the finish line ‘clearly not vertical’. Complaint rejected: the tower keeps its photo-finish victory." },
  { title: "The general classification overturned by a tiramisù", copy: "A second helping was allegedly counted as a time bonus. The commissaires ate the evidence: case closed, plates clean." },
];

export function CyclogazetteNewspaper({
  edition,
  community,
}: {
  edition: CyclogazetteEdition;
  community?: CyclogazetteCommunity;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const {
    lead,
    raceStories,
    raceHighlights,
    mercatoStories,
    reactions,
    tourSummaries = [],
    mediaArticles = [],
  } = edition.content;
  const winnerStories = uniqueStories(
    [lead, ...raceStories].filter(
      (item): item is PublicGameNewsItem => item?.kind === "victory",
    ),
  );
  const frontPageLead = winnerStories[0] ?? lead;
  const additionalWinners = winnerStories.filter(
    (winner) => winner.id !== frontPageLead?.id,
  );
  const secondaryRaceStories = raceStories.filter(
    (item) => !winnerStories.some((winner) => winner.id === item.id),
  );
  const roadStories = uniqueStories([
    ...raceHighlights,
    ...secondaryRaceStories,
  ]);
  const isItalianGrandTourEdition = isItalianGrandTourGazetteDay(
    edition.dayNumber,
  );
  const italianAdvertisement = getItalianGazettaAdvertisement(
    edition.issueNumber,
    isEnglish,
  );
  const italianIncidents = getItalianGazettaIncidents(
    edition.issueNumber,
    isEnglish,
  );
  const newspaperStyle = {
    "--gazette-paper": isItalianGrandTourEdition ? "#F2B8C6" : "#F4EBD2",
    "--gazette-feature": isItalianGrandTourEdition
      ? "rgba(255, 226, 233, 0.78)"
      : "rgba(234, 221, 190, 0.55)",
    "--gazette-card": isItalianGrandTourEdition
      ? "rgba(248, 208, 218, 0.8)"
      : "rgba(239, 228, 200, 0.72)",
    "--gazette-card-soft": isItalianGrandTourEdition
      ? "rgba(248, 208, 218, 0.64)"
      : "rgba(239, 228, 200, 0.6)",
    "--gazette-aside": isItalianGrandTourEdition
      ? "rgba(235, 157, 177, 0.36)"
      : "rgba(231, 215, 182, 0.55)",
    "--gazette-details": isItalianGrandTourEdition
      ? "rgba(251, 217, 225, 0.7)"
      : "rgba(233, 221, 188, 0.5)",
    "--gazette-input": isItalianGrandTourEdition ? "#FCE7EC" : "#F8F0DB",
    backgroundImage: isItalianGrandTourEdition
      ? "radial-gradient(circle at 18% 10%,rgba(255,255,255,.72),transparent 28%),repeating-linear-gradient(0deg,rgba(123,24,55,.028) 0,rgba(123,24,55,.028) 1px,transparent 1px,transparent 4px)"
      : "radial-gradient(circle at 18% 10%,rgba(255,255,255,.68),transparent 28%),repeating-linear-gradient(0deg,rgba(80,61,31,.022) 0,rgba(80,61,31,.022) 1px,transparent 1px,transparent 4px)",
  } as CSSProperties;

  return (
    <article
      aria-label={`${isItalianGrandTourEdition ? "Cyclo Gazetta" : isEnglish ? "The Cyclogazette" : "La Cyclogazette"} ${isEnglish ? "issue" : "numéro"} ${edition.issueNumber}`}
      data-gazette-theme={isItalianGrandTourEdition ? "giro" : "classic"}
      className="relative mx-auto max-w-[1380px] overflow-hidden border border-[#9A8A65]/40 bg-[var(--gazette-paper)] text-[#241F18] shadow-[0_35px_100px_rgba(45,34,20,0.25)]"
      style={newspaperStyle}
    >
      {isItalianGrandTourEdition ? (
        <div
          aria-hidden="true"
          data-gazetta-tricolore="true"
          className="grid h-2 grid-cols-3"
        >
          <span className="bg-[#009246]" />
          <span className="bg-[#F7F7F2]" />
          <span className="bg-[#CE2B37]" />
        </div>
      ) : null}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 hidden w-px bg-[#806C45]/10 lg:block"
      />
      <header className="border-b-4 border-double border-[#241F18] px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-[#241F18]/45 py-2 text-[9px] font-black uppercase tracking-[0.2em] sm:text-[10px]">
          <span>
            {isItalianGrandTourEdition
              ? "Edizione rosa · Il giornale del Giro"
              : isEnglish
                ? "The peloton's daily newspaper"
                : "Le journal quotidien du peloton"}
          </span>
          <span>
            {isEnglish ? "Season" : "Saison"} {edition.seasonName} · {isEnglish ? "Day" : "Jour"} {edition.dayNumber}
          </span>
          <span>{formatIssueDate(edition.issueDate, locale)} · {isEnglish ? "8 pm edition" : "Édition de 20 h"}</span>
        </div>
        <div className="grid items-end gap-3 py-4 sm:grid-cols-[1fr_auto_1fr]">
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#695D43] sm:block">
            {isEnglish ? "Racing · Transfers · Behind the scenes" : "Courses · Mercato · Coulisses"}
          </p>
          <h1 className="text-center font-serif text-5xl font-black leading-none tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            {isItalianGrandTourEdition ? "Cyclo Gazetta" : isEnglish ? "The Cyclogazette" : "La Cyclogazette"}
          </h1>
          <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-[#A12742] sm:text-right">
            {isItalianGrandTourEdition
              ? `Edizione rosa · N° ${edition.issueNumber}`
              : `N° ${edition.issueNumber}`}
          </p>
        </div>
        <p className="border-t border-[#241F18]/40 pt-3 text-center font-serif text-lg font-black italic sm:text-2xl">
          {localizeCyclogazetteText(edition.subtitle, locale)}
        </p>
      </header>

      <main className="border-b border-[#806C45]/35 p-5 sm:p-8">
        <section>
          <SectionTitle
            eyebrow={isEnglish ? "Front page" : "La Une"}
            title={isEnglish ? "Today's stage winners" : "Les vainqueurs des étapes"}
          />
          <div className="mt-4">
            {frontPageLead ? (
              <LeadStory item={frontPageLead} />
            ) : (
              <QuietNewsroom />
            )}
          </div>
          {additionalWinners.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-stretch gap-4">
              {additionalWinners.map((item) => (
                <div key={item.id} className="min-w-0 flex-[1_1_290px]">
                  <WinnerCard item={item} />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {tourSummaries.length > 0 ? (
          <section className="mt-8 border-t-4 border-double border-[#241F18] pt-5">
            <SectionTitle
              eyebrow={isEnglish ? "Today's jerseys" : "Les maillots du jour"}
              title={isEnglish ? "Stage-race round-up" : "Le point sur les tours"}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {tourSummaries.map((tour) => (
                <TourClassificationCard
                  key={`${tour.raceName}:${tour.stageLabel}`}
                  tour={tour}
                />
              ))}
            </div>
          </section>
        ) : null}

        {roadStories.length > 0 ? (
          <section className="mt-8 border-t-4 border-double border-[#241F18] pt-5">
            <SectionTitle
              eyebrow={isEnglish ? "Road warriors" : "Les forçats de la route"}
              title={isEnglish ? "The riders who made the race" : "Ceux qui ont animé la course"}
            />
            <p className="mt-3 max-w-4xl font-serif text-sm italic leading-5 text-[#695D43]">
              {isEnglish
                ? "Breakaway riders, chasers, caught-out contenders and tireless domestiques: our newsroom tells the stories behind the result."
                : "Échappés, chasseurs, coureurs piégés et équipiers infatigables : la rédaction raconte celles et ceux qui ont fait la course au-delà du résultat brut."}
            </p>
            <div className="mt-4 flex flex-wrap items-stretch gap-4">
              {roadStories.map((item) => (
                <NewsBrief
                  key={item.id}
                  item={item}
                  showRaceEvent
                  balancedCard
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 border-t-4 border-double border-[#241F18] pt-5">
          <SectionTitle
            eyebrow={isEnglish ? "After the finish" : "Après l’arrivée"}
            title={isEnglish ? "The microphone goes to the SDs" : "Le micro aux DS"}
          />
          {reactions.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-stretch gap-4">
              {reactions.map((reaction) => (
                <InterviewReactionCard
                  key={reaction.interviewId}
                  reaction={reaction}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 border-y border-[#806C45]/35 py-5 font-serif text-sm italic text-[#695D43]">
              {isEnglish
                ? "No statement reached the newsroom before the deadline."
                : "Aucune déclaration n’est parvenue à la rédaction avant le bouclage."}
            </p>
          )}
        </section>

        {mediaArticles.length > 0 ? (
          <section className="mt-8 border-t-4 border-double border-[#241F18] pt-5">
            <SectionTitle
              eyebrow={isEnglish ? "From the peloton" : "Les tribunes du peloton"}
              title={isEnglish ? "The teams have their say" : "La parole aux équipes"}
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {mediaArticles.map((article) => (
                <article
                  key={article.id}
                  className="border border-[#806C45]/45 bg-[var(--gazette-card)] p-5"
                >
                  <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#A12742]">
                    {isEnglish ? "Guest column" : "Carte blanche"} · {article.teamName}
                  </p>
                  <h3 className="mt-2 font-serif text-2xl font-black leading-6">
                    {article.title}
                  </h3>
                  <p className="mt-4 whitespace-pre-line font-serif text-sm font-medium leading-6 text-[#493F2E]">
                    {article.body}
                  </p>
                  <p className="mt-4 border-t border-[#806C45]/35 pt-3 text-[9px] font-black uppercase tracking-[.14em] text-[#695D43]">
                    {isEnglish ? "Column submitted by the SD" : "Tribune proposée par le DS"} · Media Center {isEnglish ? "L" : "N"}
                    {article.buildingLevel}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 border-t-4 border-double border-[#241F18] pt-5">
          <SectionTitle
            eyebrow={isEnglish ? "News in brief" : "Télégrammes"}
            title={isEnglish ? "Transfer notebook" : "Le carnet du mercato"}
          />
          {mercatoStories.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-stretch gap-4">
              {mercatoStories.map((item) => (
                <NewsBrief key={item.id} item={item} balancedCard />
              ))}
            </div>
          ) : (
            <p className="mt-4 border-y border-[#806C45]/35 py-5 font-serif text-sm italic text-[#695D43]">
              {isEnglish ? "The market remained quiet today." : "Le marché est resté calme aujourd’hui."}
            </p>
          )}
        </section>

        {isItalianGrandTourEdition ? (
          <ItalianGazettaChronicle incidents={italianIncidents} />
        ) : null}
      </main>

      <aside className="mx-5 border-y-2 border-dashed border-[#806C45]/60 bg-[var(--gazette-aside)] px-5 py-4 text-center sm:mx-8">
        <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#695D43]">
          {isItalianGrandTourEdition
            ? "Pubblicità italiana"
            : isEnglish
              ? "Partner message"
              : "Annonce partenaire"}
        </p>
        <p className="mt-1 font-serif text-lg font-black">
          {isItalianGrandTourEdition
            ? italianAdvertisement.headline
            : mediaArticles.find((article) => article.sponsorName)?.sponsorName
              ? isEnglish
                ? `${mediaArticles.find((article) => article.sponsorName)?.sponsorName} supports ${mediaArticles.find((article) => article.sponsorName)?.teamName}'s project.`
                : `${mediaArticles.find((article) => article.sponsorName)?.sponsorName} soutient le projet de ${mediaArticles.find((article) => article.sponsorName)?.teamName}.`
              : edition.issueNumber % 2 === 0
                ? isEnglish
                  ? "Ride further: Altitude bottles stay cool all the way to the summit."
                  : "Roulez plus loin : les bidons Altitude gardent le frais jusqu’au sommet."
                : isEnglish
                  ? "Roue Libre Workshop · one free service with every new beginning."
                  : "Atelier Roue Libre · une révision offerte à chaque nouveau départ."}
        </p>
        {isItalianGrandTourEdition ? (
          <p className="mx-auto mt-1 max-w-3xl font-serif text-sm italic text-[#695D43]">
            {italianAdvertisement.copy}
          </p>
        ) : null}
      </aside>
      {community ? (
        <CyclogazetteCommunityPanel
          editionId={edition.id}
          community={community}
        />
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-double border-[#241F18] px-5 py-3 text-[9px] font-bold uppercase tracking-[0.14em] text-[#695D43] sm:px-8">
        <span>
          {isItalianGrandTourEdition ? "Cyclo Gazetta" : isEnglish ? "The Cyclogazette" : "La Cyclogazette"} · {isEnglish ? "All the news from the world of Cyclo Stratège" : "Toute l’actualité du monde de Cyclo Stratège"}
        </span>
        <span>{isEnglish ? "Next edition tomorrow at 8 pm" : "Prochaine édition demain à 20 h"}</span>
      </footer>
    </article>
  );
}

function ItalianGazettaChronicle({
  incidents,
}: {
  incidents: readonly ItalianGazettaIncident[];
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <section
      data-gazetta-italian-chronicle="true"
      className="mt-8 border-t-4 border-double border-[#241F18] pt-5"
    >
      <SectionTitle
        eyebrow="Cronaca rosa"
        title={isEnglish ? "Transalpine news (almost verified)" : "Les faits divers transalpins (presque vérifiés)"}
      />
      <p className="mt-3 max-w-4xl font-serif text-sm italic leading-5 text-[#695D43]">
        {isEnglish
          ? "Our correspondent Mario Pressé swears it is all true. He also swears he did not borrow the broom wagon to deliver pizzas."
          : "Notre correspondant Mario Pressé jure que tout est vrai. Il jure aussi ne pas avoir emprunté la voiture-balai pour livrer des pizzas."}
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {incidents.map((incident, index) => (
          <article
            key={incident.title}
            className="border border-[#806C45]/45 bg-[var(--gazette-card)] p-4"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#A12742]">
              Ultimissima · {isEnglish ? "Brief" : "Brève"} n° {index + 1}
            </p>
            <h3 className="mt-2 font-serif text-xl font-black leading-5">
              {incident.title}
            </h3>
            <p className="mt-3 font-serif text-sm leading-5 text-[#493F2E]">
              {incident.copy}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function getItalianGazettaAdvertisement(
  issueNumber: number,
  isEnglish: boolean,
): ItalianGazettaAdvertisement {
  const rotation = Math.abs(Math.trunc(issueNumber)) % 3;
  if (rotation === 0) {
    return {
      headline: isEnglish ? "Pasta Passista · Penne that never crack on the final climb" : "Pasta Passista · Les penne qui ne craquent jamais dans le dernier col",
      copy: isEnglish ? "Cooking: 8 minutes. Attack: 7:59. Served al dente, just like the legs." : "Cuisson : 8 minutes. Attaque : 7 minutes 59. Servies al dente, comme les mollets.",
    };
  }
  if (rotation === 1) {
    return {
      headline: isEnglish ? "Tiramisù Domestique · Lifts you before the GC does" : "Tiramisù Domestique · Il vous remonte avant même le général",
      copy: isEnglish ? "Coffee, mascarpone and panache: tested by nine carers, confiscated by the tenth." : "Café, mascarpone et panache : testé par neuf soigneurs, confisqué par le dixième.",
    };
  }
  return {
    headline: isEnglish ? "Pizza a Ruota · The only four-cheese approved as a disc wheel" : "Pizza a Ruota · La seule quatre-fromages homologuée en roue pleine",
    copy: isEnglish ? "Delivered hot before the broom wagon. Extra basil, no UCI bonus seconds." : "Livrée chaude avant la voiture-balai. Supplément basilic, aucune bonification UCI.",
  };
}

function getItalianGazettaIncidents(issueNumber: number, isEnglish: boolean) {
  const incidents = isEnglish
    ? ITALIAN_GAZETTA_INCIDENTS_EN
    : ITALIAN_GAZETTA_INCIDENTS;
  return Math.abs(Math.trunc(issueNumber)) % 2 === 0
    ? incidents.slice(0, 3)
    : incidents.slice(3, 6);
}

function TourClassificationCard({ tour }: { tour: CyclogazetteTourSummary }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <section className="border-2 border-[#241F18] bg-[var(--gazette-card)] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#A12742]">
        {isEnglish ? "After" : "Après"} {tour.stageLabel}
      </p>
      <Link
        href={tour.href}
        className="mt-1 block font-serif text-xl font-black hover:text-[#A12742]"
      >
        {tour.raceName}
      </Link>
      {tour.generalLeader ? (
        <p className="mt-3 border-y border-[#806C45]/35 py-2 text-sm">
          <span className="font-black">{isEnglish ? "Yellow jersey" : "Maillot jaune"} :</span>{" "}
          {tour.generalLeader}
        </p>
      ) : null}
      {tour.jerseys.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {tour.jerseys.map((jersey) => (
            <li key={`${jersey.label}:${jersey.holder}`}>
              <span className="font-black">{localizeJerseyLabel(jersey.label, isEnglish)} :</span>{" "}
              {jersey.holder}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs italic text-[#695D43]">
          {isEnglish ? "The classifications are taking shape after this stage." : "Les classements se précisent après cette étape."}
        </p>
      )}
    </section>
  );
}

function LeadStory({ item }: { item: PublicGameNewsItem }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const localizedItem = localizePublicGameNewsItem(item, locale);
  const profile = localizedItem.visual?.raceProfile;
  const team = localizedItem.visual?.team;

  return (
    <section className="relative isolate overflow-hidden border border-[#806C45]/45 bg-[var(--gazette-feature)] px-4 py-5 sm:px-6 sm:py-6">
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

      <p className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">
        {isEnglish ? "Front-page winner" : "Vainqueur à la Une"}
      </p>
      <StoryLink item={localizedItem} className="group block">
        <h2 className="mx-auto mt-2 max-w-5xl text-center font-serif text-4xl font-black leading-[0.95] tracking-[-0.035em] group-hover:text-[#A12742] sm:text-6xl">
          {localizedItem.title}
        </h2>
      </StoryLink>
      <div className="mx-auto mt-6 grid max-w-5xl gap-5 sm:grid-cols-[minmax(190px,0.8fr)_1.2fr] sm:items-center">
        <div className="flex items-end justify-center gap-2">
          <NewsPortrait item={localizedItem} large />
          {team ? <WinningTeamJersey team={team} /> : null}
        </div>
        <div className="border-t border-[#241F18]/35 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p className="font-serif text-lg font-medium leading-7 first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-6xl first-letter:font-black first-letter:leading-[0.75]">
            {localizedItem.detail}
          </p>
          {team ? (
            <p className="mt-4 text-xs font-black uppercase tracking-[0.14em]">
              {isEnglish ? "Winning jersey" : "Maillot vainqueur"} · {team.name}
            </p>
          ) : null}
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#695D43]">
            {formatNewsTime(localizedItem.happenedAt, locale)} · {isEnglish ? "By the newsroom" : "Par la rédaction"}
          </p>
        </div>
      </div>
    </section>
  );
}

function WinnerCard({ item }: { item: PublicGameNewsItem }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const localizedItem = localizePublicGameNewsItem(item, locale);
  return (
    <article className="group relative isolate min-h-44 overflow-hidden border border-[#806C45]/40 bg-[var(--gazette-feature)] p-4">
      {localizedItem.visual?.raceProfile?.length ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-2 -z-10 opacity-[0.15]"
        >
          <RaceStageProfile segments={localizedItem.visual.raceProfile} compact />
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <NewsPortrait item={localizedItem} />
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black uppercase tracking-[0.17em] text-[#A12742]">
            {isEnglish ? "Victory" : "Victoire"}
          </p>
          <StoryLink item={localizedItem}>
            <h3 className="mt-1 font-serif text-xl font-black leading-5 group-hover:text-[#A12742]">
              {localizedItem.title}
            </h3>
          </StoryLink>
        </div>
        {localizedItem.visual?.team ? (
          <WinningTeamJersey team={localizedItem.visual.team} compact />
        ) : null}
      </div>
      <p className="mt-3 text-sm font-medium leading-5 text-[#493F2E]">
        {localizedItem.detail}
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
  const { locale } = useLocale();
  const className = compact
    ? "h-16 w-14 object-contain drop-shadow-[0_8px_8px_rgba(36,31,24,.25)]"
    : "h-28 w-24 object-contain drop-shadow-[0_12px_12px_rgba(36,31,24,.28)] sm:h-32 sm:w-28";

  if (team.jerseyArtwork.kind === "sponsor") {
    return (
      <Image
        src={team.jerseyArtwork.imagePath}
        alt={locale === "en" ? `${team.name} jersey` : `Maillot de ${team.name}`}
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

function InterviewReactionCard({
  reaction,
}: {
  reaction: CyclogazetteReaction;
}) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <article className="min-w-0 flex-[1_1_360px] border-2 border-[#241F18] bg-[var(--gazette-card)] p-4">
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
        <p data-i18n-skip className="relative pl-4 font-serif text-base font-bold leading-6">
          {reaction.answer}
        </p>
      </blockquote>
      <footer className="mt-3 flex items-center gap-3">
        <SportingDirectorAvatar
          avatarKey={reaction.directorAvatarKey}
          size="small"
          label={isEnglish ? `Portrait of ${reaction.directorName}` : `Portrait de ${reaction.directorName}`}
        />
        <div>
          <p className="text-xs font-black">{reaction.directorName}</p>
          <Link
            href={`/jeu/equipes/${reaction.teamId}`}
            className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A12742] hover:underline"
          >
            {reaction.teamName}
          </Link>
          <p className="text-[10px] text-[#695D43]">
            {isEnglish ? "after" : "après"} {reaction.stageName}
          </p>
        </div>
      </footer>
      <details className="group mt-3 border border-[#806C45]/40 bg-[var(--gazette-details)]">
        <summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#A12742] marker:hidden">
          <span className="flex items-center justify-between gap-2">
            {isEnglish ? "Full interview" : "Détail de l’interview"}
            <span
              aria-hidden="true"
              className="text-base transition group-open:rotate-45"
            >
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
              <p data-i18n-skip className="mt-1 font-serif text-sm font-semibold leading-5">
                {answer.answer}
              </p>
            </div>
          ))}
          {reaction.closingNote ? (
            <div className="border-t border-[#806C45]/35 pt-3">
              <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#A12742]">
                {isEnglish ? "The SD's final word" : "Le dernier mot du DS"}
              </p>
              <p data-i18n-skip className="mt-1 font-serif text-sm italic">
                {reaction.closingNote}
              </p>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function NewsBrief({
  item,
  compact = false,
  showRaceEvent = false,
  balancedCard = false,
}: {
  item: PublicGameNewsItem;
  compact?: boolean;
  showRaceEvent?: boolean;
  balancedCard?: boolean;
}) {
  const { locale } = useLocale();
  const localizedItem = localizePublicGameNewsItem(item, locale);
  return (
    <article
      className={
        balancedCard
          ? "min-w-0 flex-[1_1_290px] border border-[#806C45]/40 bg-[var(--gazette-card-soft)] p-4"
          : compact
            ? "py-4"
            : "mb-6 break-inside-avoid"
      }
    >
      <div className="flex items-start gap-3">
        <NewsPortrait item={localizedItem} />
        <div className="min-w-0">
          {showRaceEvent ? <RaceEventLabel item={localizedItem} /> : null}
          <StoryLink item={localizedItem} className="group">
            <h3
              className={`${compact ? "text-lg" : "text-xl"} font-serif font-black leading-5 group-hover:text-[#A12742]`}
            >
              {localizedItem.title}
            </h3>
          </StoryLink>
          <p className="mt-2 text-sm font-medium leading-5 text-[#493F2E]">
            {localizedItem.detail}
          </p>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#7A6B4B]">
            {formatNewsTime(localizedItem.happenedAt, locale)}
          </p>
        </div>
      </div>
    </article>
  );
}

function RaceEventLabel({ item }: { item: PublicGameNewsItem }) {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  const label =
    item.raceEventKind === "incident"
      ? isEnglish
        ? "Race incident"
        : "Incident de course"
      : item.raceEventKind === "breakaway"
        ? isEnglish
          ? "Breakaway rider"
          : "Animateur"
        : isEnglish
          ? "Classification"
          : "Classement";
  return (
    <p
      className={`mb-1 text-[8px] font-black uppercase tracking-[0.16em] ${
        item.raceEventKind === "incident" ? "text-[#A12742]" : "text-[#426D58]"
      }`}
    >
      {label}
    </p>
  );
}

function StoryLink({
  item,
  className,
  children,
}: {
  item: PublicGameNewsItem;
  className?: string;
  children: ReactNode;
}) {
  return item.href ? (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

function NewsPortrait({
  item,
  large = false,
}: {
  item: PublicGameNewsItem;
  large?: boolean;
}) {
  const person = item.visual?.person;
  const sizeClass = large ? "h-28 w-28 sm:h-36 sm:w-36" : "h-14 w-14";
  if (!person) return null;
  if (person.kind === "director") {
    return (
      <SportingDirectorAvatar
        avatarKey={person.avatarKey}
        size={large ? "large" : "small"}
        label={person.label}
        className="grayscale-[20%]"
      />
    );
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
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#A12742]">
        {eyebrow}
      </p>
      <h2 className="mt-1 border-b border-[#241F18] pb-2 font-serif text-2xl font-black leading-none">
        {title}
      </h2>
    </div>
  );
}

function QuietNewsroom() {
  const { locale } = useLocale();
  const isEnglish = locale === "en";
  return (
    <section className="py-12 text-center sm:py-20">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A12742]">
        {isEnglish ? "Special edition" : "Édition spéciale"}
      </p>
      <h2 className="mt-3 font-serif text-4xl font-black">
        {isEnglish ? "A quiet day in the peloton" : "Une journée de calme dans le peloton"}
      </h2>
      <p className="mx-auto mt-4 max-w-xl font-serif italic text-[#695D43]">
        {isEnglish
          ? "The newsroom remains on watch. The next results, signings and reactions will appear in the next edition."
          : "La rédaction reste à l’affût. Les prochains résultats, signatures et réactions paraîtront dans l’édition suivante."}
      </p>
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

function formatIssueDate(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatNewsTime(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function localizeJerseyLabel(label: string, isEnglish: boolean) {
  if (!isEnglish) return label;

  const labels: Readonly<Record<string, string>> = {
    "Maillot à pois": "Polka-dot jersey",
    "Maillot vert": "Green jersey",
    "Maillot blanc": "White jersey",
    "Classement équipes": "Team classification",
  };

  return labels[label] ?? label;
}
