"use client";

import { useState } from "react";

export function SeasonFinaleGalaRewardsAdmin() {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  async function sendEmails() {
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/pcm-gala-reward-emails", {
        method: "POST", headers: { "x-cs-requested-with": "pcm-gala-reward-emails-admin" },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi indisponible.");
      setStatus(`${result.sent} mails envoyés · ${result.failed} échecs · ${result.uncertain} à vérifier · ${result.claimed} traités. Les mails déjà envoyés ne sont pas renvoyés.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Envoi indisponible.");
    } finally { setPending(false); }
  }
  return <div className="mt-4 text-xs text-[#BFC3CE]">
    <button type="button" disabled={pending} onClick={sendEmails} className="rounded-lg bg-[#D2B46B] px-4 py-2 font-semibold text-[#101114] disabled:opacity-50">
      {pending ? "Envoi des mails…" : "Envoyer les mails des récompenses"}
    </button>
    {status ? <p role="status" className="mt-2">{status}</p> : null}
  </div>;
}
