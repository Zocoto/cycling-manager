import type { Metadata } from "next";
import Link from "next/link";

import { WheelLogo } from "../../components/ui/wheel-logo";

export const metadata: Metadata = {
  title: "Espace de jeu",
  description:
    "Découvrez le futur cockpit de votre équipe Cycling Manager.",
};

const previewCards = [
  {
    icon: "team",
    title: "Effectif",
    value: "28",
    description: "Gérez vos coureurs, leurs rôles et leurs contrats.",
  },
  {
    icon: "calendar",
    title: "Prochaine course",
    value: "J-6",
    description: "Préparez votre sélection et votre stratégie.",
  },
  {
    icon: "objective",
    title: "Confiance sponsor",
    value: "85 %",
    description: "Suivez les attentes et objectifs de votre partenaire.",
  },
] as const;

export default function GamePage() {
  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <GameHeader />

      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-position-[68%_center] bg-no-repeat"
          style={{
            backgroundImage: "url('/images/peloton-header.png')",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.96) 38%, rgba(236,247,242,0.66) 62%, rgba(7,26,23,0.28) 100%)",
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(234,245,243,0.96) 100%)",
          }}
        />

        <MountainDecoration />

        <div className="relative mx-auto max-w-375 px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-[#F2C94C] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#071A17] shadow-md">
              Aperçu du futur espace de jeu
            </span>

            <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl">
              Le cockpit du
              <span className="mt-2 block text-[#42B99A]">
                directeur sportif.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#36554E]">
              Retrouvez ici une première représentation de l’espace dans lequel
              vous piloterez votre équipe et prendrez vos décisions.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {previewCards.map((card) => (
              <DashboardPreviewCard
                key={card.title}
                icon={card.icon}
                title={card.title}
                value={card.value}
                description={card.description}
              />
            ))}
          </div>

          <article className="relative mt-8 overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] text-[#FFFDF4] shadow-[0_28px_80px_rgba(7,26,23,0.28)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

            <WheelDecoration />

            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:p-10">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
                  Statut de la fonctionnalité
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight">
                  Cet espace est encore en construction.
                </h2>

                <p className="mt-5 max-w-2xl leading-7 text-[#D6DFD2]">
                  La route est temporairement accessible publiquement. Elle sera
                  protégée par le système d’authentification lors de l’US 6.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/"
                    className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
                  >
                    Retour à l’accueil
                    <ArrowIcon />
                  </Link>

                  <Link
                    href="/nouveautes"
                    className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#7CCF9C]/45 bg-white/5 px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#7CCF9C] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CCF9C]"
                  >
                    Voir les nouveautés
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F2C94C]">
                  Prochaines étapes
                </p>

                <ul className="mt-5 space-y-4">
                  <RoadmapItem label="Création de compte" status="US 5" />
                  <RoadmapItem label="Connexion sécurisée" status="US 6" />
                  <RoadmapItem label="Protection de la route" status="US 6" />
                </ul>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function GameHeader() {
  return (
    <header className="relative z-20 border-b border-[#78947D]/25 bg-[#071A17] text-[#FFFDF4] shadow-lg shadow-black/15">
      <div className="mx-auto flex max-w-375 items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
        >
          <WheelLogo />

          <span>
            <span className="block text-lg font-extrabold uppercase leading-none">
              Cycling
            </span>

            <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.34em] text-[#F2C94C]">
              Manager
            </span>
          </span>
        </Link>

        <span className="rounded-full border border-[#F2C94C]/35 bg-[#F2C94C]/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#F2C94C]">
          Prototype
        </span>
      </div>
    </header>
  );
}

function DashboardPreviewCard({
  icon,
  title,
  value,
  description,
}: {
  icon: "team" | "calendar" | "objective";
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white/90 p-6 shadow-[0_18px_45px_rgba(19,60,46,0.13)] backdrop-blur">
      <div className="flex items-start justify-between gap-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#42CDA8] text-[#07302A]">
          <CardIcon icon={icon} />
        </span>

        <span className="text-3xl font-black text-[#278B70]">{value}</span>
      </div>

      <h2 className="mt-7 text-xl font-black">{title}</h2>

      <p className="mt-3 leading-7 text-[#60756E]">{description}</p>
    </article>
  );
}

function CardIcon({
  icon,
}: {
  icon: "team" | "calendar" | "objective";
}) {
  if (icon === "team") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
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

  if (icon === "calendar") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
        <path d="M8 14h3M13 14h3M8 17h3" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="m12 12 6-6" />
      <path d="M18 6h3v3" />
    </svg>
  );
}

function RoadmapItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-white/10 pb-4 last:border-0 last:pb-0">
      <span className="text-sm text-[#D6DFD2]">{label}</span>

      <span className="rounded-md bg-[#42B99A]/15 px-2.5 py-1 text-xs font-bold text-[#7CCF9C]">
        {status}
      </span>
    </li>
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
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-80 w-full opacity-25"
    >
      <path
        d="M0 365 L170 215 L310 330 L490 105 L665 340 L835 180 L1005 350 L1190 135 L1440 315 L1440 420 L0 420 Z"
        fill="#78B9A3"
        opacity="0.34"
      />

      <path
        d="M0 390 L220 300 L370 380 L545 235 L720 395 L900 285 L1075 400 L1260 255 L1440 365"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="17 15"
        strokeWidth="3"
        opacity="0.38"
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