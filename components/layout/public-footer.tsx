import Link from "next/link";

import { appConfig } from "../../lib/app-config";
import { WheelLogo } from "../ui/wheel-logo";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-[#78947D]/25 bg-[#071A17]">
      <MountainFooter />

      <div className="relative mx-auto max-w-375 px-5 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <WheelLogo className="h-8 w-8" />

              <div>
                <p className="text-lg font-extrabold text-[#FFFDF4]">
                  {appConfig.name}
                </p>

                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#F2C94C]">
                  Le cockpit du directeur sportif
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-md text-sm leading-6 text-[#D6DFD2]">
              Construisez votre équipe, préparez vos courses et écrivez votre
              propre histoire dans le peloton.
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
                Accueil
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
                À propos
              </Link>

              <Link
                href="/connexion"
                className="w-fit transition hover:text-[#F2C94C]"
              >
                Connexion
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              Développement
            </p>

            <p className="mt-4 text-sm leading-6 text-[#D6DFD2]">
              Version {appConfig.version}
              <br />
              Projet en développement actif
            </p>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-[#78947D]/20 pt-6 text-xs text-[#AFC0B1] sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Cyclo Stratège</p>

          <p className="uppercase tracking-[0.26em] text-[#D9C978]">
            Votre voyage · Votre équipe · Votre histoire
          </p>
        </div>
      </div>
    </footer>
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