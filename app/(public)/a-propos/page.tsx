import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Découvrez le projet Cyclo Stratège : sa vision, ses valeurs et l’équipe qui le développe.",
};

const values = [
  {
    title: "La passion du cyclisme",
    description:
      "Cyclo Stratège est né d’un amour sincère pour le vélo et pour la richesse tactique des courses. Chaque détail du jeu cherche à retranscrire cette passion.",
  },
  {
    title: "La profondeur stratégique",
    description:
      "Nous voulons un jeu où chaque décision compte : recrutement, calendrier, tactiques de course. La réflexion prime sur le hasard.",
  },
  {
    title: "Un développement transparent",
    description:
      "Le projet avance étape par étape, au grand jour. Le journal des nouveautés documente chaque évolution partagée avec la communauté.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutStory />
      <AboutValues />
    </>
  );
}

function AboutHero() {
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
            À propos
          </span>

          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] text-[#082A2A] sm:text-6xl lg:text-7xl">
            Un jeu pensé par
            <span className="mt-2 block text-[#42B99A]">
              des passionnés de vélo.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#25443F]">
            Cyclo Stratège est un jeu de management cycliste dans lequel vous
            dirigez votre propre équipe. Notre ambition : offrir une expérience
            riche, fidèle à l’esprit tactique des courses.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/guide"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#071A17]"
            >
              Découvrir le guide
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

function AboutStory() {
  return (
    <section className="relative overflow-hidden bg-[#F7FAF7] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#42A884]">
          Notre projet
        </p>

        <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          L’histoire de Cyclo Stratège
        </h2>

        <div className="mt-8 space-y-6 text-lg leading-8 text-[#3B564F]">
          <p>
            Cyclo Stratège est un projet indépendant, développé avec soin et
            porté par l’envie de créer le jeu de management cycliste que nous
            aurions aimé avoir entre les mains.
          </p>

          <p>
            L’idée est simple : vous placer dans le rôle d’un directeur sportif.
            À vous de recruter les bons coureurs, de bâtir un collectif, de
            choisir vos courses et de définir vos tactiques pour écrire votre
            propre légende.
          </p>

          <p>
            Le développement se fait par étapes, avec un objectif constant : la
            qualité plutôt que la précipitation. Chaque nouvelle version enrichit
            le jeu et se retrouve documentée dans le journal de développement,
            accessible depuis la page d’accueil.
          </p>
        </div>
      </div>

      <RoadDecoration />
    </section>
  );
}

function AboutValues() {
  return (
    <section className="relative overflow-hidden bg-[#EAF5F3] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#42A884]">
            Nos valeurs
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Ce qui guide le développement
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {values.map((value) => (
            <article
              key={value.title}
              className="rounded-2xl border border-[#315B3E]/20 bg-white p-6 shadow-[0_18px_45px_rgba(19,60,46,0.10)] sm:p-7"
            >
              <h3 className="text-xl font-black tracking-tight">
                {value.title}
              </h3>

              <p className="mt-3 leading-7 text-[#536B64]">
                {value.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-[#315B3E]/15 bg-[#0B302B] px-6 py-8 text-center text-[#FFFDF4] sm:px-10">
          <h2 className="text-2xl font-black sm:text-3xl">
            Rejoignez l’aventure
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-[#D6DFD2]">
            Créez votre compte et commencez à construire votre équipe dès
            aujourd’hui.
          </p>

          <Link
            href="/inscription"
            className="mt-7 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          >
            Créer mon compte
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
