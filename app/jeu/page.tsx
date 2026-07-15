import type { Metadata } from "next";
import Link from "next/link";

import { WheelLogo } from "../../components/ui/wheel-logo";

export const metadata: Metadata = {
  title: "Espace de jeu",
  description:
    "Découvrez le futur espace de gestion de votre équipe Cycling Manager.",
};

export default function GamePage() {
  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-[#102238] px-5 py-12 text-[#F6F8FA] sm:px-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[68%_center] bg-no-repeat opacity-35"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,34,56,0.99) 0%, rgba(16,34,56,0.91) 55%, rgba(16,34,56,0.73) 100%)",
        }}
      />

      <MountainBackground />

      <section className="relative mx-auto w-full max-w-4xl">
        <div className="flex items-center gap-3 text-[#69D5AE]">
          <WheelLogo />

          <p className="text-sm font-semibold uppercase tracking-[0.25em]">
            Cycling Manager
          </p>
        </div>

        <article className="relative mt-8 overflow-hidden rounded-2xl border border-[#86A6BC]/45 bg-[#18324D]/95 p-7 shadow-2xl shadow-[#07111F]/35 sm:p-10 lg:p-12">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#69D5AE]" />

          <WheelDecoration />

          <div className="relative">
            <span className="inline-flex rounded-md border border-[#E5B84B]/45 bg-[#E5B84B]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#E5B84B]">
              Zone temporairement publique
            </span>

            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Votre espace de jeu est
              <span className="block text-[#69D5AE]">
                en cours de construction.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#C5D3DD]">
              Cette route représente le futur cockpit du directeur sportif.
              Elle sera protégée par le système d’authentification lors de
              l’US 6.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-3">
              <PreviewCard
                title="Effectif"
                description="Gérez vos coureurs et leurs contrats."
              />

              <PreviewCard
                title="Calendrier"
                description="Préparez les prochaines courses."
              />

              <PreviewCard
                title="Objectifs"
                description="Suivez les attentes de vos sponsors."
              />
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#55BE86] px-6 py-3 font-bold text-[#102238] transition hover:-translate-y-0.5 hover:bg-[#69D5AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F8FA]"
              >
                Retour à l’accueil
              </Link>

              <Link
                href="/nouveautes"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#69D5AE] bg-[#102238]/30 px-6 py-3 font-semibold transition hover:bg-[#69D5AE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
              >
                Consulter les nouveautés
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function PreviewCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-[#86A6BC]/25 bg-[#102238]/45 p-5">
      <div className="h-0.5 w-10 bg-[#69D5AE]" />

      <h2 className="mt-5 text-lg font-bold text-[#F6F8FA]">{title}</h2>

      <p className="mt-2 text-sm leading-6 text-[#C5D3DD]">{description}</p>
    </article>
  );
}

function MountainBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 500"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-96 w-full opacity-[0.10]"
    >
      <path
        d="M0 430 L185 250 L320 385 L500 115 L680 395 L855 195 L1020 410 L1200 145 L1440 365 L1440 500 L0 500 Z"
        fill="#69D5AE"
      />

      <path
        d="M0 465 L230 350 L380 445 L560 285 L745 460 L930 335 L1110 455 L1285 305 L1440 415"
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
      className="pointer-events-none absolute -right-28 -top-28 hidden h-80 w-80 rounded-full border border-[#86A6BC]/15 sm:block"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(134,166,188,0.11) 13deg 14deg)",
      }}
    />
  );
}