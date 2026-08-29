import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { legalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description:
    "Consultez les règles d’accès et d’utilisation du jeu Cyclo Stratège.",
  alternates: {
    canonical: "/conditions-utilisation",
  },
};

export default function TermsPage() {
  return (
    <main className="bg-[#F4F8F5] text-[#173D35]">
      <header className="bg-[#0B302B] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7CCF9C]">
            Règles du peloton
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Conditions d’utilisation
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#D6DFD2]">
            Ces conditions encadrent la création d’un compte et l’utilisation
            gratuite de Cyclo Stratège.
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#F2C94C]">
            Version {legalConfig.termsVersion} · applicable le{" "}
            {legalConfig.effectiveDateLabel}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <TermsSection title="1. Éditeur et objet du service">
          <p>
            Cyclo Stratège est un jeu indépendant de management cycliste en
            ligne édité par <strong>{legalConfig.controllerName}</strong>. Le
            service permet de créer une identité de directeur sportif, gérer
            une équipe virtuelle, participer aux compétitions et échanger avec
            la communauté.
          </p>
          <p className="mt-4">
            Contact :{" "}
            <a
              href={`mailto:${legalConfig.privacyEmail}`}
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              {legalConfig.privacyEmail}
            </a>
            .
          </p>
        </TermsSection>

        <TermsSection title="2. Création et sécurité du compte">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              Les informations fournies doivent être exactes et l’adresse
              e-mail doit pouvoir être confirmée.
            </li>
            <li>
              Chaque membre est responsable de la confidentialité de son mot
              de passe et doit signaler rapidement tout accès suspect.
            </li>
            <li>
              Une personne mineure doit utiliser le service avec l’autorisation
              de son représentant légal lorsque celle-ci est requise.
            </li>
            <li>
              Les comptes automatisés, usurpés, revendus ou créés pour contourner
              une sanction sont interdits.
            </li>
          </ul>
        </TermsSection>

        <TermsSection title="3. Identité publique et contenus">
          <p>
            Le nom de directeur sportif, l’équipe, les résultats et les
            contenus publiés dans les espaces communautaires peuvent être
            visibles par les autres membres. Vous vous engagez à ne pas publier
            de contenu illicite, haineux, menaçant, harcelant, trompeur, portant
            atteinte aux droits d’autrui ou divulguant des données personnelles
            sans autorisation.
          </p>
          <p className="mt-4">
            Les liens externes sont interdits dans le chat, à l’exception des
            liens internes à Cyclo Stratège prévus pour partager des fiches ou
            des pages du jeu. Les contenus peuvent être modérés ou retirés afin
            de protéger les membres et le service.
          </p>
        </TermsSection>

        <TermsSection title="4. Loyauté du jeu">
          <p>
            Toute exploitation volontaire d’une faille, manipulation du
            service, automatisation non autorisée, fraude, collusion abusive ou
            tentative d’obtenir un avantage indu est interdite. Une anomalie
            doit être signalée sans être reproduite au-delà de ce qui est
            nécessaire pour la décrire.
          </p>
          <p className="mt-4">
            En cas de manquement, l’éditeur peut corriger les données de jeu,
            limiter certaines fonctions, suspendre ou supprimer un compte, en
            tenant compte de la gravité et de la répétition des faits.
          </p>
        </TermsSection>

        <TermsSection title="5. Disponibilité et évolution du service">
          <p>
            Cyclo Stratège est proposé gratuitement dans une version en
            développement actif. Des maintenances, corrections, équilibrages et
            évolutions peuvent modifier les règles, le calendrier ou les
            éléments virtuels. L’éditeur cherche à assurer une disponibilité
            élevée, sans pouvoir garantir une absence totale d’interruption ou
            d’erreur.
          </p>
          <p className="mt-4">
            Les monnaies, récompenses, équipements et autres éléments virtuels
            du jeu n’ont aucune valeur monétaire réelle et ne peuvent pas être
            revendus contre de l’argent.
          </p>
        </TermsSection>

        <TermsSection title="6. Propriété intellectuelle">
          <p>
            Le nom Cyclo Stratège, l’interface, les textes, règles, illustrations,
            bases de données, éléments graphiques et code du service sont
            protégés par les droits applicables. Leur reproduction ou leur
            réutilisation hors des usages normaux du jeu nécessite une
            autorisation préalable, sauf exception prévue par la loi.
          </p>
          <p className="mt-4">
            Vous conservez les droits sur les contenus originaux que vous
            publiez. Vous accordez uniquement au service l’autorisation non
            exclusive nécessaire pour les héberger, les afficher et les modérer
            pendant leur présence sur Cyclo Stratège.
          </p>
        </TermsSection>

        <TermsSection title="7. Suppression du compte">
          <p>
            Vous pouvez supprimer votre compte depuis votre profil de directeur
            sportif. Cette opération supprime la carrière et les données qui lui
            sont propres. Les résultats sportifs officiels déjà intégrés à
            l’historique du jeu peuvent être conservés sans rattachement au
            compte supprimé afin de préserver la cohérence des compétitions.
          </p>
        </TermsSection>

        <TermsSection title="8. Responsabilité">
          <p>
            L’éditeur répond de ses obligations dans les limites prévues par la
            loi. Il ne peut être tenu responsable d’un dommage causé par une
            utilisation contraire aux présentes conditions, par la divulgation
            des identifiants du membre ou par un événement extérieur qu’il ne
            pouvait raisonnablement maîtriser. Aucune clause ne limite les droits
            impératifs dont bénéficie un utilisateur.
          </p>
        </TermsSection>

        <TermsSection title="9. Modification des conditions">
          <p>
            Les conditions peuvent évoluer pour accompagner le jeu, renforcer
            sa sécurité ou respecter la réglementation. La version et sa date
            d’application sont indiquées en haut de page. Une information claire
            et, lorsque nécessaire, une nouvelle acceptation seront demandées en
            cas de modification importante.
          </p>
        </TermsSection>

        <TermsSection title="10. Droit applicable">
          <p>
            Les présentes conditions sont soumises au droit français, sans
            priver un utilisateur des protections impératives éventuellement
            applicables dans son pays de résidence. En cas de difficulté, les
            parties sont invitées à rechercher d’abord une solution amiable.
          </p>
        </TermsSection>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/confidentialite"
            className="rounded-xl bg-[#0B302B] px-5 py-3 text-sm font-black text-white transition hover:bg-[#176951]"
          >
            Politique de confidentialité
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

function TermsSection({
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
