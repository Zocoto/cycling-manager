import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { RegistrationForm } from "../../../components/auth/registration-form";
import {
  readMarketingAttribution,
  type MarketingSearchParams,
} from "../../../lib/marketing/attribution";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getPublicReferralInvitation } from "../../../services/referrals";

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Créez votre compte Cyclo Stratège et votre identité de directeur sportif.",
  alternates: {
    canonical: "/inscription",
  },
  openGraph: {
    url: "/inscription",
    title: "Rejoindre Cyclo Stratège",
    description:
      "Créez votre compte et prenez la direction de votre équipe cycliste.",
  },
};

const benefits = [
  "Recrutez vos coureurs et choisissez vos courses.",
  "Préparez vos tactiques et suivez les résultats.",
  "Faites grandir votre équipe saison après saison.",
] as const;

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<
    MarketingSearchParams & { parrain?: string | string[] }
  >;
}) {
  const resolvedSearchParams = await searchParams;
  const rawReferralCode = resolvedSearchParams.parrain;
  const referralCode = Array.isArray(rawReferralCode)
    ? rawReferralCode[0]
    : rawReferralCode;
  const marketingAttribution = readMarketingAttribution(
    resolvedSearchParams,
  );
  const supabase = await createSupabaseServerClient();
  const invitation = referralCode
    ? await getPublicReferralInvitation(supabase, referralCode)
    : null;

  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-position-[70%_center] bg-no-repeat"
        style={{
          backgroundImage: "url('/images/peloton-header.webp')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.97) 38%, rgba(236,247,242,0.76) 61%, rgba(7,26,23,0.32) 100%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(247,250,247,0.92) 100%)",
        }}
      />

      <MountainDecoration />

      <div className="relative mx-auto grid max-w-375 gap-6 px-4 py-8 sm:px-8 lg:min-h-175 lg:grid-cols-[1fr_470px] lg:items-center lg:gap-20 lg:py-16">
        <div className="max-w-2xl text-[#082A2A]">
          <span className="inline-flex rounded-full bg-[#F2C94C] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#071A17] shadow-md">
            Jeu gratuit
          </span>

          <h1 className="mt-3 text-4xl font-black leading-tight tracking-[-0.045em] lg:mt-7 lg:text-6xl">
            Devenez directeur{" "}
            <span className="text-[#247C65] lg:block">
              sportif.
            </span>
          </h1>

          <p className="mt-2 max-w-xl text-base leading-6 text-[#36554E] lg:mt-6 lg:text-lg lg:leading-8">
            Montez votre équipe cycliste et affrontez les autres directeurs sportifs.
          </p>

          <ul className="mt-8 hidden space-y-4 lg:block">
            {benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex items-start gap-4 text-[#25443F]"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#42CDA8] text-sm font-black text-[#07302A] shadow-sm"
                >
                  ✓
                </span>

                <span className="leading-7">{benefit}</span>
              </li>
            ))}
          </ul>

          <RoadSeparator />
        </div>

        <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] text-[#FFFDF4] shadow-[0_28px_80px_rgba(7,26,23,0.30)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

          <WheelDecoration />

          <div className="relative p-5 sm:p-8">
            <div>
              <h2 className="text-2xl font-black">
                Créez votre compte
              </h2>

              <p className="mt-2 text-sm leading-5 text-[#BFD1C6]">
                Confirmez votre e-mail pour démarrer votre carrière.
              </p>
            </div>

            <div className="mt-5">
              <RegistrationForm
                referralCode={invitation?.code}
                referrerName={invitation?.referrerName}
                marketingAttribution={marketingAttribution}
              />
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 text-center text-sm text-[#BFD1C6]">
              Déjà un compte ?{" "}
              <Link
                href="/connexion"
                className="inline-flex rounded-md font-bold text-[#F2C94C] transition hover:text-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function RoadSeparator() {
  return (
    <div
      aria-hidden="true"
      className="mt-11 hidden max-w-xl items-center gap-2 opacity-70 lg:flex"
    >
      <div className="h-px flex-1 bg-[#315B3E]/35" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-left-${index}`}
          className="h-px w-7 bg-[#315B3E]/45"
        />
      ))}

      <span className="h-0.5 w-14 bg-[#F2C94C]" />

      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`road-right-${index}`}
          className="h-px w-7 bg-[#315B3E]/45"
        />
      ))}

      <div className="h-px flex-1 bg-[#315B3E]/35" />
    </div>
  );
}

function MountainDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-25"
    >
      <path
        d="M0 310 L170 175 L285 265 L465 90 L635 260 L790 135 L940 270 L1110 105 L1290 245 L1440 160 L1440 360 L0 360 Z"
        fill="#78B9A3"
        opacity="0.34"
      />

      <path
        d="M0 330 L215 255 L355 315 L520 195 L690 325 L870 235 L1030 335 L1210 210 L1440 300"
        fill="none"
        stroke="#315B3E"
        strokeDasharray="15 15"
        strokeWidth="3"
        opacity="0.38"
      />
    </svg>
  );
}

function WheelDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10 opacity-55"
      style={{
        background:
          "repeating-conic-gradient(transparent 0deg 13deg, rgba(124,207,156,0.10) 13deg 14deg)",
      }}
    />
  );
}
