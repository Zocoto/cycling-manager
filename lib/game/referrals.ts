export type ReferralStatus = "registered" | "qualified";

export type ReferralInvitee = {
  id: string;
  displayName: string;
  status: ReferralStatus;
  registeredAt: string;
  qualifiedAt: string | null;
};

export type ReferralMilestone = {
  count: number;
  rewardKey: string;
  rewardName: string;
  rewardSummary: string;
  rewardLevel: number;
  granted: boolean;
  grantedAt: string | null;
};

export type ReferralOverview = {
  code: string;
  inviteUrl: string;
  registeredCount: number;
  qualifiedCount: number;
  patronOutfitUnlocked: boolean;
  referrals: ReferralInvitee[];
  milestones: ReferralMilestone[];
};

export type ReferralTrophyMilestone = {
  count: number;
  title: string;
  inscription: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    glow: string;
  };
};

export const REFERRAL_TROPHY_MILESTONES: readonly ReferralTrophyMilestone[] = [
  {
    count: 1,
    title: "Entremetteur du peloton",
    inscription: "1 filleul qualifié",
    palette: {
      primary: "#B87333",
      secondary: "#F4D0A6",
      accent: "#4B2513",
      glow: "rgba(184, 115, 51, 0.38)",
    },
  },
  {
    count: 5,
    title: "Le Parrain",
    inscription: "5 filleuls qualifiés · tenue débloquée",
    palette: {
      primary: "#D8D8D3",
      secondary: "#FFFFFF",
      accent: "#171514",
      glow: "rgba(216, 216, 211, 0.46)",
    },
  },
  {
    count: 10,
    title: "Parrain influent",
    inscription: "10 filleuls qualifiés",
    palette: {
      primary: "#D4AF37",
      secondary: "#FFF0A8",
      accent: "#4B3500",
      glow: "rgba(212, 175, 55, 0.48)",
    },
  },
  {
    count: 25,
    title: "Don du peloton",
    inscription: "25 filleuls qualifiés",
    palette: {
      primary: "#20201F",
      secondary: "#E7E2D8",
      accent: "#9B1C31",
      glow: "rgba(155, 28, 49, 0.42)",
    },
  },
] as const;

export function buildReferralInviteUrl(siteUrl: string, code: string): string {
  const query = new URLSearchParams({ parrain: code }).toString();
  const base = siteUrl.trim().replace(/\/$/, "");
  return `${base}/inscription?${query}`;
}

export function getNextReferralMilestone(
  milestones: readonly ReferralMilestone[],
  qualifiedCount: number,
): ReferralMilestone | null {
  return (
    [...milestones]
      .sort((left, right) => left.count - right.count)
      .find((milestone) => milestone.count > qualifiedCount) ?? null
  );
}

export function getReferralProgressPercent(
  qualifiedCount: number,
  nextMilestone: ReferralMilestone | null,
): number {
  if (!nextMilestone) return 100;
  return Math.min(100, Math.max(0, (qualifiedCount / nextMilestone.count) * 100));
}

export function getUnlockedReferralTrophies(
  qualifiedCount: number,
): ReferralTrophyMilestone[] {
  return REFERRAL_TROPHY_MILESTONES.filter(
    (milestone) => qualifiedCount >= milestone.count,
  );
}
