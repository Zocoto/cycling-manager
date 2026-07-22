import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/app-link";

import { PublicGameNewsBoard } from "@/components/public/public-game-news-board";
import { getPublicGameNews } from "@/services/public-game-news";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "Prenez la direction de votre propre équipe cycliste et construisez votre légende.",
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

export default async function HomePage() {
  const gameNews = await getPublicGameNews();

  return (
    <>
      <HeroSection />
      <PublicGameNewsBoard snapshot={gameNews} />
      <CareerSection />
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-position-[68%_center] bg-no-repeat"
        style={{
          backgroundImage: "url('/images/peloton-header.webp')",
        }}
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

      <div className="relative mx-auto flex min-h-150 max-w-375 items-center px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#315B3E]/20 bg-white/75 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#315B3E] shadow-sm backdrop-blur">
              Devenez directeur sportif
            </span>

            <span className="rounded-full bg-[#F2C94C] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#071A17] shadow-sm">
              Saison 2026
            </span>
          </div>

          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] text-[#082A2A] sm:text-6xl lg:text-7xl">
            Prenez la tête
            <span className="mt-2 block text-[#42B99A]">du peloton.</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-[#25443F] sm:text-xl">
            Construisez votre équipe, recrutez les meilleurs coureurs et prenez
            les décisions qui feront la différence sur les plus grandes routes.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/inscription"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-[0_14px_35px_rgba(128,100,10,0.24)] transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
            >
              Nouvelle carrière
              <ArrowIcon />
            </Link>

            <Link
              href="/connexion"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border-2 border-[#0B302B] bg-[#0B302B] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#FFFDF4] shadow-[0_10px_25px_rgba(7,26,23,0.22)] transition hover:-translate-y-0.5 hover:bg-[#123f37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B302B]"
            >
              Charger une partie
              <FolderIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function CareerSection() {
  return (
    <section
      id="carriere"
      className="relative overflow-hidden bg-[#F7FAF7] px-5 pb-24 pt-5 text-[#082A2A] sm:px-8 sm:pb-28"
    >
      <div className="mx-auto max-w-375">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#42A884]">
            Votre carrière
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
            Une aventure sportive
            <span className="block text-[#315B3E]">
              qui se construit étape après étape.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#536B64] sm:text-lg">
            Du recrutement à la victoire finale, chaque décision façonne votre
            équipe et l’histoire que vous écrirez.
          </p>

          <Image
            src="/logo-cyclo-stratege.png"
            alt="Cyclo Stratège"
            width={420}
            height={420}
            className="mx-auto mt-10 h-auto w-[clamp(220px,32vw,360px)] drop-shadow-[0_28px_60px_rgba(7,26,23,0.28)]"
          />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {gamePillars.map((pillar) => (
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

function PillarIcon({
  icon,
}: {
  icon: "team" | "strategy" | "trophy";
}) {
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

function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2.5 5.5h5l1.5 2h8.5v8H2.5v-10Z" />
      <path d="M2.5 7.5h15" />
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
