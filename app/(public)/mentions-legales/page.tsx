import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { legalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Consultez les informations relatives à l’édition et à l’hébergement de Cyclo Stratège.",
  alternates: {
    canonical: "/mentions-legales",
  },
};

export default function LegalNoticePage() {
  return (
    <main className="bg-[#F4F8F5] text-[#173D35]">
      <header className="bg-[#0B302B] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7CCF9C]">
            Informations légales
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Mentions légales
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#D6DFD2]">
            Cyclo Stratège est un jeu indépendant gratuit, édité à titre
            non professionnel par une personne physique.
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#F2C94C]">
            Mise à jour du {legalConfig.effectiveDateLabel}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <LegalSection title="Édition du site">
          <p>
            Le site <strong>Cyclo Stratège</strong> est édité à titre non
            professionnel par une personne physique. Conformément à l’article
            1-1, II, de la loi n° 2004-575 du 21 juin 2004 pour la confiance
            dans l’économie numérique, l’éditeur a choisi de préserver son
            anonymat public. Ses éléments d’identification sont détenus par le
            fournisseur d’hébergement dans les conditions prévues par la loi.
          </p>
          <p className="mt-4">
            Pour une question relative au site ou aux données personnelles :{" "}
            <a
              href={`mailto:${legalConfig.privacyEmail}`}
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              {legalConfig.privacyEmail}
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Hébergement">
          <address className="not-italic">
            <strong>Vercel Inc.</strong>
            <br />
            440 N Barranca Avenue #4133
            <br />
            Covina, CA 91723
            <br />
            États-Unis
          </address>
          <p className="mt-4">
            Site :{" "}
            <a
              href="https://vercel.com"
              target="_blank"
              rel="noreferrer"
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              vercel.com
            </a>
          </p>
        </LegalSection>

        <LegalSection title="Propriété intellectuelle">
          <p>
            Sauf mention contraire, la structure, les textes, les règles de
            jeu, les éléments graphiques, les illustrations et le code de Cyclo
            Stratège sont protégés. Toute reproduction ou réutilisation en
            dehors de l’usage normal du service nécessite une autorisation
            préalable. Les marques et contenus appartenant à des tiers restent
            la propriété de leurs titulaires respectifs.
          </p>
        </LegalSection>

        <LegalSection title="Données personnelles">
          <p>
            Les informations concernant les données collectées, leurs finalités,
            leur conservation et vos droits figurent dans la{" "}
            <Link
              href="/confidentialite"
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </LegalSection>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/conditions-utilisation"
            className="rounded-xl bg-[#0B302B] px-5 py-3 text-sm font-black text-white transition hover:bg-[#176951]"
          >
            Conditions d’utilisation
          </Link>
          <Link
            href="/inscription"
            className="rounded-xl border border-[#315B3E]/20 bg-white px-5 py-3 text-sm font-black text-[#0B302B] transition hover:border-[#176951]/45"
          >
            Retour à l’inscription
          </Link>
        </div>
      </div>
    </main>
  );
}

function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#315B3E]/12 bg-white p-6 leading-7 shadow-[0_14px_40px_rgba(19,60,46,0.06)] sm:p-8">
      <h2 className="text-2xl font-black tracking-tight text-[#0B302B]">
        {title}
      </h2>
      <div className="mt-4 text-[#49645D]">{children}</div>
    </section>
  );
}
