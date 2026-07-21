import Link from "@/components/ui/app-link";

import { WheelLogo } from "../ui/wheel-logo";

const navigationItems = [
  {
    href: "/",
    label: "Accueil",
  },
  {
    href: "/guide",
    label: "Guide",
  },
  {
    href: "/a-propos",
    label: "À propos",
  },
] as const;

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#78947D]/25 bg-[#071A17]/95 shadow-lg shadow-black/15 backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]"
      />

      <div className="mx-auto flex max-w-375 items-center justify-between gap-6 px-5 pb-4 pt-5 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
          aria-label="Retour à l’accueil de Cyclo Stratège"
        >
          <WheelLogo className="h-12 w-12" />

          <span className="inline-flex h-11 -translate-y-[3px] flex-col justify-between leading-none">
            <span
              aria-hidden="true"
              className="-mt-[2px] flex justify-between text-2xl font-extrabold uppercase text-[#FFFDF4]"
            >
              <span>C</span>
              <span>Y</span>
              <span>C</span>
              <span>L</span>
              <span>O</span>
            </span>

            <span className="-mb-[2px] block text-sm font-semibold uppercase tracking-[0.3em] text-[#F2C94C] -me-[0.3em]">
              Stratège
            </span>
          </span>
        </Link>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-2 lg:flex"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-4 py-2 text-sm font-semibold text-[#D6DFD2] transition hover:bg-[#315B3E]/35 hover:text-[#F2C94C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/connexion"
            className="hidden min-h-10 items-center justify-center rounded-md border border-[#D6DFD2]/45 bg-[#071A17]/45 px-4 py-2 text-sm font-semibold text-[#FFFDF4] transition hover:border-[#F2C94C] hover:text-[#F2C94C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C] sm:inline-flex"
          >
            Se connecter
          </Link>

          <Link
            href="/inscription"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#F2C94C] px-4 py-2 text-sm font-extrabold text-[#071A17] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
          >
            Jouer maintenant
          </Link>
        </div>
      </div>

      <div className="border-t border-[#78947D]/15 px-5 py-2 lg:hidden">
        <nav
          aria-label="Navigation mobile"
          className="mx-auto flex max-w-375 items-center justify-center gap-1"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-xs font-semibold text-[#D6DFD2] transition hover:bg-[#315B3E]/35 hover:text-[#F2C94C]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}