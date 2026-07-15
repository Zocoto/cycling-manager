import type { Metadata } from "next";
import Link from "next/link";

import { releases } from "../../../lib/releases";

export const metadata: Metadata = {
  title: "Nouveautés",
  description:
    "Découvrez les dernières fonctionnalités et évolutions de Cycling Manager.",
};

export default function ReleasesPage() {
  return (
    <>
      <ReleasesHero />

      <section className="relative overflow-hidden bg-[#102238] px-5 py-14 sm:px-8 sm:py-20">
        <MountainBackground />

        <div className="relative mx-auto max-w-5xl">
          <div className="space-y-8">
            {releases.map((release, index) => (
              <article
                key={release.version}
                className="relative overflow-hidden rounded-2xl border border-[#86A6BC]/40 bg-[#18324D]/95 shadow-2xl shadow-[#07111F]/25"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[#69D5AE]" />

                <WheelDecoration />

                <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[220px_1fr] lg:p-10">
                  <div className="border-b border-[#86A6BC]/25 pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                    <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-start">
                      <span className="rounded-md bg-[#69D5AE] px-3 py-1.5 text-sm font-bold text-[#102238]">
                        Version {release.version}
                      </span>

                      {index === 0 && (
                        <span className="rounded-md border border-[#E5B84B]/55 bg-[#E5B84B]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#E5B84B]">
                          Version actuelle
                        </span>
                      )}
                    </div>

                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#C5D3DD]">
                      {release.date}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#F6F8FA] sm:text-3xl">
                      {release.title}
                    </h2>

                    <p className="mt-4 max-w-3xl leading-7 text-[#C5D3DD]">
                      {release.description}
                    </p>

                    <div className="mt-8">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#E5B84B]">
                        Fonctionnalités et évolutions
                      </p>

                      <ul className="mt-5 grid gap-4 md:grid-cols-2">
                        {release.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-4 rounded-lg border border-[#86A6BC]/20 bg-[#102238]/40 px-4 py-4"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#55BE86]/15 text-sm font-bold text-[#69D5AE]"
                            >
                              ✓
                            </span>

                            <span className="leading-6 text-[#E2E9EE]">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-[#C5D3DD]">
              Le journal continuera de s’enrichir au fil du développement.
            </p>

            <Link
              href="/"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md border border-[#69D5AE] bg-[#102238]/30 px-5 py-2.5 font-semibold text-[#F6F8FA] transition hover:bg-[#69D5AE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function ReleasesHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[#86A6BC]/30 bg-[#18324D]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[68%_center] bg-no-repeat opacity-50"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,34,56,0.99) 0%, rgba(16,34,56,0.91) 48%, rgba(16,34,56,0.55) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(24,50,77,0.06) 0%, rgba(16,34,56,0.88) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-375 px-5 py-16 sm:px-8 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#69D5AE]">
          Journal de développement
        </p>

        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[#F6F8FA] drop-shadow-lg sm:text-6xl">
          Les nouveautés de
          <span className="block text-[#69D5AE]">Cycling Manager</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D8E2E9]">
          Retrouvez ici les fonctionnalités, améliorations et fondations
          ajoutées au jeu au fil de son développement.
        </p>

        <RoadSeparator />
      </div>
    </section>
  );
}

function RoadSeparator() {
  return (
    <div
      aria-hidden="true"
      className="mt-10 flex max-w-xl items-center gap-2 opacity-85"
    >
      <div className="h-px flex-1 bg-[#86A6BC]/50" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-left-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/60"
        />
      ))}

      <span className="h-0.5 w-14 bg-[#69D5AE]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-right-${index}`}
          className="h-px w-7 bg-[#C5D3DD]/60"
        />
      ))}

      <div className="h-px flex-1 bg-[#86A6BC]/50" />
    </div>
  );
}

function MountainBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 500"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-96 w-full opacity-[0.07]"
    >
      <path
        d="M0 430 L180 245 L320 380 L505 115 L675 395 L850 190 L1010 410 L1190 150 L1440 360 L1440 500 L0 500 Z"
        fill="#69D5AE"
      />

      <path
        d="M0 460 L230 350 L380 440 L560 280 L745 455 L925 330 L1100 450 L1280 300 L1440 410"
        fill="none"
        stroke="#F6F8FA"
        strokeDasharray="18 15"
        strokeWidth="3"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#86A6BC]/15"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(134,166,188,0.11) 13deg 14deg)",
      }}
    />
  );
}