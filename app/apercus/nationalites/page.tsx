import { notFound } from "next/navigation";
import "flag-icons/css/flag-icons.min.css";
import { CountryChoicePreview } from "./preview";

export const metadata = { title: "Nationalités · recette locale", robots: { index: false, follow: false } };

export default function LocalNationalityPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CountryChoicePreview />;
}
