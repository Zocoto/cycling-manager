import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { releases } from "../../../lib/releases";

export const metadata: Metadata = {
  title: "Nouveautés",
  description:
    "Découvrez les dernières fonctionnalités et évolutions de Cyclo Stratège.",
};

export default function ReleasesPage() {
  return (
    <>
      <ReleasesHero />
      <ReleasesTimeline />
    </>
  );
}

function ReleasesHero() {
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
            "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.97) 34%, rgba(236,247,242,0.72) 58%, rgba(7,26,23,0.16) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(247,250,247,0.90) 100%)",
        }}
      />

      <MountainDecoration />

      <div className="relative mx-auto max-w-375 px-5 py-20 sm:px-8 sm:py-24">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-[#F2C94C] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#071A17] shadow-md">
            Journal de développement
          </span>

          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] text-[#082A2A] sm:text-6xl">
            Les nouveautés de
            <span className="mt-2 block text-[#42B99A]">
              Cyclo Stratège.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#25443F]">
            Retrouvez toutes les fonctionnalités, améliorations et fondations
            ajoutées au jeu au fil de son développement.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
            >
              Retour à l’accueil
              <ArrowIcon />
            </Link>

            <span className="inline-flex min-h-12 items-center rounded-lg border border-[#315B3E]/30 bg-white/65 px-5 py-3 text-sm font-bold text-[#315B3E] shadow-sm backdrop-blur">
              {releases.length} version{releases.length > 1 ? "s" : ""} publiée
              {releases.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReleasesTimeline() {
  return (
    <section className="relative overflow-hidden bg-[#F7FAF7] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 border-b border-[#315B3E]/15 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#42A884]">
              Historique des versions
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              La route déjà parcourue
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-[#60756E]">
            Chaque étape documente une évolution concrète du projet et les
            fonctionnalités désormais disponibles.
          </p>
        </div>

        <div className="space-y-10">
          {releases.map((release, index) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isCurrent={index === 0}
            />
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-[#315B3E]/15 bg-[#E5F3EC] px-6 py-8 text-center sm:px-10">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#278B70]">
            La suite arrive
          </p>

          <h2 className="mt-3 text-2xl font-black sm:text-3xl">
            Le journal continuera de s’enrichir à chaque nouvelle livraison.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#536B64]">
            Les prochaines versions couvriront notamment la création de compte,
            l’authentification et les premières fonctionnalités du jeu.
          </p>

          <Link
            href="/inscription"
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315B3E]"
          >
            Préparer ma carrière
            <ArrowIcon />
          </Link>
        </div>
      </div>

      <RoadDecoration />
    </section>
  );
}

function ReleaseCard({
  release,
  isCurrent,
}: {
  release: {
    version: string;
    date: string;
    title: string;
    description: string;
    features: readonly string[];
  };
  isCurrent: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/25 bg-[#0B302B] text-[#FFFDF4] shadow-[0_24px_65px_rgba(7,26,23,0.22)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

      <WheelDecoration />

      <div className="relative grid gap-0 lg:grid-cols-[290px_1fr]">
        <div
          className="relative min-h-64 overflow-hidden bg-cover bg-center lg:min-h-full"
          style={{
            backgroundImage: "url('/images/peloton-header.webp')",
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-[#071A17] via-[#071A17]/30 to-transparent"
          />

          <div className="absolute left-5 top-5 flex flex-wrap gap-2">
            <span className="rounded-md bg-[#F2C94C] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#071A17]">
              Version {release.version}
            </span>

            {isCurrent && (
              <span className="rounded-md border border-[#7CCF9C]/45 bg-[#071A17]/70 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#7CCF9C] backdrop-blur">
                Version actuelle
              </span>
            )}
          </div>

          <div className="absolute bottom-5 left-5 right-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              Publiée en {release.date}
            </p>

            <p className="mt-2 text-sm leading-6 text-[#D6DFD2]">
              Une nouvelle étape dans la construction de Cyclo Stratège.
            </p>
          </div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
            Mise à jour du projet
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight">
            {release.title}
          </h2>

          <p className="mt-5 max-w-3xl leading-7 text-[#D6DFD2]">
            {release.description}
          </p>

          <div className="mt-8 border-t border-white/10 pt-7">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F2C94C]">
              Fonctionnalités et évolutions
            </p>

            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {release.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#42B99A]/15 text-sm font-black text-[#7CCF9C]">
                    ✓
                  </span>

                  <span className="leading-6 text-[#E6ECE7]">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
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

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 260"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-48 w-full opacity-30"
    >
      <path
        d="M0 220 L160 125 L295 205 L455 60 L625 220 L790 115 L955 225 L1120 85 L1290 205 L1440 120 L1440 260 L0 260 Z"
        fill="#78B9A3"
        opacity="0.28"
      />

      <path
        d="M0 240 L215 185 L360 235 L525 140 L700 245 L880 185 L1050 248 L1220 155 L1440 225"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="15 15"
        strokeWidth="2"
        opacity="0.45"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 opacity-55"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(124,207,156,0.10) 13deg 14deg)",
      }}
    />
  );
}

function RoadDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 180"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-60"
    >
      <path
        d="M0 115 C250 165 430 75 700 125 C970 175 1170 80 1440 120"
        fill="none"
        stroke="#7CCF9C"
        strokeWidth="18"
        opacity="0.18"
      />

      <path
        d="M0 115 C250 165 430 75 700 125 C970 175 1170 80 1440 120"
        fill="none"
        stroke="#278B70"
        strokeDasharray="14 12"
        strokeWidth="2"
      />
    </svg>
  );
}
