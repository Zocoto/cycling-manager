"use client";

import Image from "next/image";

import Link from "@/components/ui/app-link";

import { appConfig } from "../../lib/app-config";
import { useLocale } from "@/components/i18n/locale-provider";
import { WheelLogo } from "../ui/wheel-logo";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();
  const { locale } = useLocale();
  const isEnglish = locale === "en";

  return (
    <footer className="relative overflow-hidden border-t border-[#78947D]/25 bg-[#071A17]">
      <MountainFooter />

      <div className="relative mx-auto max-w-375 px-5 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.2fr_0.65fr_0.7fr_0.95fr]">
          <div>
            <div className="flex items-center gap-3">
              <WheelLogo className="h-8 w-8" />

              <div>
                <p className="text-lg font-extrabold text-[#FFFDF4]">
                  {appConfig.name}
                </p>

                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#F2C94C]">
                  {isEnglish ? "Become a sports director" : "Devenez directeur sportif"}
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-6 text-[#D6DFD2]">
              {isEnglish
                ? "Build your team, prepare your races and write your own story in the peloton."
                : "Construisez votre équipe, préparez vos courses et écrivez votre propre histoire dans le peloton."}
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              Navigation
            </p>

            <div className="mt-4 flex flex-col gap-3 text-sm text-[#D6DFD2]">
              <Link
                href="/"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                {isEnglish ? "Home" : "Accueil"}
              </Link>

              <Link
                href="/beta-saison-2"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                {isEnglish ? "Season 2 · Beta" : "Saison 2 · Bêta"}
              </Link>

              <Link
                href="/guide"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                Guide
              </Link>

              <Link
                href="/a-propos"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                {isEnglish ? "About" : "À propos"}
              </Link>

              <Link
                href="/connexion"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                {isEnglish ? "Log in" : "Connexion"}
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              {isEnglish ? "Development" : "Développement"}
            </p>

            <p className="mt-4 text-sm leading-6 text-[#D6DFD2]">
              {isEnglish ? "Version" : "Version"} {appConfig.version}
              <br />
              {isEnglish ? "Project in active development" : "Projet en développement actif"}
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              {isEnglish ? "Follow us" : "Nous suivre"}
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <SocialLink
                href={appConfig.discordUrl}
                label="Discord"
                description={isEnglish ? "Join the community" : "Rejoindre la communauté"}
                iconSrc="/images/social/discord-symbol.svg"
                iconAlt=""
                iconClassName="h-5 w-7"
              />
              <SocialLink
                href={appConfig.instagramUrl}
                label="Instagram"
                description="@cyclostratege"
                iconSrc="/images/social/instagram-glyph.svg"
                iconAlt=""
                iconClassName="h-7 w-7"
              />
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-[#78947D]/20 pt-6 text-xs text-[#AFC0B1] sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Cyclo Stratège</p>

          <p className="uppercase tracking-[0.26em] text-[#D9C978]">
            {isEnglish
              ? "Your journey · Your team · Your story"
              : "Votre voyage · Votre équipe · Votre histoire"}
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  description,
  iconSrc,
  iconAlt,
  iconClassName,
}: {
  href: string;
  label: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  iconClassName: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} — ${description}`}
      className="group flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:-translate-y-0.5 hover:border-[#7CCF9C]/45 hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CCF9C]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.08] shadow-inner">
        <Image
          src={iconSrc}
          alt={iconAlt}
          width={32}
          height={32}
          className={iconClassName}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-[#FFFDF4]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#AFC0B1]">
          {description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-sm font-black text-[#7CCF9C] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        ↗
      </span>
    </a>
  );
}
function MountainFooter() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 230"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full opacity-[0.10]"
    >
      <path
        d="M0 190 L155 115 L275 170 L420 70 L575 180 L735 100 L910 185 L1075 80 L1235 165 L1440 95 L1440 230 L0 230 Z"
        fill="#7CCF9C"
      />

      <path
        d="M0 210 L210 160 L345 205 L510 135 L675 210 L850 160 L1020 215 L1205 140 L1440 205"
        fill="none"
        stroke="#F2C94C"
        strokeDasharray="15 14"
        strokeWidth="2"
      />
    </svg>
  );
}
