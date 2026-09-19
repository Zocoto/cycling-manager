import Link from "@/components/ui/app-link";
import type { AppLocale } from "@/lib/i18n/config";
import {
  buildWelcomeOfferSignupHref,
  formatWelcomeOfferCash,
  formatWelcomeOfferDeadline,
  type PublicWelcomeOffer,
} from "@/lib/marketing/welcome-offer";

export function WelcomeOfferSpotlight({
  offer,
  locale,
  placement,
}: {
  offer: PublicWelcomeOffer;
  locale: AppLocale;
  placement: "homepage" | "registration";
}) {
  const isEnglish = locale === "en";
  const totalCash = formatWelcomeOfferCash(offer.totalStartingCash, locale);
  const extraCash = formatWelcomeOfferCash(offer.extraStartingCash, locale);
  const deadline = formatWelcomeOfferDeadline(offer.endsAt, locale);
  const isHomepage = placement === "homepage";

  return (
    <aside
      aria-label={
        isEnglish ? "Limited welcome gift" : "Cadeau de bienvenue limité"
      }
      className={[
        "relative overflow-hidden rounded-2xl border border-[#D9B83E]/55 bg-[#071A17] text-[#FFFDF4] shadow-[0_18px_50px_rgba(7,26,23,0.24)]",
        isHomepage ? "mt-8 max-w-3xl p-5 sm:p-6" : "mt-8 p-5 sm:p-6",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#F2C94C] via-[#42CDA8] to-[#F2C94C]"
      />
      <span
        aria-hidden="true"
        className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[38px] border-[#42CDA8]/8"
      />

      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#071A17]">
            {isEnglish ? "Welcome gift" : "Cadeau de bienvenue"}
          </span>
          <span className="text-xs font-bold text-[#BFD1C6]">
            {isEnglish ? `Available until ${deadline}` : `Disponible jusqu’au ${deadline}`}
          </span>
        </div>

        <h2 className="mt-4 max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {isEnglish
            ? `Start with ${totalCash} and a level ${offer.scoutLevel} scout`
            : `Démarrez avec ${totalCash} et un scout niveau ${offer.scoutLevel}`}
        </h2>

        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#D6DFD2] sm:text-base">
          {isEnglish
            ? `${extraCash} extra starting cash, plus a scout from your team’s nation joining your staff with no signing fee.`
            : `${extraCash} de budget initial supplémentaire, plus un scout de la nationalité de votre équipe qui rejoint votre staff sans indemnité de signature.`}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isHomepage ? (
            <Link
              href={buildWelcomeOfferSignupHref(offer, "homepage_spotlight")}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F2C94C] px-5 text-sm font-black text-[#071A17] transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isEnglish ? "Create my team" : "Créer mon équipe"}
            </Link>
          ) : null}
          <span className="text-xs font-semibold leading-5 text-[#9FB5A8]">
            {isEnglish
              ? "The scout’s normal seasonal salary still applies. One gift per new career."
              : "Le salaire saisonnier normal du scout reste dû. Un seul cadeau par nouvelle carrière."}
          </span>
        </div>
      </div>
    </aside>
  );
}
