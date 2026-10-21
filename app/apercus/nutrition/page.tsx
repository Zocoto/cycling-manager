import { notFound } from "next/navigation";
import { NutritionPreview } from "./nutrition-preview";

export const metadata = { title: "Nutrition · aperçu local", robots: { index: false, follow: false } };

export default function NutritionPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <NutritionPreview />;
}
