import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SEASON_FINALE_GALA_RESULTS_EVENT_ID } from "@/lib/game/season-finale-gala-results-data";

type EmailClaim = {
  id: string;
  auth_user_id: string;
  manager_name: string;
  subject: string;
  body: string;
  idempotency_key: string;
};

export type GalaEmailSummary = { claimed: number; sent: number; failed: number; uncertain: number };

// Delivery stays on the production server: no provider credentials are exported.
export async function sendSeasonFinaleGalaRewardEmails(): Promise<GalaEmailSummary> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) throw new Error("Le service de mails n’est pas configuré.");
  const admin = createSupabaseAdminClient();
  const claims = await admin.rpc("claim_pcm_gala_reward_emails", {
    p_event_id: SEASON_FINALE_GALA_RESULTS_EVENT_ID,
    p_limit: 10,
  });
  if (claims.error) throw new Error("Impossible de réserver les mails du gala.");
  const summary: GalaEmailSummary = { claimed: 0, sent: 0, failed: 0, uncertain: 0 };
  for (const claim of (claims.data ?? []) as EmailClaim[]) {
    summary.claimed += 1;
    let attemptedDelivery = false;
    let providerAccepted = false;
    let messageId: string | null = null;
    try {
      const account = await admin.auth.admin.getUserById(claim.auth_user_id);
      const email = account.data.user?.email?.trim();
      if (account.error || !email) throw new Error("Adresse du compte indisponible.");
      const textContent = buildGalaRewardEmailText(claim.body);
      attemptedDelivery = true;
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          sender: { name: "Cyclo Stratège", email: process.env.BREVO_TRANSACTIONAL_SENDER_EMAIL?.trim() || "no-reply@cyclostratege.fr" },
          to: [{ email, name: claim.manager_name }],
          subject: claim.subject,
          textContent,
          htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Grand Gala · Résultats / Results</h2><p>${escapeHtml(textContent).replaceAll("\n", "<br>")}</p></div>`,
          // Provider deduplication is supplementary; the persistent outbox is authoritative.
          // https://developers.brevo.com/reference/send-transac-email
          headers: { "Idempotency-Key": claim.idempotency_key },
          tags: ["season-finale-gala-rewards"],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // 5xx/408 may occur after acceptance. Never blindly retry an ambiguous delivery.
        const ambiguous = response.status >= 500 || response.status === 408;
        const marked = await admin.rpc("mark_pcm_gala_reward_email", {
          p_email_id: claim.id, p_status: ambiguous ? "uncertain" : "failed",
          p_error: `Provider HTTP ${response.status}`, p_message_id: null,
        });
        if (marked.error || marked.data !== true) throw new Error("État d’envoi non enregistré.");
        summary[ambiguous ? "uncertain" : "failed"] += 1;
        continue;
      }
      providerAccepted = true;
      const result = await response.json() as { messageId?: string };
      messageId = result.messageId ?? null;
      if (!messageId) throw new Error("Accusé de réception incomplet.");
      const marked = await admin.rpc("mark_pcm_gala_reward_email", {
        p_email_id: claim.id, p_status: "sent", p_message_id: messageId, p_error: null,
      });
      if (marked.error || marked.data !== true) throw new Error("Accusé d’envoi non enregistré.");
      summary.sent += 1;
    } catch {
      const status = attemptedDelivery || providerAccepted ? "uncertain" : "failed";
      const marked = await admin.rpc("mark_pcm_gala_reward_email", {
        p_email_id: claim.id, p_status: status, p_message_id: messageId,
        p_error: status === "uncertain" ? "Delivery outcome requires manual verification" : "Account email unavailable",
      });
      if (marked.error || marked.data !== true) console.error("gala_email_state_failed", { outboxId: claim.id });
      summary[status] += 1;
    }
  }
  return summary;
}

export function buildGalaRewardEmailText(body: string) {
  return `${body}\n\nResults and replays / Résultats et vidéos :\nhttps://cyclostratege.fr/jeu/gala-fin-de-saison\n\nEN — Your Gala equipment prizes listed above have been added to your team’s inventory. You can equip them on your riders. The Gala awards no money or ranking points and does not change your riders’ fitness. Thank you for taking part!`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
