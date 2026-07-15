import type { Metadata } from "next";

import { AuthPreview } from "../../../components/ui/auth-preview";

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Créez votre compte Cycling Manager et préparez votre future équipe cycliste.",
};

const fields = [
  {
    id: "manager-name",
    label: "Nom du directeur sportif",
    type: "text",
    placeholder: "Votre nom dans le jeu",
  },
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
    placeholder: "Choisissez un mot de passe sécurisé",
  },
] as const;

const benefits = [
  "Créez votre identité de directeur sportif.",
  "Construisez progressivement votre propre formation cycliste.",
  "Conservez durablement votre progression et vos résultats.",
] as const;

export default function RegistrationPage() {
  return (
    <AuthPreview
      eyebrow="Nouvelle carrière"
      title="Créez votre"
      highlightedTitle="propre équipe."
      description="Préparez votre arrivée dans le peloton et imaginez un projet sportif capable de s’imposer sur les plus grandes routes."
      availabilityLabel="La création effective d’un compte sera développée dans l’US 5."
      fields={fields}
      submitLabel="Création de compte prochainement disponible"
      alternateText="Vous possédez déjà un compte ?"
      alternateLinkLabel="Reprendre une carrière"
      alternateHref="/connexion"
      benefits={benefits}
    />
  );
}