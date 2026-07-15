import Link from "next/link";

import { appConfig } from "../../lib/app-config";
import { WheelLogo } from "../ui/wheel-logo";

export function PublicHeader() {
  return (
    <header className="border-b border-[#86A6BC]/25 bg-[#102238]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
          aria-label="Retour à l’accueil de Cycling Manager"
        >
          <WheelLogo />

          <span className="text-lg font-bold tracking-tight text-[#F6F8FA]">
            {appConfig.name}
          </span>
        </Link>

        <nav
          aria-label="Navigation principale"
          className="flex flex-wrap items-center gap-2 sm:gap-3"
        >
          <Link
            href="/nouveautes"
            className="rounded-md px-3 py-2 text-sm font-semibold text-[#C5D3DD] transition hover:bg-[#2D5675]/35 hover:text-[#F6F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
          >
            Nouveautés
          </Link>

          <Link
            href="/connexion"
            className="rounded-md border border-[#69D5AE] bg-[#102238]/20 px-4 py-2 text-sm font-semibold text-[#F6F8FA] transition hover:bg-[#69D5AE]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
          >
            Se connecter
          </Link>

          <Link
            href="/inscription"
            className="rounded-md bg-[#55BE86] px-4 py-2 text-sm font-semibold text-[#102238] shadow-md shadow-[#07111F]/20 transition hover:bg-[#69D5AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
          >
            Créer un compte
          </Link>
        </nav>
      </div>
    </header>
  );
}