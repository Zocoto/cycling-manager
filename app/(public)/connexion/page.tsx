import type { Metadata } from "next";

import { AuthPreview } from "../../../components/ui/auth-preview";

export const metadata: Metadata = {
  title: "Connexion",
  description:
    "Connectez-vous à votre compte Cycling Manager pour reprendre votre carrière.",
};

const fields = [
  {
    id: "email",
    label: "Adresse e-mail",
    type: "email",
    placeholder: "directeur@cycling-manager.fr",
  },
  {
    id: "password",
    label: "Mot de passe",
    type: "password",
    placeholder: "Votre mot de passe",
  },
] as const;

const benefits = [
  "Retrouvez votre équipe et la progression de votre carrière.",
  "Préparez vos prochaines courses et vos objectifs sportifs.",
  "Reprenez votre partie depuis votre espace personnel sécurisé.",
] as const;

export default function LoginPage() {
  return (
    <AuthPreview
      eyebrow="Accès directeur sportif"
      title="Reprenez votre"
      highlightedTitle="carrière."
      description="Votre équipe vous attend. La connexion sécurisée sera mise en place lors de la prochaine étape fonctionnelle consacrée aux sessions utilisateur."
      availabilityLabel="La connexion et la déconnexion seront développées dans l’US 6."
      fields={fields}
      submitLabel="Se connecter prochainement"
      alternateText="Vous ne possédez pas encore de compte ?"
      alternateLinkLabel="Découvrir l’inscription"
      alternateHref="/inscription"
      benefits={benefits}
    />
  );
}