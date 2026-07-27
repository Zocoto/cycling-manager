import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { EmailVerificationResendForm } from "@/components/auth/email-verification-resend-form";
import { getEmailCallbackCredentials } from "@/lib/auth/email-callback";
import { confirmSignupEmailAction } from "./actions";

export const metadata: Metadata = {
  title: "Confirmer votre adresse e-mail",
  description:
    "Validez explicitement l’adresse e-mail de votre compte Cyclo Stratège.",
};

type ConfirmSignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConfirmSignupPage({
  searchParams,
}: ConfirmSignupPageProps) {
  const rawSearchParams = await searchParams;
  const normalizedSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (typeof value === "string") {
      normalizedSearchParams.set(key, value);
    }
  }

  const credentials = getEmailCallbackCredentials(
    normalizedSearchParams,
    "email",
  );
  const tokenHash =
    credentials?.strategy === "token-hash"
      ? credentials.tokenHash
      : null;

  return (
    <section className="relative isolate min-h-175 overflow-hidden bg-[#EAF5F3] px-5 py-16 sm:px-8 sm:py-20">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/peloton-header.webp')",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,252,250,0.97),rgba(236,247,242,0.82),rgba(7,26,23,0.42))]"
      />

      <article className="relative mx-auto mt-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] p-7 text-center text-[#FFFDF4] shadow-[0_28px_80px_rgba(7,26,23,0.30)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#F2C94C]" />
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F2C94C] text-[#071A17]">
          <EmailShieldIcon />
        </span>
        <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
          Sécurité du compte
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">
          Confirmer votre adresse
        </h1>

        {tokenHash ? (
          <>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#BFD1C6]">
              Dernière étape : confirmez que vous êtes bien à
              l’origine de cette inscription. Vous pourrez ensuite vous
              connecter normalement.
            </p>
            <form
              action={confirmSignupEmailAction}
              className="mt-8"
            >
              <input
                type="hidden"
                name="tokenHash"
                value={tokenHash}
              />
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Valider mon adresse e-mail
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#BFD1C6]">
              Ce lien est incomplet ou invalide. Demandez un nouvel
              e-mail de confirmation ci-dessous.
            </p>
            <div className="mt-7 text-left">
              <EmailVerificationResendForm />
            </div>
          </>
        )}

        <Link
          href="/connexion"
          className="mt-7 inline-flex rounded-md text-sm font-bold text-[#9FB5A8] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42CDA8]"
        >
          Retour à la connexion
        </Link>
      </article>
    </section>
  );
}

function EmailShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-8 w-8"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
      <path d="m15.5 17.5 2 2 3.5-4" />
    </svg>
  );
}
