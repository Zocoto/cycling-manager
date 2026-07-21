import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "Apprenez à jouer à Cyclo Stratège : les bases du jeu, étape par étape, du recrutement à la victoire.",
};

const steps = [
  {
    number: "1",
    title: "Créez votre équipe",
    description:
      "Choisissez le nom, les couleurs et l’identité de votre formation. C’est le point de départ de votre carrière de directeur sportif.",
  },
  {
    number: "2",
    title: "Recrutez vos coureurs",
    description:
      "Analysez les profils, comparez les points forts (sprint, montagne, contre-la-montre…) et composez un effectif équilibré selon vos ambitions.",
  },
  {
    number: "3",
    title: "Préparez le calendrier",
    description:
      "Inscrivez votre équipe sur les courses. Répartissez vos coureurs entre les épreuves pour viser les bons objectifs au bon moment.",
  },
  {
    number: "4",
    title: "Définissez votre stratégie",
    description:
      "Avant chaque course, désignez un leader, choisissez vos équipiers et adaptez votre tactique au profil du parcours.",
  },
  {
    number: "5",
    title: "Suivez les résultats",
    description:
      "Analysez vos performances course après course, ajustez vos choix et faites progresser vos coureurs au fil de la saison.",
  },
  {
    number: "6",
    title: "Construisez votre légende",
    description:
      "Enchaînez les saisons, gérez votre budget et votre sponsoring, et menez votre équipe vers les plus grandes victoires.",
  },
] as const;

const tips = [
  {
    title: "Équilibrez votre effectif",
    description:
      "Une équipe qui gagne mêle des profils variés : un sprinteur pour les arrivées groupées, un grimpeur pour la montagne, des équipiers solides pour protéger votre leader.",
  },
  {
    title: "Surveillez la fatigue",
    description:
      "Un coureur ne peut pas tout gagner. Alternez les objectifs et laissez du repos pour garder vos leaders performants sur les grands rendez-vous.",
  },
  {
    title: "Pensez au long terme",
    description:
      "Recruter de jeunes talents coûte moins cher et prépare l’avenir. Un bon directeur sportif construit son équipe sur plusieurs saisons.",
  },
] as const;

export default function GuidePage() {
  return (
    <>
      <GuideHero />
      <GuideSteps />
      <GuideTips />
    </>
  );
}

function GuideHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3]">
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
            Guide du jeu
          </span>

          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] text-[#082A2A] sm:text-6xl lg:text-7xl">
            Prenez le départ
            <span className="mt-2 block text-[#42B99A]">en toute sérénité.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#25443F]">
            Découvrez comment jouer à Cyclo Stratège : les grandes étapes, du
            recrutement de vos coureurs jusqu’aux victoires qui feront votre
            légende.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/inscription"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
            >
              Commencer à jouer
              <ArrowIcon />
            </Link>

            <Link
              href="/"
              className="inline-flex min-h-12 items-center rounded-lg border-2 border-[#0B302B] bg-[#0B302B] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#FFFDF4] shadow-[0_10px_25px_rgba(7,26,23,0.22)] transition hover:-translate-y-0.5 hover:bg-[#123f37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B302B]"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function GuideSteps() {
  return (
    <section className="relative overflow-hidden bg-[#F7FAF7] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 border-b border-[#315B3E]/15 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#42A884]">
              Pas à pas
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Les 6 étapes pour bien démarrer
            </h2>
          </div>

          <p className="max-w-md text-sm leading-6 text-[#60756E]">
            Suivez ces étapes dans l’ordre pour prendre en main le jeu et lancer
            votre première saison sereinement.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.number}
              className="group relative overflow-hidden rounded-2xl border border-[#315B3E]/20 bg-white p-6 shadow-[0_18px_45px_rgba(19,60,46,0.10)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_60px_rgba(19,60,46,0.16)] sm:p-7"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#42CDA8] text-lg font-black text-[#07302A] shadow-[0_12px_30px_rgba(66,205,168,0.28)]">
                {step.number}
              </span>

              <h3 className="mt-6 text-xl font-black tracking-tight">
                {step.title}
              </h3>

              <p className="mt-3 leading-7 text-[#536B64]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>

      <RoadDecoration />
    </section>
  );
}

function GuideTips() {
  return (
    <section className="relative overflow-hidden bg-[#EAF5F3] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#42A884]">
            Conseils de directeur sportif
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Quelques réflexes pour progresser
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tips.map((tip) => (
            <article
              key={tip.title}
              className="rounded-2xl border border-[#315B3E]/20 bg-white p-6 shadow-[0_18px_45px_rgba(19,60,46,0.10)] sm:p-7"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B302B] text-[#7CCF9C] shadow-lg">
                <StarIcon />
              </span>

              <h3 className="mt-6 text-lg font-black tracking-tight">
                {tip.title}
              </h3>

              <p className="mt-3 leading-7 text-[#536B64]">
                {tip.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] px-6 py-8 text-center text-[#FFFDF4] sm:px-10">
          <h2 className="text-2xl font-black sm:text-3xl">
            Prêt à prendre la tête du peloton ?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#D6DFD2]">
            Créez votre compte et lancez votre première carrière dès maintenant.
          </p>

          <Link
            href="/inscription"
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            Créer mon équipe
            <ArrowIcon />
          </Link>
        </div>
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

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
    >
      <path d="m12 2.8 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 2.8Z" />
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
