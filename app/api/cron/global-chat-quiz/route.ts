import { z } from "zod";

import { isAuthorizedCronRequest } from "@/lib/security/cron-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prepareGlobalChatQuizPortrait } from "@/services/global-chat-quiz-portrait";

export const maxDuration = 30;

const preparationSchema = z.object({
  id: z.uuid(),
  riderId: z.uuid(),
  avatarProfileKey: z.string().nullable(),
  avatarSeed: z.union([z.string(), z.number().int()]).nullable().transform(seed => seed === null ? null : String(seed)),
  age: z.number().int(),
  portraitReady: z.boolean(),
});

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return Response.json({ status: "skipped" });
  }

  try {
    const admin = createSupabaseAdminClient();
    const preparation = await admin.rpc("prepare_global_chat_quiz_round")
      .abortSignal(AbortSignal.timeout(5_000));
    if (preparation.error) throw preparation.error;
    if (preparation.data === null) return Response.json({ status: "skipped" });
    const round = preparationSchema.parse(preparation.data);
    if (round.portraitReady) return Response.json({ status: "already-prepared" });

    const portraitPath = await prepareGlobalChatQuizPortrait(admin, round);
    const completion = await admin.rpc("complete_global_chat_quiz_portrait", {
      p_round_id: round.id,
      p_portrait_path: portraitPath,
    }).abortSignal(AbortSignal.timeout(5_000));
    if (completion.error || completion.data !== true) {
      throw completion.error ?? new Error("Quiz preparation was not completed.");
    }
    return Response.json({ status: "prepared" });
  } catch (error) {
    const kind = error instanceof Error ? error.name : "database";
    console.error("global_chat_quiz_preparation_failed", { kind });
    return Response.json({ error: "Quiz preparation failed." }, { status: 500 });
  }
}
