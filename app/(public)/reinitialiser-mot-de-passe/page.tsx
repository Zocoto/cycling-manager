import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { PasswordUpdateForm } from "../../../components/auth/password-update-form";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  description:
    "Choisissez un nouveau mot de passe pour votre compte Cyclostratège.",
};

type PasswordResetPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function PasswordResetPage({
  searchParams,
}: PasswordResetPageProps) {
  const { status } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.getClaims();

  const hasRecoverySession =
    !error && Boolean(data?.claims?.sub);

  const resetIsReady =
    status === "ready" && hasRecoverySession;

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

      <div className="relative mx-auto grid min-h-175 max-w-375 gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_470px] lg:items-center lg:gap-20">
        <div className="max-w-2xl text-[#082A2A]">
          <span className="inline-flex rounded-full bg-[#F2C94C] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#071A17] shadow-md">
            Nouveau départ
          </span>

          <h1 className="mt-7 text-5xl font-black leading-[0.95] tracking-[-0.045em] sm:text-6xl">
            Sécurisez à nouveau
            <span className="mt-2 block text-[#42B99A]">
              votre carrière.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-[#36554E]">
            Choisissez un nouveau mot de passe difficile à deviner.
            Après son enregistrement, vous pourrez reprendre votre
            carrière depuis la page de connexion.
          </p>

          <ul className="mt-9 space-y-4">
            <Benefit>
              Utilisez au moins 12 caractères.
            </Benefit>

            <Benefit>
              Évitez les informations personnelles faciles à deviner.
            </Benefit>

            <Benefit>
              Utilisez un mot de passe différent de vos autres comptes.
            </Benefit>
          </ul>

          <RoadSeparator />
        </div>

        <article className="relative overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] text-[#FFFDF4] shadow-[0_28px_80px_rgba(7,26,23,0.30)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42B99A] via-[#F2C94C] to-[#42B99A]" />

          <WheelDecoration />

          <div className="relative p-6 sm:p-8">
            {resetIsReady ? (
              <>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
                    Espace directeur sportif
                  </p>

                  <h2 className="mt-3 text-2xl font-black">
                    Choisir un nouveau mot de passe
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#BFD1C6]">
                    Saisissez puis confirmez le nouveau mot de passe de
                    votre compte.
                  </p>
                </div>

                <div className="mt-7">
                  <PasswordUpdateForm />
                </div>
              </>
            ) : (
              <InvalidRecoveryLink />
            )}

            <div className="mt-7 border-t border-white/10 pt-6 text-center">
              <Link
                href="/connexion"
                className="inline-flex rounded-md font-bold text-[#F2C94C] transition hover:text-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
              >
                Revenir à la connexion
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function InvalidRecoveryLink() {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F2C94C]">
        Lien indisponible
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Ce lien ne peut pas être utilisé
      </h2>

      <div
        role="alert"
        className="mt-6 rounded-xl border border-[#F2C94C]/45 bg-[#F2C94C]/10 px-4 py-4"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2C94C] font-black text-[#071A17]"
          >
            !
          </span>

          <p className="text-sm leading-6 text-[#D6DFD2]">
            Le lien de récupération est invalide, incomplet ou expiré.
            Demandez un nouveau message pour poursuivre.
          </p>
        </div>
      </div>

      <Link
        href="/mot-de-passe-oublie"
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#F2C94C] px-5 py-3 text-center text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
      >
        Demander un nouveau lien
      </Link>
    </div>
  );
}

function Benefit({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 text-[#25443F]">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#42CDA8] text-sm font-black text-[#07302A] shadow-sm"
      >
        ✓
      </span>

      <span className="leading-7">{children}</span>
    </li>
  );
}

function RoadSeparator() {
  return (
    <div
      aria-hidden="true"
      className="mt-11 flex max-w-xl items-center gap-2 opacity-70"
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
