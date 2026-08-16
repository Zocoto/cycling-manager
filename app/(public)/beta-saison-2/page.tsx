import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { appConfig } from "@/lib/app-config";
import {
  buildMarketingHref,
  readMarketingAttribution,
  type MarketingSearchParams,
} from "@/lib/marketing/attribution";

export const metadata: Metadata = {
  title: "Saison 2 – Bêta test",
  description:
    "La Saison 2 de Cyclo Stratège ouvre le bêta test. Créez votre équipe, développez vos coureurs et aidez-nous à éprouver le jeu de management cycliste en ligne.",
  alternates: {
    canonical: "/beta-saison-2",
  },
  openGraph: {
    type: "website",
    url: "/beta-saison-2",
    title: "Cyclo Stratège Saison 2 – La bêta est ouverte",
    description:
      "Prenez la direction de votre équipe cycliste et participez à la nouvelle phase de bêta test.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cyclo Stratège Saison 2 – La bêta est ouverte",
    description:
      "Rejoignez la Saison 2 du jeu de management cycliste en ligne.",
  },
};

const highlights = [
  {
    number: "01",
    title: "Bâtissez votre équipe",
    description:
      "Recrutez vos coureurs, développez les jeunes talents et entourez-vous du staff adapté à votre projet.",
  },
  {
    number: "02",
    title: "Préparez chaque course",
    description:
      "Gérez la forme, le matériel, les rôles et les tactiques qui feront la différence au moment décisif.",
  },
  {
    number: "03",
    title: "Écrivez votre histoire",
    description:
      "Progressez au fil des saisons, développez vos infrastructures et inscrivez votre équipe au palmarès.",
  },
] as const;

const betaGoals = [
  "Accueillir davantage de directeurs sportifs et observer le jeu à plus grande échelle.",
  "Affiner l’équilibrage des carrières, des courses et de l’économie.",
  "Repérer les points de friction et améliorer la prise en main.",
  "Construire les prochaines évolutions à partir des retours des joueurs.",
] as const;

const frequentlyAskedQuestions = [
  {
    question: "Qu’est-ce que le bêta test de la Saison 2 ?",
    answer:
      "C’est une nouvelle étape du développement de Cyclo Stratège. Le jeu est accessible, mais continue d’évoluer grâce aux tests, aux données de jeu et aux retours de la communauté.",
  },
  {
    question: "Comment rejoindre la Saison 2 ?",
    answer:
      "Créez votre compte, confirmez votre adresse e-mail puis suivez le parcours de découverte pour prendre la direction de votre première équipe.",
  },
  {
    question: "Faut-il télécharger le jeu ?",
    answer:
      "Non. Cyclo Stratège se joue directement dans un navigateur récent, sur ordinateur comme sur mobile.",
  },
  {
    question: "Où transmettre un bug ou une suggestion ?",
    answer:
      "Le serveur Discord rassemble les signalements, les idées et les discussions avec les autres directeurs sportifs.",
  },
] as const;

export default async function SeasonTwoBetaPage({
  searchParams,
}: {
  searchParams: Promise<MarketingSearchParams>;
}) {
  const incomingAttribution = readMarketingAttribution(await searchParams);
  const registrationHref = buildMarketingHref("/inscription", {
    utm_source: "site",
    utm_medium: "owned",
    utm_campaign: "saison2_beta",
    utm_content: "landing_page",
    ...incomingAttribution,
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Cyclo Stratège Saison 2 – Bêta test",
    url: `${appConfig.siteUrl}/beta-saison-2`,
    description: metadata.description,
    inLanguage: "fr-FR",
    isPartOf: {
      "@id": `${appConfig.siteUrl}/#website`,
    },
    about: {
      "@id": `${appConfig.siteUrl}/#game`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <SeasonHero registrationHref={registrationHref} />
      <SeasonHighlights />
      <BetaMission registrationHref={registrationHref} />
      <BetaFaq />
      <FinalCallToAction registrationHref={registrationHref} />
    </>
  );
}

function SeasonHero({ registrationHref }: { registrationHref: string }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#071A17]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(214,223,210,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(214,223,210,0.05)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-10 top-24 select-none font-black text-[18rem] leading-none tracking-[-0.12em] text-transparent opacity-35 [-webkit-text-stroke:3px_#42CDA8] sm:right-8 sm:text-[28rem]"
      >
        02
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,transparent,#071A17)]"
      />

      <div className="relative mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#F2C94C] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#071A17]">
              Saison 2
            </span>
            <span className="rounded-full border border-[#8DE3C9]/45 bg-[#0B302B]/80 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#8DE3C9] backdrop-blur">
              Bêta ouverte
            </span>
          </div>

          <h1 className="mt-7 text-5xl font-black leading-[0.92] tracking-[-0.045em] text-[#FFFDF4] sm:text-6xl lg:text-7xl">
            Prenez la tête
            <span className="mt-2 block text-[#8DE3C9]">
              d’un nouveau peloton.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#D6DFD2] sm:text-xl">
            Cyclo Stratège entre en bêta test. Créez votre équipe,
            prenez vos décisions de directeur sportif et contribuez à
            façonner la suite du jeu.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href={registrationHref}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] shadow-[0_14px_35px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
            >
              Rejoindre la Saison 2
              <ArrowIcon />
            </Link>

            <Link
              href="/guide"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#8DE3C9]/45 bg-[#071A17]/65 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#FFFDF4] backdrop-blur transition hover:border-[#F2C94C] hover:text-[#F2C94C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3C9]"
            >
              Découvrir le jeu
            </Link>
          </div>

          <p className="mt-5 text-sm font-semibold text-[#AFC0B1]">
            Jouable directement dans votre navigateur · Aucun téléchargement
          </p>
        </div>
      </div>
    </section>
  );
}

function SeasonHighlights() {
  return (
    <section className="bg-[#F7FAF7] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#278B70]">
            Votre carrière
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Chaque décision construit votre légende.
          </h2>
          <p className="mt-5 text-lg leading-8 text-[#536B64]">
            De la détection d’un jeune talent à la stratégie d’une grande
            course, vous pilotez le projet sportif dans sa durée.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {highlights.map((highlight) => (
            <article
              key={highlight.number}
              className="relative overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white p-7 shadow-[0_18px_45px_rgba(19,60,46,0.1)]"
            >
              <span className="text-5xl font-black text-[#42CDA8]/30">
                {highlight.number}
              </span>
              <h3 className="mt-5 text-2xl font-black">
                {highlight.title}
              </h3>
              <p className="mt-4 leading-7 text-[#536B64]">
                {highlight.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BetaMission({ registrationHref }: { registrationHref: string }) {
  return (
    <section className="bg-[#0B302B] px-5 py-16 text-[#FFFDF4] sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#8DE3C9]">
            Pourquoi une bêta ?
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Construire la suite avec le peloton.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D6DFD2]">
            Cette phase doit éprouver Cyclo Stratège avec davantage de
            joueurs et transformer les retours concrets en améliorations
            utiles.
          </p>

          <ul className="mt-8 space-y-4">
            {betaGoals.map((goal) => (
              <li key={goal} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#42CDA8] text-sm font-black text-[#07302A]"
                >
                  ✓
                </span>
                <span className="leading-7 text-[#E6ECE7]">{goal}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-3xl border border-[#8DE3C9]/25 bg-[#071A17] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.3)] sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F2C94C]">
            Votre première étape
          </p>
          <h3 className="mt-4 text-3xl font-black">
            Créez votre identité de directeur sportif.
          </h3>
          <p className="mt-4 leading-7 text-[#BFD1C6]">
            Après confirmation de votre e-mail, le parcours de découverte
            vous accompagne jusqu’à votre première équipe et votre premier
            critérium.
          </p>
          <Link
            href={registrationHref}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
          >
            Créer ma carrière
            <ArrowIcon />
          </Link>
          <a
            href={appConfig.discordUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-white/15 px-6 py-3 text-sm font-black text-[#8DE3C9] transition hover:border-[#8DE3C9]/55 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8DE3C9]"
          >
            Rejoindre le Discord
          </a>
        </aside>
      </div>
    </section>
  );
}

function BetaFaq() {
  return (
    <section className="bg-[#EAF5F3] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#278B70]">
            Questions fréquentes
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Avant de prendre le départ
          </h2>
        </div>

        <div className="mt-10 space-y-4">
          {frequentlyAskedQuestions.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-[#315B3E]/15 bg-white px-5 py-4 shadow-sm sm:px-7"
              open={index === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black marker:content-none">
                {item.question}
                <span
                  aria-hidden="true"
                  className="text-xl text-[#278B70] transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-3xl leading-7 text-[#536B64]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction({
  registrationHref,
}: {
  registrationHref: string;
}) {
  return (
    <section className="bg-[#F7FAF7] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[#315B3E]/15 bg-[#F2C94C] px-6 py-10 text-center shadow-[0_24px_60px_rgba(49,91,62,0.18)] sm:px-12 sm:py-14">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-[#315B3E]">
          Saison 2 · Bêta test
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
          Le prochain directeur sportif attendu, c’est vous.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#315B3E]">
          Rejoignez le peloton, lancez votre carrière et aidez-nous à rendre
          Cyclo Stratège encore meilleur.
        </p>
        <Link
          href={registrationHref}
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#071A17] px-7 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#FFFDF4] transition hover:-translate-y-0.5 hover:bg-[#123F37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
        >
          Rejoindre la bêta
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 10h13" />
      <path d="m11 5 5 5-5 5" />
    </svg>
  );
}
