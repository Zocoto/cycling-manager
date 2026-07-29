import { NextResponse, type NextRequest } from "next/server";

import { isAlphaBotSlot } from "@/lib/game/alpha-bots";
import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { runAlphaBotCycles } from "@/services/alpha-bot-manager";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slot: string }> },
) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisÃ©." }, { status: 401 });
  }

  const { slot } = await context.params;
  if (!isAlphaBotSlot(slot)) {
    return NextResponse.json(
      { error: "CrÃ©neau automatisÃ© invalide." },
      { status: 400 },
    );
  }

  try {
    const results = await runAlphaBotCycles(slot);
    return NextResponse.json({
      ok: true,
      slot,
      processed: results.filter(
        (result) => result.status !== "already_processed",
      ).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
