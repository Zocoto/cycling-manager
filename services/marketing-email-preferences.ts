import "server-only";

import type { User } from "@supabase/supabase-js";

import { getPublicSiteUrl } from "@/lib/auth/public-site-url";
import {
  buildMarketingUnsubscribeUrl,
  buildOneClickMarketingUnsubscribeUrl,
  isMarketingUnsubscribeToken,
} from "@/lib/marketing/email-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1_000;

type PreferenceRow = {
  auth_user_id: string;
  unsubscribe_token: string;
};

export type MarketingEmailRecipient = {
  authUserId: string;
  email: string;
  displayName: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
};

export async function unsubscribeMarketingEmailToken(token: string) {
  if (!isMarketingUnsubscribeToken(token)) return false;

  const admin = createSupabaseAdminClient();
  const result = await admin.rpc("unsubscribe_marketing_emails", {
    p_token: token,
  });
  if (result.error) {
    console.error("marketing_email_unsubscribe_error", {
      message: result.error.message,
    });
    return false;
  }

  return result.data === true;
}

export async function listEligibleMarketingEmailRecipients(): Promise<
  MarketingEmailRecipient[]
> {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL est requise pour préparer les désinscriptions.",
    );
  }

  const admin = createSupabaseAdminClient();
  const preferences = await listEnabledPreferences(admin);
  if (preferences.length === 0) return [];

  const botResult = await admin
    .from("alpha_bot_managers")
    .select("auth_user_id");
  if (botResult.error) {
    throw new Error(
      "Lecture des comptes automatisés impossible : " +
        botResult.error.message,
    );
  }
  const botUserIds = new Set(
    (botResult.data ?? []).map((bot) => bot.auth_user_id as string),
  );

  const preferenceByUserId = new Map(
    preferences.map((preference) => [
      preference.auth_user_id,
      preference,
    ]),
  );
  const users = await listAllAuthUsers(admin);

  return users.flatMap((user) => {
    const preference = preferenceByUserId.get(user.id);
    const email = user.email?.trim();
    if (
      !preference
      || !email
      || !user.email_confirmed_at
      || botUserIds.has(user.id)
    ) {
      return [];
    }

    return [{
      authUserId: user.id,
      email,
      displayName: readDisplayName(user),
      unsubscribeUrl: buildMarketingUnsubscribeUrl({
        siteUrl,
        token: preference.unsubscribe_token,
      }),
      oneClickUnsubscribeUrl: buildOneClickMarketingUnsubscribeUrl({
        siteUrl,
        token: preference.unsubscribe_token,
      }),
    }];
  });
}

async function listEnabledPreferences(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const preferences: PreferenceRow[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const result = await admin
      .from("user_marketing_email_preferences")
      .select("auth_user_id,unsubscribe_token")
      .eq("enabled", true)
      .order("auth_user_id")
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) {
      throw new Error(
        "Lecture des consentements impossible : " + result.error.message,
      );
    }

    const rows = (result.data ?? []) as PreferenceRow[];
    preferences.push(...rows);
    if (rows.length < PAGE_SIZE) return preferences;
  }
}

async function listAllAuthUsers(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const users: User[] = [];

  for (let page = 1; ; page += 1) {
    const result = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (result.error) {
      throw new Error(
        "Lecture des comptes impossible : " + result.error.message,
      );
    }

    users.push(...result.data.users);
    if (result.data.users.length < PAGE_SIZE) return users;
  }
}

function readDisplayName(user: User) {
  const managerName = user.user_metadata?.manager_name;
  return typeof managerName === "string" && managerName.trim()
    ? managerName.trim()
    : "Directeur Sportif";
}
