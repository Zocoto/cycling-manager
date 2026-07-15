import Link from "next/link";

import { appConfig } from "../../lib/app-config";
import { WheelLogo } from "../ui/wheel-logo";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#86A6BC]/25 bg-[#0C1B2C]">
      <div className="mx-auto flex max-w-375 flex-col gap-5 px-5 py-7 text-sm text-[#C5D3DD] sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <WheelLogo className="h-6 w-6" />

          <div>
            <p className="font-semibold text-[#F6F8FA]">{appConfig.name}</p>

            <p className="mt-0.5 text-xs">
              Version {appConfig.version} · Projet en développement
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Link
            href="/nouveautes"
            className="w-fit rounded-sm transition hover:text-[#69D5AE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69D5AE]"
          >
            Consulter les nouveautés
          </Link>

          <p>© {currentYear} Cycling Manager</p>
        </div>
      </div>
    </footer>
  );
}