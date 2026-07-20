import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirmation de l’inscription",
  description:
    "Confirmation de l’adresse e-mail de votre compte Cyclo Stratège.",
};

type ConfirmationPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationPageProps) {
  const { status } = await searchParams;
  const confirmationSucceeded = status === "success";

  return (
    <section className="relative isolate overflow-hidden bg-[#EAF5F3]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-position-[70%_center] bg-no-repeat"
        style={{
          backgroundImage: "url('/images/peloton-header.png')",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(248,252,250,0.99) 0%, rgba(244,250,247,0.97) 42%, rgba(236,247,242,0.78) 68%, rgba(7,26,23,0.34) 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-175 max-w-375 items-center justify-center px-5 py-16 sm:px-8 sm:py-20">
        <article className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[#315B3E]/30 bg-[#0B302B] text-center text-[#FFFDF4] shadow-[0_28px_80px_rgba(7,26,23,0.30)]">
          <div
            className={
              confirmationSucceeded
                ? "absolute inset-x-0 top-0 h-1 bg-[#42CDA8]"
                : "absolute inset-x-0 top-0 h-1 bg-[#F2C94C]"
            }
          />

          <WheelDecoration />

          <div className="relative p-7 sm:p-10">
            <span
              aria-hidden="true"
              className={
                confirmationSucceeded
                  ? "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#42CDA8] text-3xl font-black text-[#07302A] shadow-lg"
                  : "mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F2C94C] text-3xl font-black text-[#071A17] shadow-lg"
              }
            >
              {confirmationSucceeded ? "✓" : "!"}
            </span>

            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-[#7CCF9C]">
              Nouvelle carrière
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              {confirmationSucceeded
                ? "Adresse e-mail confirmée"
                : "Confirmation impossible"}
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-[#BFD1C6]">
              {confirmationSucceeded
                ? "Votre compte Cyclo Stratège est désormais validé. La connexion sera activée lors de la prochaine étape du développement."
                : "Le lien de confirmation est invalide ou a expiré. Une nouvelle demande de confirmation pourra être effectuée depuis l’espace de connexion."}
            </p>

            <div className="mt-8">
              {confirmationSucceeded ? (
                <Link
                  href="/connexion"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#F2C94C] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#071A17] shadow-lg transition hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B302B]"
                >
                  Accéder à la connexion
                </Link>
              ) : (
                <Link
                  href="/inscription"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#F2C94C]/70 px-6 py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-[#F2C94C] transition hover:bg-[#F2C94C]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
                >
                  Retour à l’inscription
                </Link>
              )}
            </div>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-md text-sm font-bold text-[#9FB5A8] transition hover:text-[#FFFDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42CDA8]"
            >
              Revenir à l’accueil
            </Link>
          </div>
        </article>
      </div>
    </section>
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