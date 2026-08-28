import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildReferralInviteUrl,
  type ReferralInvitee,
  type ReferralMilestone,
  type ReferralOverview,
  type ReferralStatus,
} from "@/lib/game/referrals";

type RawReferralOverview = {
  code?: unknown;
  registeredCount?: unknown;
  qualifiedCount?: unknown;
  patronOutfitUnlocked?: unknown;
  patronHatUnlocked?: unknown;
  referrals?: unknown;
  milestones?: unknown;
};

export type PublicReferralInvitation = {
  code: string;
  referrerName: string;
};

export async function getCurrentReferralOverview(
  supabase: SupabaseClient,
  siteUrl: string,
): Promise<ReferralOverview | null> {
  const result = await supabase.rpc("get_current_referral_overview");

  if (result.error) {
    throw new Error(
      `Impossible de charger le parrainage : ${result.error.message}`,
    );
  }

  if (!result.data || typeof result.data !== "object") return null;

  const raw = result.data as RawReferralOverview;
  const code = readString(raw.code);
  if (!code) return null;

  return {
    code,
    inviteUrl: buildReferralInviteUrl(siteUrl, code),
    registeredCount: readNumber(raw.registeredCount),
    qualifiedCount: readNumber(raw.qualifiedCount),
    patronOutfitUnlocked: Boolean(raw.patronOutfitUnlocked),
    patronHatUnlocked: Boolean(raw.patronHatUnlocked),
    referrals: readArray(raw.referrals).flatMap(normalizeInvitee),
    milestones: readArray(raw.milestones).flatMap(normalizeMilestone),
  };
}

export async function getPublicReferralInvitation(
  supabase: SupabaseClient,
  code: string,
): Promise<PublicReferralInvitation | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!/^DS-[A-F0-9]{12}$/.test(normalizedCode)) return null;

  const result = await supabase.rpc("get_public_referral_invitation", {
    p_code: normalizedCode,
  });

  if (result.error || !result.data || typeof result.data !== "object") {
    return null;
  }

  const row = result.data as Record<string, unknown>;
  const returnedCode = readString(row.code);
  const referrerName = readString(row.referrerName);

  return returnedCode && referrerName
    ? { code: returnedCode, referrerName }
    : null;
}

function normalizeInvitee(value: unknown): ReferralInvitee[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const displayName = readString(row.displayName);
  const registeredAt = readString(row.registeredAt);
  const status = readReferralStatus(row.status);
  if (!id || !displayName || !registeredAt || !status) return [];

  return [{
    id,
    displayName,
    registeredAt,
    status,
    qualifiedAt: readString(row.qualifiedAt) || null,
  }];
}

function normalizeMilestone(value: unknown): ReferralMilestone[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const count = readNumber(row.count);
  const rewardKey = readString(row.rewardKey);
  const rewardName = readString(row.rewardName);
  if (!count || !rewardKey || !rewardName) return [];

  return [{
    count,
    rewardKey,
    rewardName,
    rewardSummary: readString(row.rewardSummary),
    rewardLevel: readNumber(row.rewardLevel),
    granted: Boolean(row.granted),
    grantedAt: readString(row.grantedAt) || null,
  }];
}

function readReferralStatus(value: unknown): ReferralStatus | null {
  return value === "registered" || value === "qualified" ? value : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
