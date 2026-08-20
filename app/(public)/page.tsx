import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/app-link";

import { PublicGameNewsBoard } from "@/components/public/public-game-news-board";
import { InstallAppBanner } from "@/components/pwa/install-app-banner";
import { getPublicGameNews } from "@/services/public-game-news";
import { getRequestLocale } from "@/lib/i18n/server";
import type { AppLocale } from "@/lib/i18n/config";

export const revalidate = 60;

export const metadata: Metadata = {
  title: {
    absolute: "Cyclo Stratège – Jeu de management cycliste en ligne",
  },
  description:
    "Devenez directeur sportif dans Cyclo Stratège : recrutez vos coureurs, développez votre équipe et affrontez la Saison 2 du jeu de management cycliste en ligne.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "Cyclo Stratège – Jeu de management cycliste en ligne",
    description:
      "Prenez la direction de votre équipe cycliste. La Saison 2 ouvre le bêta test de Cyclo Stratège.",
  },
};

const gamePillars = [
  {
    icon: "team",
    title: "Gérez votre équipe",
    description:
      "Recrutez, entraînez et développez vos coureurs. Construisez un collectif capable de briller toute la saison.",
    linkLabel: "Découvrir la gestion",
    backgroundPosition: "42% center",
  },
  {
    icon: "strategy",
    title: "Planifiez votre stratégie",
    description:
      "Analysez les profils, adaptez vos tactiques et prenez les bonnes décisions au moment décisif.",
    linkLabel: "Préparer les courses",
    backgroundPosition: "66% center",
  },
  {
    icon: "trophy",
    title: "Vivez la légende",
    description:
      "Remportez les plus grandes épreuves et inscrivez durablement votre équipe dans l’histoire du cyclisme.",
    linkLabel: "Écrire votre histoire",
    backgroundPosition: "82% center",
  },
] as const;

const gamePillarsEn = [
  {
    icon: "team",
    title: "Manage your team",
    description:
      "Recruit, train and develop your riders. Build a squad capable of shining throughout the season.",
    linkLabel: "Discover team management",
    backgroundPosition: "42% center",
  },
  {
    icon: "strategy",
    title: "Plan your strategy",
    description:
      "Analyze race profiles, adapt your tactics and make the right decisions at the decisive moment.",
    linkLabel: "Prepare your races",
    backgroundPosition: "66% center",
  },
  {
    icon: "trophy",
    title: "Create a legacy",
    description:
      "Win the greatest races and write your team's name permanently into cycling history.",
    linkLabel: "Write your story",
    backgroundPosition: "82% center",
  },
] as const;

const productNews = [
  {
    category: "Saison 2",
    title: "La saison 2 ouvre le bêta test",
    description:
      "Cyclo Stratège entre en bêta test avec un objectif clair : accueillir davantage de directeurs sportifs et éprouver le concept avec un volume de joueurs plus important.",
    dateTime: "2026-08-16",
    dateLabel: "16 août 2026",
    accent: "leader",
    href: "/inscription",
    linkLabel: "Rejoindre la saison 2",
    image: "/images/marketing/season-2-beta-editorial.png",
    imageAlt: "Annonce graphique de la Saison 2 de Cyclo Stratège",
    visualLabel: "Saison",
    visualValue: "2",
    visualStatus: "Bêta test",
  },
  {
    category: "Mise \u00e0 jour",
    title: "Le Patch 4 d\u00e9veloppe vos infrastructures",
    description:
      "Le centre d\u2019entra\u00eenement s\u2019\u00e9toffe et sept installations sp\u00e9cialis\u00e9es ouvrent de nouvelles possibilit\u00e9s pour pr\u00e9parer, r\u00e9cup\u00e9rer, rechercher et faire rayonner votre \u00e9quipe.",
    dateTime: "2026-08-12",
    dateLabel: "12 ao\u00fbt 2026",
    accent: "leader",
    href: "/nouveautes#patch-4",
    linkLabel: "Voir le d\u00e9tail du Patch 4",
    image: "/images/infrastructure/training-center.webp",
    imageAlt: "Le centre d\u2019entra\u00eenement de l\u2019\u00e9quipe",
    patchNumber: 4,
  },
  {
    category: "Mise à jour",
    title: "Le Patch 3 est déployé",
    description:
      "Cette troisième livraison enrichit la course et le quotidien du directeur sportif : Cyclogazette, interviews d’après-course, minijeux juniors revus, gestion du matériel, plans d’entraînement groupés et de nombreuses améliorations d’interface, de performance et d’équilibrage.",
    dateTime: "2026-08-01",
    dateLabel: "1er août 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Voir le détail du Patch 3",
  },
  {
    category: "Mise à jour",
    title: "Le Patch 2 est déployé",
    description:
      "De nouvelles fonctionnalités, des interfaces affinées, des équilibrages de gameplay et de nombreux correctifs sont arrivés en production.",
    dateTime: "2026-07-28",
    dateLabel: "28 juillet 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Voir le détail du Patch 2",
  },
  {
    category: "Mise à jour",
    title: "Le Patch 1 pose les premières fondations",
    description:
      "Parcours de jeu consolidés, courses et matériel enrichis, progression affinée et identité visuelle des coureurs harmonisée.",
    dateTime: "2026-07-26",
    dateLabel: "26 juillet 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Voir le détail du Patch 1",
  },
  {
    category: "Développement",
    title: "MVP déployé, pré-alpha lancée",
    description:
      "La première version de Cyclo Stratège est en ligne. La phase pré-alpha commence et le jeu va désormais évoluer au fil des tests et de vos retours.",
    dateTime: "2026-07-26",
    dateLabel: "26 juillet 2026",
    accent: "leader",
  },
  {
    category: "Communauté",
    title: "Le Discord ouvre ses portes",
    description:
      "Un espace pour signaler les bugs, partager vos idées et échanger avec nous autour de l’application.",
    dateTime: "2026-07-26",
    dateLabel: "26 juillet 2026",
    accent: "mint",
    href: "https://discord.gg/tz4EA3e2b",
    linkLabel: "Rejoindre le Discord",
  },
] as const;

const productNewsEn = [
  {
    category: "Season 2",
    title: "Season 2 opens the beta test",
    description:
      "Cyclo Stratège enters beta with a clear goal: welcome more Sports Directors and test the concept with a larger player base.",
    dateTime: "2026-08-16",
    dateLabel: "16 August 2026",
    accent: "leader",
    href: "/inscription",
    linkLabel: "Join Season 2",
    image: "/images/marketing/season-2-beta-editorial-en.png",
    imageAlt: "Cyclo Stratège Season 2 beta announcement",
    visualLabel: "Season",
    visualValue: "2",
    visualStatus: "Beta test",
  },
  {
    category: "Update",
    title: "Patch 4 expands your infrastructure",
    description:
      "The training centre grows with seven specialist facilities for preparation, recovery, research and team development.",
    dateTime: "2026-08-12",
    dateLabel: "12 August 2026",
    accent: "leader",
    href: "/nouveautes#patch-4",
    linkLabel: "Read the Patch 4 notes",
    image: "/images/infrastructure/training-center.webp",
    imageAlt: "The team training centre",
    patchNumber: 4,
  },
  {
    category: "Update",
    title: "Patch 3 is live",
    description:
      "Cyclogazette, post-race interviews, revised junior minigames, equipment management, group training plans and many interface, performance and balance improvements.",
    dateTime: "2026-08-01",
    dateLabel: "1 August 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Read the Patch 3 notes",
  },
  {
    category: "Update",
    title: "Patch 2 is live",
    description:
      "New features, refined interfaces, gameplay balancing and numerous fixes have reached production.",
    dateTime: "2026-07-28",
    dateLabel: "28 July 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Read the Patch 2 notes",
  },
  {
    category: "Update",
    title: "Patch 1 lays the first foundations",
    description:
      "Consolidated game flows, richer racing and equipment, refined progression and consistent rider visuals.",
    dateTime: "2026-07-26",
    dateLabel: "26 July 2026",
    accent: "leader",
    href: "https://discord.com/channels/1530228791857909891/1530867588093968544",
    linkLabel: "Read the Patch 1 notes",
  },
  {
    category: "Development",
    title: "MVP deployed, pre-alpha launched",
    description:
      "The first Cyclo Stratège version is online. The pre-alpha begins and the game will evolve through testing and player feedback.",
    dateTime: "2026-07-26",
    dateLabel: "26 July 2026",
    accent: "leader",
  },
  {
    category: "Community",
    title: "Discord opens its doors",
    description:
      "A place to report bugs, share ideas and talk with us about the game.",
    dateTime: "2026-07-26",
    dateLabel: "26 July 2026",
    accent: "mint",
    href: "https://discord.gg/tz4EA3e2b",
    linkLabel: "Join Discord",
  },
] as const;

export default async function HomePage() {
  const locale = await getRequestLocale();
  const gameNews = await getPublicGameNews();

  return (
    <>
      <InstallAppBanner />
      <HeroSection locale={locale} />
      <PublicGameNewsBoard snapshot={gameNews} />
      <CareerSection locale={locale} />
    </>
  );
}

function HeroSection({ locale }: { locale: AppLocale }) {
  const isEnglish = locale === "en";
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3]">
      <Image
        aria-hidden="true"
        src="/images/peloton-header.webp"
        alt=""
        fill
        preload
        fetchPriority="high"
        sizes="100vw"
        className="object-cover object-[68%_center]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.97) 31%, rgba(236,247,242,0.76) 52%, rgba(7,26,23,0.10) 78%, rgba(7,26,23,0.18) 100%)",
        }}
      />

      <HeroMountainLines />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(247,250,247,0) 25%, rgba(247,250,247,0.25) 55%, rgba(247,250,247,0.6) 75%, rgba(247,250,247,0.85) 88%, rgba(247,250,247,1) 100%)",
        }}
      />

      <div className="relative mx-auto min-h-150 max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-[#278B70] sm:text-sm">
          {isEnglish ? "Online cycling game" : "jeu de cyclisme en ligne"}
        </p>
        <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.045em] text-[#082A2A] sm:text-6xl lg:text-7xl">
          {isEnglish ? "Lead" : "Prenez la tête"}
          <span className="mt-2 block text-[#42B99A]">
            {isEnglish ? "the peloton." : "du peloton."}
          </span>
        </h1>

        <ProductNews locale={locale} />
      </div>
    </section>
  );
}

function ProductNews({ locale }: { locale: AppLocale }) {
  const isEnglish = locale === "en";
  const [featuredNews, ...historicalNews] = isEnglish
    ? productNewsEn
    : productNews;

  return (
    <section className="mt-10 w-full" aria-labelledby="product-news-title">
      <div className="flex items-center gap-3">
        <h2
          id="product-news-title"
          className="shrink-0 text-xs font-black uppercase tracking-[0.2em] text-[#278B70]"
        >
          {isEnglish ? "Game news" : "News du jeu"}
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-[#315B3E]/20" />
      </div>

      <article className="relative mt-4 overflow-hidden rounded-2xl border border-[#8DE3C9]/25 bg-[#082A2A] p-6 text-[#FFFDF4] shadow-[0_24px_65px_rgba(7,26,23,0.28)] sm:p-8">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5 bg-[#F2C94C]"
        />
        <span
          aria-hidden="true"
          className="absolute -right-18 -top-24 h-72 w-72 rounded-full border-[50px] border-[#42CDA8]/10"
        />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#8DE3C9]">
                {featuredNews.category}
              </span>
              <span aria-hidden="true" className="text-[#F2C94C]">
                ·
              </span>
              <time
                dateTime={featuredNews.dateTime}
                className="text-sm font-semibold text-[#D6DFD2]"
              >
                {featuredNews.dateLabel}
              </time>
            </div>

            <h3 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              {featuredNews.title}
            </h3>
            <p className="mt-4 max-w-4xl text-base leading-7 text-[#D6DFD2] sm:text-lg">
              {featuredNews.description}
            </p>

            <Link
              href={featuredNews.href}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#F2C94C] px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
            >
              {featuredNews.linkLabel}
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="relative min-h-56 overflow-hidden rounded-2xl border border-[#8DE3C9]/25 bg-white/[0.06] shadow-xl">
            <Image
              src={featuredNews.image}
              alt={featuredNews.imageAlt}
              fill
              sizes="(min-width: 1024px) 18rem, 100vw"
              className="object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-[#071A17] via-[#071A17]/20 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 text-right">
              <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#8DE3C9]">
                {featuredNews.visualLabel}
              </span>
              <strong className="mt-1 block text-5xl font-black leading-none text-[#F2C94C]">
                {featuredNews.visualValue}
              </strong>
              <span className="mt-2 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#D6DFD2]">
                {featuredNews.visualStatus}
              </span>
            </div>
          </div>
        </div>
      </article>

      <ol className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {historicalNews.slice(0, 4).map((news) => (
          <li key={news.title}>
            <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-[#315B3E]/15 bg-white/88 p-5 shadow-[0_12px_35px_rgba(19,60,46,0.11)] backdrop-blur-sm">
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${
                  news.accent === "leader" ? "bg-[#F2C94C]" : "bg-[#42CDA8]"
                }`}
              />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#278B70]">
                  {news.category}
                </span>
                <span aria-hidden="true" className="text-[#78947D]">
                  ·
                </span>
                <time
                  dateTime={news.dateTime}
                  className="text-[11px] font-semibold text-[#6A7E77]"
                >
                  {news.dateLabel}
                </time>
              </div>

              <h3 className="mt-2 pl-1 text-base font-black leading-5 text-[#082A2A]">
                {news.title}
              </h3>
              <p className="mt-2 pl-1 text-sm leading-5 text-[#536B64]">
                {news.description}
              </p>

              {"href" in news ? (
                <a
                  href={news.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex items-center gap-1.5 rounded-sm pl-1 pt-4 text-xs font-extrabold text-[#278B70] underline decoration-[#42CDA8]/45 underline-offset-4 transition hover:text-[#173C2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315B3E]"
                >
                  {news.linkLabel}
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CareerSection({ locale }: { locale: AppLocale }) {
  const isEnglish = locale === "en";
  const pillars = isEnglish ? gamePillarsEn : gamePillars;
  return (
    <section
      id="carriere"
      className="relative overflow-hidden bg-[#F7FAF7] px-5 pb-24 pt-5 text-[#082A2A] sm:px-8 sm:pb-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#42A884]">
            {isEnglish ? "Your career" : "Votre carrière"}
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            {isEnglish ? "A sporting adventure" : "Une aventure sportive"}
            <span className="block text-[#315B3E]">
              {isEnglish
                ? "built one stage at a time."
                : "qui se construit étape après étape."}
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#536B64] sm:text-lg">
            {isEnglish
              ? "From recruitment to the final victory, every decision shapes your team and the story you will write."
              : "Du recrutement à la victoire finale, chaque décision façonne votre équipe et l’histoire que vous écrirez."}
          </p>

          <Image
            src="/logo-cyclo-stratege.png"
            alt="Cyclo Stratège"
            width={420}
            height={420}
            sizes="(max-width: 640px) 220px, (max-width: 1125px) 32vw, 360px"
            className="mx-auto mt-10 h-auto w-[clamp(220px,32vw,360px)] drop-shadow-[0_28px_60px_rgba(7,26,23,0.28)]"
          />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <FeatureCard
              key={pillar.title}
              icon={pillar.icon}
              title={pillar.title}
              description={pillar.description}
              linkLabel={pillar.linkLabel}
              backgroundPosition={pillar.backgroundPosition}
            />
          ))}
        </div>
      </div>

      <RoadWave />
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  linkLabel,
  backgroundPosition,
}: {
  icon: "team" | "strategy" | "trophy";
  title: string;
  description: string;
  linkLabel: string;
  backgroundPosition: string;
}) {
  return (
    <article className="group relative min-h-80 overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white shadow-[0_18px_45px_rgba(19,60,46,0.12)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_rgba(19,60,46,0.18)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-no-repeat opacity-20 transition duration-500 group-hover:scale-105 group-hover:opacity-30"
        style={{
          backgroundImage: "url('/images/peloton-header.webp')",
          backgroundPosition,
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-white via-white/95 to-[#DBF0E7]/75"
      />

      <div className="relative flex min-h-80 flex-col p-6 sm:p-7">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#42CDA8] text-[#07302A] shadow-[0_12px_30px_rgba(66,205,168,0.28)]">
          <PillarIcon icon={icon} />
        </span>

        <h3 className="mt-7 text-2xl font-black tracking-tight">{title}</h3>

        <p className="mt-4 leading-7 text-[#536B64]">{description}</p>

        <Link
          href="/inscription"
          className="mt-auto inline-flex w-fit items-center gap-2 pt-8 text-sm font-extrabold uppercase tracking-[0.08em] text-[#278B70] transition group-hover:text-[#173C2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315B3E]"
        >
          {linkLabel}
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}

function PillarIcon({ icon }: { icon: "team" | "strategy" | "trophy" }) {
  if (icon === "team") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 19c.5-4 2.5-6 5.5-6s5 2 5.5 6" />
        <path d="M14 14c3.2-.3 5.2 1.4 5.8 4.5" />
      </svg>
    );
  }

  if (icon === "strategy") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 19V10" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
        <path d="M3 7l5-3 5 4 7-5" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H4v1a5 5 0 0 0 5 5" />
      <path d="M16 6h4v1a5 5 0 0 1-5 5" />
      <path d="M12 13v5" />
      <path d="M8 21h8" />
      <path d="M9 18h6" />
    </svg>
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

function HeroMountainLines() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 280"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-52 w-full opacity-30"
    >
      <path
        d="M0 235 L165 135 L290 210 L450 70 L610 225 L770 120 L930 230 L1100 90 L1280 205 L1440 125 L1440 280 L0 280 Z"
        fill="#78B9A3"
        opacity="0.28"
      />

      <path
        d="M0 255 L210 190 L355 245 L520 145 L690 255 L870 190 L1040 260 L1215 165 L1440 235"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="15 15"
        strokeWidth="2"
        opacity="0.4"
      />
    </svg>
  );
}

function RoadWave() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 150"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
    >
      <path
        d="M0 90 C260 145 430 45 700 100 C980 155 1160 55 1440 95 L1440 150 L0 150 Z"
        fill="#C8F1E5"
        opacity="0.9"
      />

      <path
        d="M0 105 C280 155 455 62 720 112 C1000 165 1190 70 1440 110"
        fill="none"
        stroke="#278B70"
        strokeDasharray="12 10"
        strokeWidth="2"
        opacity="0.75"
      />
    </svg>
  );
}
