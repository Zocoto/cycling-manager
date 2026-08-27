import "server-only";

import webPush from "web-push";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ClaimedPushNotification = {
  notification_id: string;
  recipient_auth_user_id: string;
  notification_event_type: string;
  notification_event_key: string;
  notification_title: string;
  notification_body: string;
  notification_action_href: string;
  notification_attempt_count: number;
};

type StoredPushSubscription = {
  id: string;
  auth_user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  failure_count: number;
};

type DeliveryResult = {
  subscriptionId: string;
  delivered: boolean;
  permanentFailure: boolean;
  error: string | null;
};

export type PushDispatchSummary = {
  configured: boolean;
  raceLivesEnqueued: number;
  claimed: number;
  sent: number;
  retried: number;
  cancelled: number;
};

let configuredFingerprint: string | null = null;

export function getWebPushPublicKey() {
  return process.env.WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
}

function configureWebPush() {
  const publicKey = getWebPushPublicKey();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) return false;

  const fingerprint = `${publicKey}:${privateKey}`;
  if (configuredFingerprint !== fingerprint) {
    webPush.setVapidDetails(
      process.env.WEB_PUSH_SUBJECT?.trim() || "https://cyclostratege.fr",
      publicKey,
      privateKey,
    );
    configuredFingerprint = fingerprint;
  }

  return true;
}

export async function dispatchDuePushNotifications({
  limit = 20,
  enqueueRaceLives = true,
}: {
  limit?: number;
  enqueueRaceLives?: boolean;
} = {}): Promise<PushDispatchSummary> {
  const summary: PushDispatchSummary = {
    configured: configureWebPush(),
    raceLivesEnqueued: 0,
    claimed: 0,
    sent: 0,
    retried: 0,
    cancelled: 0,
  };
  if (!summary.configured) return summary;

  const admin = createSupabaseAdminClient();
  if (enqueueRaceLives) {
    const liveResult = await admin.rpc(
      "enqueue_due_race_live_push_notifications",
    );
    if (liveResult.error) {
      throw new Error(
        `Impossible de préparer les notifications de live : ${liveResult.error.message}`,
      );
    }
    summary.raceLivesEnqueued = Number(liveResult.data ?? 0);
  }

  const claimedResult = await admin.rpc("claim_due_push_notifications", {
    p_limit: Math.max(1, Math.min(Math.floor(limit), 200)),
  });

  if (claimedResult.error) {
    throw new Error(
      `Impossible de réclamer les notifications push : ${claimedResult.error.message}`,
    );
  }

  const notifications = (Array.isArray(claimedResult.data)
    ? claimedResult.data
    : []) as unknown as ClaimedPushNotification[];
  summary.claimed = notifications.length;
  if (notifications.length === 0) return summary;

  const recipientIds = [
    ...new Set(
      notifications.map((notification) => notification.recipient_auth_user_id),
    ),
  ];
  const subscriptionsResult = await admin
    .from("push_subscriptions")
    .select("id, auth_user_id, endpoint, p256dh, auth_key, failure_count")
    .in("auth_user_id", recipientIds)
    .eq("is_active", true)
    .returns<StoredPushSubscription[]>();

  if (subscriptionsResult.error) {
    await requeueClaimedNotifications(
      notifications,
      `Chargement des abonnements impossible : ${subscriptionsResult.error.message}`,
    );
    throw new Error(
      `Impossible de charger les abonnements push : ${subscriptionsResult.error.message}`,
    );
  }

  const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();
  for (const subscription of subscriptionsResult.data ?? []) {
    const userSubscriptions =
      subscriptionsByUser.get(subscription.auth_user_id) ?? [];
    userSubscriptions.push(subscription);
    subscriptionsByUser.set(subscription.auth_user_id, userSubscriptions);
  }

  for (const notification of notifications) {
    const subscriptions =
      subscriptionsByUser.get(notification.recipient_auth_user_id) ?? [];
    if (subscriptions.length === 0) {
      await updateOutbox(notification.notification_id, {
        status: "cancelled",
        claimed_at: null,
        last_error: "Aucun appareil actif pour ce compte.",
        updated_at: new Date().toISOString(),
      });
      summary.cancelled += 1;
      continue;
    }

    const payload = JSON.stringify({
      title: notification.notification_title,
      body: notification.notification_body,
      url: notification.notification_action_href,
      tag: notification.notification_event_key,
      icon: "/pwa/icon-192.png",
      badge: "/pwa/icon-192.png",
    });
    const results = await Promise.all(
      subscriptions.map((subscription) =>
        deliverToSubscription(subscription, payload),
      ),
    );
    const delivered = results.some((result) => result.delivered);

    if (delivered) {
      await updateOutbox(notification.notification_id, {
        status: "sent",
        claimed_at: null,
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      });
      summary.sent += 1;
      continue;
    }

    const hasTransientFailure = results.some(
      (result) => !result.permanentFailure,
    );
    const lastError = results
      .map((result) => result.error)
      .filter((error): error is string => Boolean(error))
      .join(" · ")
      .slice(0, 1000);

    if (hasTransientFailure && notification.notification_attempt_count < 10) {
      await updateOutbox(notification.notification_id, {
        status: "pending",
        claimed_at: null,
        deliver_after: new Date(Date.now() + 5 * 60_000).toISOString(),
        last_error: lastError || "Échec temporaire de livraison.",
        updated_at: new Date().toISOString(),
      });
      summary.retried += 1;
    } else {
      await updateOutbox(notification.notification_id, {
        status: "cancelled",
        claimed_at: null,
        last_error: lastError || "Tous les appareils sont désabonnés.",
        updated_at: new Date().toISOString(),
      });
      summary.cancelled += 1;
    }
  }

  return summary;
}

async function deliverToSubscription(
  subscription: StoredPushSubscription,
  payload: string,
): Promise<DeliveryResult> {
  const admin = createSupabaseAdminClient();
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth_key,
        },
      },
      payload,
      {
        TTL: 6 * 60 * 60,
        urgency: "normal",
      },
    );

    await admin
      .from("push_subscriptions")
      .update({
        failure_count: 0,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);
    return {
      subscriptionId: subscription.id,
      delivered: true,
      permanentFailure: false,
      error: null,
    };
  } catch (error) {
    const statusCode = getPushErrorStatusCode(error);
    const permanentFailure = statusCode === 404 || statusCode === 410;
    const message = getErrorMessage(error);

    if (permanentFailure) {
      await admin
        .from("push_subscriptions")
        .update({
          is_active: false,
          disabled_at: new Date().toISOString(),
          failure_count: Math.min(20, subscription.failure_count + 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    } else {
      await admin
        .from("push_subscriptions")
        .update({
          failure_count: Math.min(20, subscription.failure_count + 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    }

    return {
      subscriptionId: subscription.id,
      delivered: false,
      permanentFailure,
      error: message,
    };
  }
}

async function requeueClaimedNotifications(
  notifications: ClaimedPushNotification[],
  error: string,
) {
  await Promise.all(
    notifications.map((notification) =>
      updateOutbox(notification.notification_id, {
        status: "pending",
        claimed_at: null,
        deliver_after: new Date(Date.now() + 5 * 60_000).toISOString(),
        last_error: error.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }),
    ),
  );
}

async function updateOutbox(
  notificationId: string,
  values: Record<string, string | null>,
) {
  const admin = createSupabaseAdminClient();
  const result = await admin
    .from("push_notification_outbox")
    .update(values)
    .eq("id", notificationId);
  if (result.error) {
    throw new Error(
      `Impossible de mettre à jour la notification ${notificationId} : ${result.error.message}`,
    );
  }
}

function getPushErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === "number" ? value : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Échec inconnu de livraison Web Push.";
}
