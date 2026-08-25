export type DirectorInactivityWarningContent = {
  subject: string;
  textContent: string;
  htmlContent: string;
};

export function buildDirectorInactivityWarning({
  displayName,
  teamName,
  lastActivityAt,
  deletionAt,
  siteUrl,
}: {
  displayName: string;
  teamName: string | null;
  lastActivityAt: Date;
  deletionAt: Date;
  siteUrl: string;
}): DirectorInactivityWarningContent {
  const connectionUrl = new URL("/connexion", siteUrl).toString();
  const formattedLastActivity = formatFrenchDate(lastActivityAt);
  const formattedDeletionDate = formatFrenchDate(deletionAt);
  const safeName = escapeHtml(displayName);
  const safeTeam = teamName ? escapeHtml(teamName) : null;
  const teamSentence = teamName
    ? ` Votre équipe ${teamName} sera conservée comme archive historique.`
    : " Votre historique sportif sera conservé.";
  const safeTeamSentence = safeTeam
    ? ` Votre équipe <strong>${safeTeam}</strong> sera conservée comme archive historique.`
    : " Votre historique sportif sera conservé.";

  return {
    subject: "Votre compte Cyclo Stratège sera supprimé dans 14 jours",
    textContent: [
      `Bonjour ${displayName},`,
      "",
      `Nous n’avons enregistré aucune connexion à Cyclo Stratège depuis le ${formattedLastActivity}.`,
      `Sans nouvelle connexion, votre compte de Directeur Sportif sera supprimé le ${formattedDeletionDate}.${teamSentence}`,
      "Les coureurs encore sous contrat seront alors remis sur le marché des agents libres.",
      "",
      "Une simple connexion avant cette date annule automatiquement la procédure :",
      connectionUrl,
      "",
      "À bientôt sur Cyclo Stratège.",
    ].join("\n"),
    htmlContent: `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f3f7f5;color:#0b332b;font-family:Arial,sans-serif">
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="border-radius:24px;background:#082e27;padding:28px;color:#fffdf4">
        <p style="margin:0;color:#8de0bd;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Cyclo Stratège</p>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2">Ton équipe t’attend</h1>
      </div>
      <div style="border:1px solid #d6e4de;border-radius:24px;background:#ffffff;padding:28px;margin-top:14px">
        <p style="margin:0 0 18px;font-size:17px">Bonjour <strong>${safeName}</strong>,</p>
        <p style="line-height:1.65">Nous n’avons enregistré aucune connexion depuis le <strong>${formattedLastActivity}</strong>.</p>
        <p style="line-height:1.65">Sans nouvelle connexion, ton compte de Directeur Sportif sera supprimé le <strong>${formattedDeletionDate}</strong>.${safeTeamSentence}</p>
        <p style="line-height:1.65">Les coureurs encore sous contrat seront remis sur le marché des agents libres.</p>
        <p style="line-height:1.65"><strong>Une simple connexion avant cette date annule automatiquement la procédure.</strong></p>
        <p style="margin:26px 0 8px"><a href="${escapeHtml(connectionUrl)}" style="display:inline-block;border-radius:14px;background:#efc94c;color:#082e27;padding:14px 22px;text-decoration:none;font-weight:800">Retrouver mon équipe</a></p>
      </div>
      <p style="margin:18px 8px 0;color:#60746e;font-size:12px;line-height:1.5">Message automatique lié à la gestion des comptes inactifs de Cyclo Stratège.</p>
    </div>
  </body>
</html>`,
  };
}

function formatFrenchDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
