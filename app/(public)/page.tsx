import type { Metadata } from "next";
import Link from "next/link";

import { latestRelease } from "../../lib/releases";

export const metadata: Metadata = {
  title: "Accueil",
};

const gamePillars = [
  {
    number: "01",
    title: "Construisez votre équipe",
    description:
      "Recrutez vos coureurs, composez un effectif équilibré et préparez l’avenir de votre formation.",
  },
  {
    number: "02",
    title: "Préparez chaque course",
    description:
      "Analysez les profils, sélectionnez les meilleurs coureurs et définissez votre stratégie.",
  },
  {
    number: "03",
    title: "Écrivez votre histoire",
    description:
      "Atteignez les objectifs de vos sponsors et faites progresser votre équipe saison après saison.",
  },
];

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <LatestReleaseSection />
      <GamePillarsSection />
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#86A6BC]/30 bg-[#18324D]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[68%_center] bg-no-repeat opacity-80"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,34,56,0.98) 0%, rgba(16,34,56,0.91) 42%, rgba(16,34,56,0.48) 76%, rgba(16,34,56,0.20) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(24,50,77,0.04) 0%, rgba(24,50,77,0.05) 56%, rgba(16,34,56,0.90) 100%)",
        }}
      />

      <MountainDecoration />

      <div className="relative mx-auto flex min-h-[570px] max-w-375 items-center px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-[#69D5AE]/50 bg-[#102238]/65 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#69D5AE] backdrop-blur-sm">
              Le cockpit du directeur sportif
            </span>

            <span className="text-sm text-[#C5D3DD]">
              Saison de développement 2026
            </span>
          </div>

          <h1 className="mt-7 text-5xl font-bold tracking-tight text-[#F6F8FA] drop-shadow-lg sm:text-6xl lg:text-7xl">
            Prenez la tête
            <span className="block text-[#69D5AE]">du peloton.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D8E2E9] drop-shadow-md sm:text-xl">
            Construisez votre équipe cycliste, recrutez les meilleurs coureurs
            et prenez les décisions qui feront la différence sur la route.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/inscription"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#55BE86] px-6 py-3 text-base font-bold text-[#102238] shadow-lg shadow-[#07111F]/30 transition hover:-translate-y-0.5 hover:bg-[#69D5AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F8FA]"
            >
              Créer mon équipe
            </Link>

            <Link
              href="/connexion"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#69D5AE] bg-[#102238]/55 px-6 py-3 text-base font-semibold text-[#F6F8FA] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#69D5AE]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
            >
              Reprendre ma carrière
            </Link>
          </div>

          <RoadSeparator />
        </div>
      </div>
    </section>
  );
}

function LatestReleaseSection() {
  return (
    <section className="relative bg-[#102238] px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#69D5AE]">
            Dernières nouveautés
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#F6F8FA] sm:text-4xl">
            Cycling Manager prend forme
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#C5D3DD]">
            Suivez directement depuis l’accueil les fonctionnalités que nous
            développons au fil des versions.
          </p>
        </div>

        <article className="relative overflow-hidden rounded-2xl border border-[#86A6BC]/45 bg-[#18324D] shadow-2xl shadow-[#07111F]/25">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#69D5AE]" />

          <div
            aria-hidden="true"
            className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-[#86A6BC]/15"
            style={{
              background:
                "repeating-conic-gradient(transparent 0deg 14deg, rgba(134,166,188,0.12) 14deg 15deg)",
            }}
          />

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.65fr_1.35fr] lg:p-10">
            <div className="border-b border-[#86A6BC]/25 pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-[#69D5AE] px-3 py-1 text-sm font-bold text-[#102238]">
                  Version {latestRelease.version}
                </span>

                <span className="text-sm text-[#C5D3DD]">
                  {latestRelease.date}
                </span>
              </div>

              <h3 className="mt-6 text-2xl font-bold text-[#F6F8FA]">
                {latestRelease.title}
              </h3>

              <p className="mt-4 leading-7 text-[#C5D3DD]">
                {latestRelease.description}
              </p>

              <Link
                href="/nouveautes"
                className="mt-7 inline-flex items-center gap-2 rounded-md font-semibold text-[#69D5AE] transition hover:text-[#B9E4CE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
              >
                Voir toutes les versions
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#E5B84B]">
                Fonctionnalités livrées
              </p>

              <ul className="mt-5 space-y-4">
                {latestRelease.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-4 rounded-lg border border-[#86A6BC]/20 bg-[#102238]/35 px-4 py-3.5"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#55BE86]/15 text-sm font-bold text-[#69D5AE]"
                    >
                      ✓
                    </span>

                    <span className="leading-6 text-[#E2E9EE]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function GamePillarsSection() {
  return (
    <section className="relative overflow-hidden border-t border-[#86A6BC]/20 bg-[#18324D] px-5 py-16 sm:px-8 sm:py-20">
      <MountainLine />

      <div className="relative mx-auto max-w-375">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#69D5AE]">
            Votre carrière
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Plus qu’une équipe,
            <span className="text-[#69D5AE]"> un projet sportif.</span>
          </h2>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {gamePillars.map((pillar) => (
            <article
              key={pillar.number}
              className="group relative overflow-hidden rounded-xl border border-[#86A6BC]/35 bg-[#102238]/55 p-6 shadow-xl shadow-[#07111F]/15 transition hover:-translate-y-1 hover:border-[#69D5AE]/70"
            >
              <span className="text-4xl font-bold text-[#69D5AE]/25 transition group-hover:text-[#69D5AE]/45">
                {pillar.number}
              </span>

              <h3 className="mt-5 text-xl font-bold text-[#F6F8FA]">
                {pillar.title}
              </h3>

              <p className="mt-3 leading-7 text-[#C5D3DD]">
                {pillar.description}
              </p>

              <div className="mt-6 h-0.5 w-14 bg-[#69D5AE]" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-25"
    >
      <path
        d="M0 310 L170 175 L285 265 L465 90 L635 260 L790 135 L940 270 L1110 105 L1290 245 L1440 160 L1440 360 L0 360 Z"
        fill="#2D5675"
      />

      <path
        d="M0 325 L210 235 L350 300 L520 175 L690 305 L870 220 L1030 315 L1210 195 L1440 285 L1440 360 L0 360 Z"
        fill="#18324D"
      />

      <path
        d="M170 175 L210 207 L232 190 L285 265"
        fill="none"
        stroke="#C5D3DD"
        strokeWidth="5"
        opacity="0.45"
      />

      <path
        d="M465 90 L520 155 L550 128 L635 260"
        fill="none"
        stroke="#C5D3DD"
        strokeWidth="6"
        opacity="0.5"
      />

      <path
        d="M1110 105 L1165 165 L1198 143 L1290 245"
        fill="none"
        stroke="#C5D3DD"
        strokeWidth="6"
        opacity="0.45"
      />
    </svg>
  );
}

function MountainLine() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 220"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-52 w-full opacity-[0.08]"
    >
      <path
        d="M0 185 L160 90 L290 160 L440 35 L610 165 L760 75 L925 175 L1090 55 L1260 150 L1440 70"
        fill="none"
        stroke="#69D5AE"
        strokeWidth="4"
      />

      <path
        d="M0 200 L205 145 L345 195 L515 105 L685 200 L860 135 L1040 205 L1215 115 L1440 180"
        fill="none"
        stroke="#F6F8FA"
        strokeDasharray="16 14"
        strokeWidth="2"
      />
    </svg>
  );
}

function RoadSeparator() {
  return (
    <div
      aria-hidden="true"
      className="mt-11 flex max-w-xl items-center gap-2 opacity-85"
    >
      <div className="h-px flex-1 bg-[#86A6BC]/50" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`left-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/60"
        />
      ))}

      <span className="h-0.5 w-14 bg-[#69D5AE]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`right-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/60"
        />
      ))}

      <div className="h-px flex-1 bg-[#86A6BC]/50" />
    </div>
  );
}