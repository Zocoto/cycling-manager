import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "@/components/ui/app-link";

import { WheelLogo } from "../../components/ui/wheel-logo";

export const metadata: Metadata = {
  title: "Design System",
  description:
    "Référence graphique Peloton UI pour l’interface de Cyclo Stratège.",
};

const palette = [
  {
    name: "Nuit profonde",
    role: "Navigation et surfaces premium",
    value: "#071A17",
  },
  {
    name: "Forêt",
    role: "Panneaux et cartes sombres",
    value: "#173C2E",
  },
  {
    name: "Menthe sportive",
    role: "Actions et informations positives",
    value: "#42CDA8",
  },
  {
    name: "Maillot leader",
    role: "Action principale et mise en avant",
    value: "#F2C94C",
  },
  {
    name: "Fond alpin",
    role: "Pages publiques lumineuses",
    value: "#EAF5F3",
  },
  {
    name: "Texte principal",
    role: "Titres et informations importantes",
    value: "#082A2A",
  },
] as const;

const principles = [
  {
    number: "01",
    title: "Lumineux",
    description:
      "Les espaces publics privilégient des fonds clairs et des paysages ouverts.",
  },
  {
    number: "02",
    title: "Sportif",
    description:
      "Les contrastes, les titres massifs et les accents vifs insufflent de l’énergie.",
  },
  {
    number: "03",
    title: "Stratégique",
    description:
      "Les surfaces sombres restent réservées aux informations et outils de gestion.",
  },
] as const;

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[#EAF5F3] text-[#082A2A]">
      <DesignHeader />
      <PaletteSection />
      <ComponentsSection />
      <PrinciplesSection />
    </main>
  );
}

function DesignHeader() {
  return (
    <header className="relative isolate overflow-hidden border-b border-[#315B3E]/15">
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
            "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.96) 40%, rgba(236,247,242,0.68) 65%, rgba(7,26,23,0.28) 100%)",
        }}
      />

      <div className="relative mx-auto max-w-375 px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex items-center gap-4">
          <WheelLogo />

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#278B70]">
              Peloton UI
            </p>

            <p className="mt-1 text-sm font-bold text-[#536B64]">
              Version 0.3
            </p>
          </div>
        </div>

        <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl">
          Le design system de
          <span className="mt-2 block text-[#42B99A]">
            Cyclo Stratège.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-8 text-[#36554E]">
          Une identité lumineuse, sportive et stratégique, inspirée des grandes
          routes alpines et de l’univers du management cycliste.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#FFD968]"
        >
          Retour à l’accueil
        </Link>
      </div>
    </header>
  );
}

function PaletteSection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-375">
        <SectionHeading
          eyebrow="Fondations"
          title="Une palette inspirée du peloton et de la montagne"
          description="Le jaune identifie les actions principales, la menthe apporte l’énergie et les verts structurent les espaces de gestion."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {palette.map((color) => (
            <article
              key={color.name}
              className="overflow-hidden rounded-2xl border border-[#315B3E]/15 bg-white shadow-[0_16px_38px_rgba(19,60,46,0.10)]"
            >
              <div
                className="h-28 border-b border-black/5"
                style={{ backgroundColor: color.value }}
              />

              <div className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-black">{color.name}</h3>

                  <span className="font-mono text-xs text-[#60756E]">
                    {color.value}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-[#60756E]">
                  {color.role}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComponentsSection() {
  return (
    <section className="bg-[#F7FAF7] px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-375">
        <SectionHeading
          eyebrow="Composants"
          title="Des éléments immédiatement identifiables"
          description="Les composants conservent une hiérarchie forte et restent lisibles sur les surfaces claires comme sombres."
        />

        <div className="mt-10 grid gap-6 xl:grid-cols-[0.8fr_1fr_1.2fr]">
          <TypographyPanel />
          <ButtonsPanel />
          <DashboardPanel />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <FormPanel />
          <RacePanel />
        </div>
      </div>
    </section>
  );
}

function TypographyPanel() {
  return (
    <Panel>
      <PanelTitle label="Typographie" />

      <div className="mt-7 space-y-6">
        <TypographyRow label="Titre majeur">
          <span className="text-4xl font-black tracking-[-0.04em]">
            Direction sportive
          </span>
        </TypographyRow>

        <TypographyRow label="Titre section">
          <span className="text-2xl font-black">Prochaine course</span>
        </TypographyRow>

        <TypographyRow label="Texte">
          <span className="leading-7 text-[#60756E]">
            Sélectionnez les coureurs les mieux adaptés au profil de l’étape.
          </span>
        </TypographyRow>

        <TypographyRow label="Information">
          <span className="text-sm font-bold uppercase tracking-[0.16em] text-[#278B70]">
            Mise à jour récente
          </span>
        </TypographyRow>
      </div>
    </Panel>
  );
}

function ButtonsPanel() {
  return (
    <Panel>
      <PanelTitle label="Actions" />

      <div className="mt-7 space-y-7">
        <div>
          <p className="text-sm font-bold text-[#60756E]">
            Actions principales
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-extrabold text-[#071A17] shadow-md transition hover:bg-[#FFD968]"
            >
              Nouvelle carrière
            </button>

            <button
              type="button"
              className="rounded-lg bg-[#42CDA8] px-5 py-3 text-sm font-extrabold text-[#07302A] shadow-md transition hover:bg-[#64DEBD]"
            >
              Valider
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-[#60756E]">
            Actions secondaires
          </p>

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-[#315B3E]/45 bg-white px-5 py-3 text-sm font-bold text-[#173C2E] transition hover:bg-[#EAF5F3]"
            >
              Annuler
            </button>

            <button
              type="button"
              className="cursor-not-allowed rounded-lg border border-[#78947D]/20 bg-[#DCE8E2] px-5 py-3 text-sm font-bold text-[#78947D]"
              disabled
            >
              Indisponible
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DashboardPanel() {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] p-6 text-[#FFFDF4] shadow-[0_22px_55px_rgba(7,26,23,0.24)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

      <PanelTitle label="Carte de gestion" dark />

      <div className="mt-7 grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
        <DarkMetric label="Coureurs" value="28" />
        <DarkMetric label="Budget" value="4,8 M€" />
        <DarkMetric label="Confiance" value="85 %" accent />
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full w-[85%] rounded-full bg-[#F2C94C]" />
      </div>

      <button
        type="button"
        className="mt-7 w-full rounded-lg border border-[#7CCF9C]/40 bg-white/5 px-5 py-3 text-sm font-extrabold text-[#7CCF9C] transition hover:bg-white/10"
      >
        Ouvrir le cockpit
      </button>
    </article>
  );
}

function FormPanel() {
  return (
    <Panel>
      <PanelTitle label="Formulaire" />

      <div className="mt-7 space-y-5">
        <div>
          <label
            htmlFor="design-email"
            className="block text-sm font-bold"
          >
            Adresse e-mail
          </label>

          <input
            id="design-email"
            type="email"
            placeholder="directeur@cycling-manager.fr"
            className="mt-2 min-h-12 w-full rounded-lg border border-[#315B3E]/25 bg-[#F7FAF7] px-4 outline-none placeholder:text-[#78947D] focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/20"
          />
        </div>

        <div>
          <label
            htmlFor="design-team"
            className="block text-sm font-bold"
          >
            Nom de l’équipe
          </label>

          <input
            id="design-team"
            type="text"
            placeholder="Peloton Horizon"
            className="mt-2 min-h-12 w-full rounded-lg border border-[#315B3E]/25 bg-[#F7FAF7] px-4 outline-none placeholder:text-[#78947D] focus:border-[#42B99A] focus:ring-2 focus:ring-[#42B99A]/20"
          />
        </div>
      </div>
    </Panel>
  );
}

function RacePanel() {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <PanelTitle label="Profil d’étape" />

        <span className="rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-extrabold text-[#071A17]">
          167 km
        </span>
      </div>

      <div className="mt-7">
        <svg
          aria-label="Profil montagneux de la prochaine étape"
          viewBox="0 0 600 180"
          className="h-48 w-full"
        >
          <defs>
            <linearGradient id="profile-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#42CDA8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#42CDA8" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <path
            d="M0 160 L55 150 L105 115 L155 142 L225 75 L280 130 L350 92 L410 125 L485 48 L540 82 L600 20 L600 180 L0 180 Z"
            fill="url(#profile-fill)"
          />

          <path
            d="M0 160 L55 150 L105 115 L155 142 L225 75 L280 130 L350 92 L410 125 L485 48 L540 82 L600 20"
            fill="none"
            stroke="#278B70"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#60756E]">
          <span>3 ascensions</span>
          <span>4 150 m D+</span>
          <span>Arrivée au sommet</span>
        </div>
      </div>
    </Panel>
  );
}

function PrinciplesSection() {
  return (
    <section className="relative overflow-hidden bg-[#EAF5F3] px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-375">
        <SectionHeading
          eyebrow="Philosophie"
          title="Une interface qui donne envie de poursuivre la route"
          description="Le joueur doit ressentir l’aventure sportive avant même d’entrer dans les écrans de gestion."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {principles.map((principle) => (
            <article
              key={principle.number}
              className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_38px_rgba(19,60,46,0.10)]"
            >
              <span className="text-4xl font-black text-[#42B99A]/40">
                {principle.number}
              </span>

              <h3 className="mt-5 text-2xl font-black">{principle.title}</h3>

              <p className="mt-3 leading-7 text-[#60756E]">
                {principle.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#278B70]">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
        {title}
      </h2>

      <p className="mt-5 text-lg leading-8 text-[#60756E]">{description}</p>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-2xl border border-[#315B3E]/15 bg-white p-6 shadow-[0_16px_38px_rgba(19,60,46,0.10)]">
      {children}
    </article>
  );
}

function PanelTitle({
  label,
  dark = false,
}: {
  label: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          dark ? "bg-[#F2C94C]" : "bg-[#42CDA8]"
        }`}
      />

      <h2
        className={`text-sm font-extrabold uppercase tracking-[0.18em] ${
          dark ? "text-[#F2C94C]" : "text-[#278B70]"
        }`}
      >
        {label}
      </h2>
    </div>
  );
}

function TypographyRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#315B3E]/10 pb-5 last:border-0 last:pb-0">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#78947D]">
        {label}
      </p>

      <div>{children}</div>
    </div>
  );
}

function DarkMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm text-[#D6DFD2]">{label}</span>

      <span
        className={`font-black ${
          accent ? "text-[#F2C94C]" : "text-[#FFFDF4]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}