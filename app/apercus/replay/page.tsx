import { notFound } from "next/navigation";
import { RaceLiveLab } from "@/components/game/race-live-lab";
import { createRaceReplayFixture } from "@/test/fixtures/race-replay";

export default async function RaceReplayPreview({searchParams}:{searchParams:Promise<{chrono?:string}>}) {
  if (process.env.NODE_ENV === "production") notFound();
  const {chrono} = await searchParams;
  const fixture = createRaceReplayFixture(chrono === "1");
  return <main className="min-h-screen bg-[#EAF5F3] p-3 sm:p-8">
    <div className="mx-auto max-w-[1500px]">
      <RaceLiveLab {...fixture} mode="replay" nowIso="2026-10-30T08:00:00Z" />
    </div>
  </main>;
}
