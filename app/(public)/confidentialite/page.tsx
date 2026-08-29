import type { Metadata } from "next";
import Link from "@/components/ui/app-link";

import { legalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Découvrez comment Cyclo Stratège collecte, utilise et protège vos données personnelles.",
  alternates: {
    canonical: "/confidentialite",
  },
};

const processingPurposes = [
  {
    purpose: "Créer, sécuriser et administrer votre compte",
    data: "Adresse e-mail, identifiant technique, nom de directeur sportif et données d’authentification gérées par Supabase.",
    basis: "Exécution du service demandé et mesures précontractuelles.",
  },
  {
    purpose: "Fournir le jeu et sauvegarder votre progression",
    data: "Carrière, équipe, décisions de jeu, inventaire, finances virtuelles, résultats, trophées et préférences.",
    basis: "Exécution du service demandé.",
  },
  {
    purpose: "Faire fonctionner les espaces communautaires",
    data: "Messages, réactions, mentions, messages privés et contenus que vous choisissez de publier.",
    basis: "Exécution du service et intérêt légitime à proposer et modérer la communauté.",
  },
  {
    purpose: "Sécuriser et améliorer le service",
    data: "Journaux techniques, événements de sécurité et mesures de performance anonymes ou agrégées.",
    basis: "Intérêt légitime à prévenir les abus et à maintenir un service fiable et performant.",
  },
  {
    purpose: "Confirmer l’inscription et envoyer les messages de service",
    data: "Adresse e-mail et informations strictement nécessaires au message transactionnel.",
    basis: "Exécution du service demandé. Aucun e-mail publicitaire n’est envoyé sur cette base.",
  },
  {
    purpose: "Comprendre l’origine des inscriptions et gérer le parrainage",
    data: "Code de parrainage et, lorsqu’ils sont présents dans le lien, paramètres de campagne UTM.",
    basis: "Intérêt légitime à mesurer l’efficacité des actions de communication et à attribuer les récompenses de parrainage.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="bg-[#F4F8F5] text-[#173D35]">
      <header className="bg-[#0B302B] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#7CCF9C]">
            Vos données, clairement
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Politique de confidentialité
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#D6DFD2]">
            Cette page explique quelles données Cyclo Stratège traite,
            pourquoi elles sont nécessaires et comment exercer vos droits.
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#F2C94C]">
            Version {legalConfig.privacyNoticeVersion} · applicable le{" "}
            {legalConfig.effectiveDateLabel}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <LegalSection title="1. Responsable du traitement">
          <p>
            Le responsable du traitement est{" "}
            <strong>{legalConfig.controllerName}</strong>, éditeur de Cyclo
            Stratège. Pour toute question relative à vos données ou pour
            exercer un droit, écrivez à{" "}
            <a
              href={`mailto:${legalConfig.privacyEmail}`}
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              {legalConfig.privacyEmail}
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="2. Données traitées, finalités et bases légales">
          <p>
            Cyclo Stratège limite la collecte aux informations utiles au jeu,
            à sa sécurité et aux fonctionnalités que vous demandez. Le mot de
            passe est traité par le service d’authentification Supabase ;
            l’éditeur n’y accède jamais en clair.
          </p>
          <div className="mt-6 grid gap-4">
            {processingPurposes.map((item) => (
              <article
                key={item.purpose}
                className="rounded-2xl border border-[#315B3E]/15 bg-[#F7FAF8] p-5"
              >
                <h3 className="font-black text-[#0B302B]">{item.purpose}</h3>
                <p className="mt-2 text-sm leading-6">
                  <strong>Données :</strong> {item.data}
                </p>
                <p className="mt-1 text-sm leading-6">
                  <strong>Base légale :</strong> {item.basis}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-5">
            Cyclo Stratège ne réalise aucune décision automatisée produisant
            un effet juridique ou vous affectant de manière similaire.
          </p>
        </LegalSection>

        <LegalSection title="3. Informations obligatoires et données publiques">
          <p>
            L’adresse e-mail, le mot de passe, le nom de directeur sportif et
            l’acceptation des conditions d’utilisation sont nécessaires pour
            créer un compte. Sans ces informations, l’inscription ne peut pas
            aboutir. Les notifications push restent facultatives et peuvent
            être désactivées à tout moment dans le navigateur.
          </p>
          <p className="mt-4">
            Votre adresse e-mail n’est pas affichée aux autres membres. En
            revanche, votre nom de directeur sportif, votre équipe, certains
            résultats et les contenus publiés dans le chat ou les espaces
            communautaires sont visibles selon la rubrique utilisée.
          </p>
        </LegalSection>

        <LegalSection title="4. Destinataires et sous-traitants">
          <p>
            Les données sont accessibles uniquement aux personnes autorisées
            qui administrent Cyclo Stratège et, dans la limite de leurs
            missions, aux prestataires suivants :
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Supabase</strong> : base de données, authentification,
              stockage technique et temps réel ;
            </li>
            <li>
              <strong>Vercel</strong> : hébergement du site, diffusion et
              mesures anonymes de performance ;
            </li>
            <li>
              <strong>Brevo</strong> : acheminement des e-mails transactionnels
              de confirmation et de service.
            </li>
          </ul>
          <p className="mt-4">
            Ces prestataires agissent dans le cadre de leurs engagements
            contractuels de protection des données. Aucune donnée personnelle
            n’est vendue.
          </p>
        </LegalSection>

        <LegalSection title="5. Transferts hors de l’Espace économique européen">
          <p>
            Certains prestataires techniques peuvent traiter des données ou y
            accéder depuis un pays situé hors de l’Espace économique européen.
            Lorsque le pays ne bénéficie pas d’une décision d’adéquation, ces
            transferts sont encadrés notamment par les clauses contractuelles
            types de la Commission européenne et les mesures de sécurité des
            prestataires. Brevo indique stocker ses bases de données dans
            l’Union européenne.
          </p>
        </LegalSection>

        <LegalSection title="6. Durées de conservation">
          <ul className="list-disc space-y-3 pl-6">
            <li>
              Les données du compte, de la carrière, les messages et
              l’attribution marketing sont conservés tant que le compte est
              actif, puis supprimés avec celui-ci, sous réserve des délais
              techniques de rotation des sauvegardes.
            </li>
            <li>
              La preuve d’acceptation des documents légaux est conservée avec
              le compte et supprimée lors de sa suppression.
            </li>
            <li>
              Les journaux nécessaires à la sécurité sont conservés pendant la
              durée proportionnée à la prévention, la détection et le traitement
              des incidents, puis supprimés ou agrégés.
            </li>
            <li>
              Après suppression d’une carrière, les résultats sportifs
              officiels peuvent rester dans l’historique du jeu sans être
              rattachés au compte supprimé.
            </li>
          </ul>
        </LegalSection>

        <LegalSection title="7. Vos droits">
          <p>
            Selon la situation, vous disposez des droits d’accès, de
            rectification, d’effacement, de limitation, d’opposition et de
            portabilité. Lorsqu’un traitement repose sur votre consentement,
            vous pouvez le retirer à tout moment sans remettre en cause les
            opérations antérieures.
          </p>
          <p className="mt-4">
            Vous pouvez supprimer directement votre compte depuis votre profil
            de directeur sportif ou écrire à{" "}
            <a
              href={`mailto:${legalConfig.privacyEmail}`}
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              {legalConfig.privacyEmail}
            </a>
            . Une réponse sera apportée dans le délai légal, en principe un
            mois. Vous pouvez également adresser une réclamation à la{" "}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noreferrer"
              className="font-extrabold text-[#176951] underline underline-offset-3"
            >
              CNIL
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="8. Cookies et mesure de performance">
          <p>
            Le site utilise des cookies strictement nécessaires à
            l’authentification, à la sécurité et à la mémorisation de votre
            langue. Ils ne nécessitent pas de consentement préalable. Vercel
            Speed Insights mesure les performances à partir de données que
            Vercel décrit comme anonymes, sans permettre de reconstruire une
            session ni d’identifier un visiteur.
          </p>
          <p className="mt-4">
            Aucun traceur publicitaire ni outil de suivi intersites n’est
            actuellement utilisé. Si un traceur facultatif était ajouté, il ne
            serait activé qu’après un choix explicite, avec une possibilité de
            refus aussi simple que l’acceptation.
          </p>
        </LegalSection>

        <LegalSection title="9. Sécurité et évolution de la politique">
          <p>
            Des mesures techniques et organisationnelles sont appliquées pour
            limiter les accès, chiffrer les échanges, séparer les privilèges et
            protéger les comptes. Aucun système ne peut toutefois garantir un
            risque nul ; signalez rapidement toute anomalie au contact indiqué
            ci-dessus.
          </p>
          <p className="mt-4">
            Cette politique peut évoluer avec le jeu ou la réglementation. En
            cas de changement important, une information claire sera présentée
            et une nouvelle acceptation des conditions sera demandée lorsqu’elle
            est nécessaire.
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
