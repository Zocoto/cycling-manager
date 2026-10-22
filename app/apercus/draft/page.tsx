import { notFound } from "next/navigation";
import { SeasonDraftPanel } from "@/components/game/season-draft-panel";
import { createDraftFixture } from "@/test/fixtures/season-draft";

export const metadata = { title: "Draft · aperçu local", robots: { index: false, follow: false } };
export default function DraftPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="min-h-screen bg-[#F0F3EE] p-4 text-[#173D3A] sm:p-8"><div className="mx-auto max-w-[1280px]">
    <p className="mb-4 text-xs font-bold">Aperçu local · données fictives · aucun recrutement possible</p>
    <SeasonDraftPanel view={createDraftFixture()} preview />
  </div></main>;
}
