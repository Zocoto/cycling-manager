import Link from "@/components/ui/app-link";
import { appConfig } from "@/lib/app-config";
import type { AppLocale } from "@/lib/i18n/config";

const roles = [
  {
    icon: "🚴",
    title: "Joueur",
    description:
      "Créez votre équipe, animez le peloton et partagez votre expérience avec les autres DS.",
  },
  {
    icon: "🧪",
    title: "Bêta-testeur",
    description:
      "Mettez les parcours à l’épreuve et donnez un avis franc sur l’équilibre, l’ergonomie et le rythme du jeu.",
  },
  {
    icon: "🐞",
    title: "Testeur de bugs",
    description:
      "Reproduisez les anomalies, rassemblez les informations utiles et aidez à les suivre dans le Trello du projet.",
  },
  {
    icon: "🛡️",
    title: "Modérateur",
    description:
      "Accueillez les nouveaux membres, orientez les échanges et contribuez à une communauté agréable.",
  },
] as const;

const rolesEn = [
  {
    icon: "🚴",
    title: "Player",
    description:
      "Create your team, bring the peloton to life and share your experience with other managers.",
  },
  {
    icon: "🧪",
    title: "Beta tester",
    description:
      "Challenge the game flows and give honest feedback on balance, usability and pacing.",
  },
  {
    icon: "🐞",
    title: "Bug tester",
    description:
      "Reproduce issues, gather useful evidence and help track them in the project’s Trello board.",
  },
  {
    icon: "🛡️",
    title: "Moderator",
    description:
      "Welcome new members, guide discussions and help keep the community constructive.",
  },
] as const;

export function CommunityRecruitment({ locale }: { locale: AppLocale }) {
  const isEnglish = locale === "en";
  const displayedRoles = isEnglish ? rolesEn : roles;

  return (
    <section className="bg-[#EAF5F3] px-5 py-16 text-[#082A2A] sm:px-8 sm:py-20">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#071A17] text-white shadow-[0_24px_70px_rgba(7,26,23,0.22)]">
        <div className="relative px-6 py-9 sm:px-10 sm:py-12">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
          />
          <span
            aria-hidden="true"
            className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[52px] border-[#42CDA8]/6"
          />

          <div className="relative max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8DE3C9]">
              {isEnglish ? "Join the community" : "Rejoignez l’aventure"}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              {isEnglish
                ? "Cyclo Stratège is looking for more than riders."
                : "Cyclo Stratège cherche plus que des coureurs."}
            </h2>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#D6DFD2] sm:text-lg">
              {isEnglish
                ? "The Discord is the project’s paddock: play, test, report and help us build a stronger game. Tell us how you would like to contribute when you arrive."
                : "Le Discord est le paddock du projet : venez jouer, tester, signaler et prendre des responsabilités pour nous aider à construire un jeu plus solide. À votre arrivée, dites-nous simplement comment vous souhaitez contribuer."}
            </p>
          </div>

          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {displayedRoles.map((role) => (
              <article
                key={role.title}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm"
              >
                <span className="text-2xl" aria-hidden="true">
                  {role.icon}
                </span>
                <h3 className="mt-4 text-lg font-black text-[#F2C94C]">
                  {role.title}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#BFD1C6]">
                  {role.description}
                </p>
              </article>
            ))}
          </div>

          <div className="relative mt-8 flex flex-wrap gap-3">
            <a
              href={appConfig.discordUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#5865F2] px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#6D78F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isEnglish ? "Join the Discord" : "Rejoindre le Discord"}
              <span aria-hidden="true" className="ml-2">↗</span>
            </a>
            <Link
              href="/inscription?utm_source=homepage&utm_medium=owned_media&utm_campaign=community_recruitment&utm_content=community_roles"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/8 px-5 text-sm font-black text-white transition hover:border-[#F2C94C] hover:text-[#F2C94C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              {isEnglish ? "Create my team" : "Créer mon équipe"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
