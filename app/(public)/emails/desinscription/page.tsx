import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { isMarketingUnsubscribeToken } from "@/lib/marketing/email-preferences";
import { unsubscribeMarketingEmailAction } from "./actions";

export const metadata: Metadata = {
  title: "Préférences e-mail",
  description: "Gérez les e-mails d’actualité Cyclo Stratège.",
  robots: {
    index: false,
    follow: false,
  },
};

type UnsubscribePageProps = {
  searchParams: Promise<{
    token?: string;
    lang?: string;
    status?: string;
  }>;
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const params = await searchParams;
  const isEnglish = params.lang === "en";
  const token = params.token?.trim() ?? "";
  const validToken = isMarketingUnsubscribeToken(token);
  const succeeded = params.status === "success";
  const failed =
    params.status === "error"
    || params.status === "invalid"
    || (!validToken && !succeeded);

  return (
    <section className="bg-[#EAF5F3] px-5 py-16 text-[#173D35] sm:px-8 sm:py-24">
      <article className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-[#315B3E]/20 bg-white shadow-[0_24px_70px_rgba(7,26,23,0.16)]">
        <header className="bg-[#0B302B] px-6 py-8 text-white sm:px-9">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7CCF9C]">
            {isEnglish ? "Email preferences" : "Préférences e-mail"}
          </p>
          <h1 className="mt-3 text-3xl font-black">
            {succeeded
              ? isEnglish
                ? "You have been unsubscribed"
                : "Vous êtes désinscrit"
              : isEnglish
                ? "Cyclo Stratège news"
                : "Actualités Cyclo Stratège"}
          </h1>
        </header>

        <div className="px-6 py-8 sm:px-9">
          {succeeded ? (
            <p className="leading-7 text-[#49645D]">
              {isEnglish
                ? "You will no longer receive optional Cyclo Stratège news emails. Account and service messages remain active."
                : "Vous ne recevrez plus les e-mails facultatifs d’actualité de Cyclo Stratège. Les messages liés au compte et au service restent actifs."}
            </p>
          ) : failed ? (
            <p role="alert" className="leading-7 text-[#8B3138]">
              {isEnglish
                ? "This unsubscribe link is invalid or temporarily unavailable. You can also change the preference from the user menu after signing in."
                : "Ce lien de désinscription est invalide ou temporairement indisponible. Vous pouvez aussi modifier cette préférence depuis le menu utilisateur après connexion."}
            </p>
          ) : (
            <>
              <p className="leading-7 text-[#49645D]">
                {isEnglish
                  ? "Confirm that you no longer wish to receive optional Cyclo Stratège news emails. This does not affect messages required to operate your account."
                  : "Confirmez que vous ne souhaitez plus recevoir les e-mails facultatifs d’actualité de Cyclo Stratège. Cela n’affecte pas les messages nécessaires au fonctionnement de votre compte."}
              </p>
              <form action={unsubscribeMarketingEmailAction} className="mt-7">
                <input type="hidden" name="token" value={token} />
                <input
                  type="hidden"
                  name="locale"
                  value={isEnglish ? "en" : "fr"}
                />
                <button
                  type="submit"
                  className="min-h-12 w-full rounded-xl bg-[#0B302B] px-5 py-3 text-sm font-black text-white transition hover:bg-[#176951] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176951]"
                >
                  {isEnglish
                    ? "Unsubscribe from news emails"
                    : "Me désinscrire des e-mails d’actualité"}
                </button>
              </form>
            </>
          )}

          <Link
            href="/"
            className="mt-7 inline-flex text-sm font-extrabold text-[#176951] underline underline-offset-4"
          >
            {isEnglish ? "Back to Cyclo Stratège" : "Retour à Cyclo Stratège"}
          </Link>
        </div>
      </article>
    </section>
  );
}
