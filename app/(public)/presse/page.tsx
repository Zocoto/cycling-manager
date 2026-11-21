import type { Metadata } from "next";
import Image from "next/image";

import Link from "@/components/public/public-link";
import { appConfig } from "@/lib/app-config";
import { getRequestLocale } from "@/lib/i18n/server";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return buildPublicMetadata({
    path: "/presse", locale,
    title: locale === "en" ? "Press and creators" : "Presse et créateurs",
    description: locale === "en"
      ? "Discover Cyclo Stratège: a free online cycling management game. Presentation, game information and official visuals for press and content creators."
      : "Présenter Cyclo Stratège, jeu gratuit de management cycliste en ligne : présentation du jeu, informations et visuels officiels pour la presse et les créateurs.",
  });
}

export default async function PressPage() {
  const isEnglish = (await getRequestLocale()) === "en";
  return (
    <article className="bg-[#F7FAF7] px-5 py-12 text-[#082A2A] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#278B70]">{isEnglish ? "Press · Cycling communities · Creators" : "Presse · Communautés vélo · Créateurs"}</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{isEnglish ? "Meet Cyclo Stratège." : "Faire découvrir Cyclo Stratège."}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#48665F]">{isEnglish ? "An independent cycling management game, free to play in a browser on desktop and mobile." : "Un jeu indépendant de management cycliste, gratuit et accessible dans un navigateur sur ordinateur et mobile."}</p>

        <section className="mt-10 rounded-2xl border border-[#315B3E]/15 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-black">{isEnglish ? "The game in a few words" : "Le jeu en quelques mots"}</h2>
          <p className="mt-5 leading-8 text-[#48665F]">{isEnglish ? "In Cyclo Stratège, you become a sports director. Build a cycling team, recruit and train riders, manage staff and facilities, and prepare a calendar of races against other managers. Rider profiles, form, morale and team tactics shape your decisions on the way to the next finish line." : "Dans Cyclo Stratège, vous devenez Directeur Sportif. Construisez une équipe cycliste, recrutez et entraînez vos coureurs, gérez le staff et les infrastructures, puis préparez un calendrier de courses face aux autres managers. Profils des coureurs, forme, moral et tactiques d’équipe accompagnent vos décisions jusqu’à la prochaine ligne d’arrivée."}</p>
          <dl className="mt-6 grid gap-4 border-t border-[#315B3E]/15 pt-6 sm:grid-cols-2">
            {[
              [isEnglish ? "Genre" : "Genre", isEnglish ? "Cycling · Management · Strategy" : "Cyclisme · Gestion · Stratégie"],
              [isEnglish ? "Price" : "Accès", isEnglish ? "Free to play" : "Gratuit"],
              [isEnglish ? "Platform" : "Plateforme", isEnglish ? "Browser · Desktop and mobile" : "Navigateur · Ordinateur et mobile"],
              [isEnglish ? "Project" : "Projet", isEnglish ? "Independent · In active development" : "Indépendant · En développement actif"],
            ].map(([term, value]) => <div key={term}><dt className="text-xs font-black uppercase tracking-wider text-[#278B70]">{term}</dt><dd className="mt-2 font-semibold">{value}</dd></div>)}
          </dl>
        </section>

        <section className="mt-8 rounded-2xl bg-[#EAF5F3] p-6 sm:p-8">
          <h2 className="text-2xl font-black">{isEnglish ? "Official visuals" : "Visuels officiels"}</h2>
          <p className="mt-4 leading-7 text-[#48665F]">{isEnglish ? "Use these visuals to present the game, with a link to cyclostratege.fr. Please keep the logo’s proportions and the game name." : "Ces visuels peuvent accompagner une présentation du jeu avec un lien vers cyclostratege.fr. Merci de conserver les proportions du logo et le nom du jeu."}</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-[0.6fr_1fr]">
            <a href="/logo-cyclo-stratege.png" className="flex min-h-44 flex-col items-center justify-center gap-4 rounded-xl border border-[#315B3E]/15 bg-white p-5 font-bold text-[#176951]">
              <Image src="/logo-cyclo-stratege.png" width={120} height={120} alt="Cyclo Stratège" className="h-24 w-24 object-contain" />
              {isEnglish ? "Open the logo →" : "Ouvrir le logo →"}
            </a>
            <a href="/opengraph-image.png" className="overflow-hidden rounded-xl border border-[#315B3E]/15 bg-white font-bold text-[#176951]">
              <Image src="/opengraph-image.png" width={1200} height={630} alt={isEnglish ? "Cyclo Stratège promotional visual" : "Visuel de présentation de Cyclo Stratège"} className="h-auto w-full" />
              <span className="block p-4">{isEnglish ? "Open the promotional visual →" : "Ouvrir le visuel de présentation →"}</span>
            </a>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-[#0B302B] p-6 text-[#FFFDF4] sm:p-8">
          <h2 className="text-2xl font-black">{isEnglish ? "Discover the game with the community" : "Découvrir le jeu avec la communauté"}</h2>
          <p className="mt-4 leading-7 text-[#D6DFD2]">{isEnglish ? "The public guide explains the first steps and the main management decisions. Join the official Discord to ask about the project or discuss a presentation of the game." : "Le guide public présente les premières étapes et les principales décisions de gestion. Le Discord officiel permet d’échanger sur le projet ou de préparer une présentation du jeu."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/guide" className="inline-flex min-h-12 items-center rounded-xl bg-[#F2C94C] px-5 py-3 font-black text-[#071A17]">{isEnglish ? "Read the guide" : "Lire le guide"}</Link>
            <a href={appConfig.discordUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-5 py-3 font-bold">{isEnglish ? "Join the official Discord ↗" : "Rejoindre le Discord officiel ↗"}</a>
          </div>
        </section>
      </div>
    </article>
  );
}
