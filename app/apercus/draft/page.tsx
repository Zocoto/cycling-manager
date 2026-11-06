import { notFound } from "next/navigation";
import { SeasonDraftPanel } from "@/components/game/season-draft-panel";
import { createDraftFixture } from "@/test/fixtures/season-draft";
import { MobileGameNavigation } from "@/components/game/mobile-game-navigation";
import "@/app/jeu/mobile.css";

export const metadata = { title: "Draft · aperçu local", robots: { index: false, follow: false } };
export default function DraftPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const fixture = createDraftFixture();
  fixture.serverNow = "2026-11-06T14:10:00+01:00";
  fixture.edition = { ...fixture.edition!, status: "running", currentPosition: 1, deadline: "2026-11-06T14:20:00+01:00" };
  return <div className="game-shell"><main className="min-h-screen bg-[#F0F3EE] p-4 text-[#173D3A] sm:p-8"><div className="mx-auto max-w-[1280px]">
    <p className="mb-4 text-xs font-bold">Aperçu local · données fictives · aucun recrutement possible</p>
    <SeasonDraftPanel view={fixture} preview />
  </div></main><MobileGameNavigation /></div>;
}
