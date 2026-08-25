import "server-only";

import {
  buildDirectorInactivityWarning,
  type DirectorInactivityWarningContent,
} from "@/lib/game/director-inactivity-email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BREVO_API_URL = "https://api.brevo.com/v3";
const DEFAULT_SITE_URL = "https://cyclostratege.fr";
const DEFAULT_SENDER_EMAIL = "no-reply@cyclostratege.fr";
const WARNING_BATCH_SIZE = 25;
const DELETION_BATCH_SIZE = 10;

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type WarningClaim = {
  sporting_director_id: string;
  auth_user_id: string;
  display_name: string;
  team_name: string | null;
  last_activity_at: string;
  warning_attempt_count: number;
};

type DeletionClaim = {
  sporting_director_id: string;
  auth_user_id: string;
  status: "warned" | "archived";
  deletion_due_at: string;
  deletion_attempt_count: number;
};

type ArchiveResult = {
  archived?: boolean;
  cancelled?: boolean;
  releasedRiderCount?: number;
};

export type DirectorInactivitySummary = {
  configured: boolean;
  brevoAccountChecked: boolean;
  warningsClaimed: number;
  warningsSent: number;
  warningsCancelled: number;
  warningFailures: number;
  deletionsClaimed: number;
  teamsArchived: number;
  ridersReleased: number;
  authAccountsDeleted: number;
  deletionFailures: number;
};

export async function processDirectorInactivityLifecycle(): Promise<DirectorInactivitySummary> {
  const configuration = getBrevoConfiguration();
  const summary: DirectorInactivitySummary = {
    configured: Boolean(configuration),
    brevoAccountChecked: false,
    warningsClaimed: 0,
    warningsSent: 0,
    warningsCancelled: 0,
    warningFailures: 0,
    deletionsClaimed: 0,
    teamsArchived: 0,
    ridersReleased: 0,
    authAccountsDeleted: 0,
    deletionFailures: 0,
  };

  if (!configuration) {
    throw new Error(
      "BREVO_API_KEY est absente : le cycle d’inactivité reste volontairement bloqué.",
    );
  }

  await verifyBrevoAccount(configuration.apiKey);
  summary.brevoAccountChecked = true;

  const admin = createSupabaseAdminClient();
  await processWarnings(admin, configuration, summary);
  await processDeletions(admin, summary);

  return summary;
}

async function processWarnings(
  admin: SupabaseAdminClient,
  configuration: NonNullable<ReturnType<typeof getBrevoConfiguration>>,
  summary: DirectorInactivitySummary,
) {
  const claimedResult = await admin.rpc(
    "claim_due_director_inactivity_warnings",
    { p_limit: WARNING_BATCH_SIZE },
  );

  if (claimedResult.error) {
    throw new Error(
      `Réclamation des avertissements impossible : ${claimedResult.error.message}`,
    );
  }

  const warnings = (Array.isArray(claimedResult.data)
    ? claimedResult.data
    : []) as unknown as WarningClaim[];
  summary.warningsClaimed = warnings.length;

  for (const warning of warnings) {
    try {
      const userResult = await admin.auth.admin.getUserById(
        warning.auth_user_id,
      );
      if (userResult.error) throw userResult.error;

      const recipientEmail = userResult.data.user?.email?.trim();
      if (!recipientEmail) {
        throw new Error("Le compte ne possède aucune adresse email.");
      }

      const sentAt = new Date();
      const content = buildDirectorInactivityWarning({
        displayName: warning.display_name,
        teamName: warning.team_name,
        lastActivityAt: new Date(warning.last_activity_at),
        deletionAt: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000),
        siteUrl: configuration.siteUrl,
      });

      await sendBrevoTransactionalEmail({
        apiKey: configuration.apiKey,
        senderEmail: configuration.senderEmail,
        recipientEmail,
        recipientName: warning.display_name,
        ...content,
      });

      const markedResult = await admin.rpc(
        "mark_director_inactivity_warning_sent",
        { p_sporting_director_id: warning.sporting_director_id },
      );
      if (markedResult.error) throw markedResult.error;

      if (markedResult.data === true) {
        summary.warningsSent += 1;
      } else {
        summary.warningsCancelled += 1;
      }
    } catch (error) {
      summary.warningFailures += 1;
      const message = getErrorMessage(error);
      const failureResult = await admin.rpc(
        "mark_director_inactivity_warning_failed",
        {
          p_sporting_director_id: warning.sporting_director_id,
          p_error: message,
        },
      );
      if (failureResult.error) {
        console.error("director_inactivity_warning_failure_persist_error", {
          sportingDirectorId: warning.sporting_director_id,
          error: failureResult.error.message,
        });
      }
      console.error("director_inactivity_warning_error", {
        sportingDirectorId: warning.sporting_director_id,
        attempt: warning.warning_attempt_count,
        error: message,
      });
    }
  }
}

async function processDeletions(
  admin: SupabaseAdminClient,
  summary: DirectorInactivitySummary,
) {
  const claimedResult = await admin.rpc(
    "claim_due_director_inactivity_deletions",
    { p_limit: DELETION_BATCH_SIZE },
  );

  if (claimedResult.error) {
    throw new Error(
      `Réclamation des suppressions impossible : ${claimedResult.error.message}`,
    );
  }

  const deletions = (Array.isArray(claimedResult.data)
    ? claimedResult.data
    : []) as unknown as DeletionClaim[];
  summary.deletionsClaimed = deletions.length;

  for (const deletion of deletions) {
    try {
      if (deletion.status === "warned") {
        const archiveResult = await admin.rpc(
          "archive_inactive_sporting_director",
          { p_sporting_director_id: deletion.sporting_director_id },
        );
        if (archiveResult.error) throw archiveResult.error;

        const archive = (archiveResult.data ?? {}) as ArchiveResult;
        if (archive.cancelled || archive.archived === false) {
          continue;
        }

        summary.teamsArchived += 1;
        summary.ridersReleased += Number(archive.releasedRiderCount ?? 0);
      }

      const deleteResult = await admin.auth.admin.deleteUser(
        deletion.auth_user_id,
      );
      if (deleteResult.error && !isMissingAuthUserError(deleteResult.error)) {
        throw deleteResult.error;
      }

      const markedResult = await admin.rpc(
        "mark_director_inactivity_auth_deleted",
        { p_sporting_director_id: deletion.sporting_director_id },
      );
      if (markedResult.error) throw markedResult.error;
      if (markedResult.data !== true) {
        throw new Error("L’archivage n’est pas prêt à être finalisé.");
      }

      summary.authAccountsDeleted += 1;
    } catch (error) {
      summary.deletionFailures += 1;
      const message = getErrorMessage(error);
      const failureResult = await admin.rpc(
        "mark_director_inactivity_deletion_failed",
        {
          p_sporting_director_id: deletion.sporting_director_id,
          p_error: message,
        },
      );
      if (failureResult.error) {
        console.error("director_inactivity_deletion_failure_persist_error", {
          sportingDirectorId: deletion.sporting_director_id,
          error: failureResult.error.message,
        });
      }
      console.error("director_inactivity_deletion_error", {
        sportingDirectorId: deletion.sporting_director_id,
        attempt: deletion.deletion_attempt_count,
        error: message,
      });
    }
  }
}

async function verifyBrevoAccount(apiKey: string) {
  const response = await fetch(`${BREVO_API_URL}/account`, {
    headers: {
      accept: "application/json",
      "api-key": apiKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Brevo a refusé la vérification du compte (${response.status}).`,
    );
  }
}

async function sendBrevoTransactionalEmail({
  apiKey,
  senderEmail,
  recipientEmail,
  recipientName,
  subject,
  textContent,
  htmlContent,
}: {
  apiKey: string;
  senderEmail: string;
  recipientEmail: string;
  recipientName: string;
} & DirectorInactivityWarningContent) {
  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Cyclo Stratège", email: senderEmail },
      to: [{ email: recipientEmail, name: recipientName }],
      subject,
      textContent,
      htmlContent,
      tags: ["director-inactivity-warning"],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Brevo a refusé l’email (${response.status}).`);
  }
}

function getBrevoConfiguration() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    senderEmail:
      process.env.BREVO_TRANSACTIONAL_SENDER_EMAIL?.trim() ||
      DEFAULT_SENDER_EMAIL,
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL,
  };
}

function isMissingAuthUserError(error: { message?: string; status?: number }) {
  const message = error.message?.toLocaleLowerCase("fr") ?? "";
  return error.status === 404 || message.includes("user not found");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
