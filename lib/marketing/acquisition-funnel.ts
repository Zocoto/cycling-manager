export const ACQUISITION_PERIOD_VALUES = [7, 30, 90, "all"] as const;

export type AcquisitionPeriod =
  (typeof ACQUISITION_PERIOD_VALUES)[number];

export type AcquisitionAccount = {
  authUserId: string;
  createdAt: string;
  emailConfirmedAt: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  hasDirector: boolean;
  hasTeam: boolean;
  onboardingCompleted: boolean;
  lastActivityOn: string | null;
};

export type AcquisitionBreakdownRow = {
  label: string;
  registrations: number;
  confirmed: number;
  teamsCreated: number;
  teamConversionRate: number;
};

export type AcquisitionOverview = {
  period: AcquisitionPeriod;
  registrations: number;
  confirmed: number;
  directorProfiles: number;
  teamsCreated: number;
  onboardingCompleted: number;
  activeLastSevenDays: number;
  confirmationRate: number;
  teamConversionRate: number;
  sources: AcquisitionBreakdownRow[];
  campaigns: AcquisitionBreakdownRow[];
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function parseAcquisitionPeriod(
  value: string | string[] | undefined,
): AcquisitionPeriod {
  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (normalizedValue === "all") return "all";

  const numericValue = Number(normalizedValue);
  return numericValue === 7 || numericValue === 90 ? numericValue : 30;
}

export function buildAcquisitionOverview(
  accounts: AcquisitionAccount[],
  period: AcquisitionPeriod,
  now = new Date(),
): AcquisitionOverview {
  const cutoff =
    period === "all"
      ? Number.NEGATIVE_INFINITY
      : now.getTime() - period * DAY_IN_MILLISECONDS;
  const activityCutoff = now.getTime() - 7 * DAY_IN_MILLISECONDS;
  const cohort = accounts.filter(
    (account) => parseTimestamp(account.createdAt) >= cutoff,
  );
  const registrations = cohort.length;
  const confirmed = countMatching(cohort, (account) =>
    Boolean(account.emailConfirmedAt),
  );
  const teamsCreated = countMatching(
    cohort,
    (account) => account.hasTeam,
  );

  return {
    period,
    registrations,
    confirmed,
    directorProfiles: countMatching(
      cohort,
      (account) => account.hasDirector,
    ),
    teamsCreated,
    onboardingCompleted: countMatching(
      cohort,
      (account) => account.onboardingCompleted,
    ),
    activeLastSevenDays: countMatching(
      cohort,
      (account) =>
        account.lastActivityOn !== null &&
        parseTimestamp(account.lastActivityOn) >= activityCutoff,
    ),
    confirmationRate: toRate(confirmed, registrations),
    teamConversionRate: toRate(teamsCreated, registrations),
    sources: buildBreakdown(cohort, (account) =>
      joinAttribution(account.source, account.medium),
    ),
    campaigns: buildBreakdown(
      cohort.filter((account) => Boolean(account.campaign)),
      (account) => account.campaign ?? "Campagne non renseignée",
    ),
  };
}

function buildBreakdown(
  accounts: AcquisitionAccount[],
  readLabel: (account: AcquisitionAccount) => string,
) {
  const groups = new Map<string, AcquisitionAccount[]>();

  for (const account of accounts) {
    const label = readLabel(account);
    groups.set(label, [...(groups.get(label) ?? []), account]);
  }

  return [...groups.entries()]
    .map(([label, groupedAccounts]) => {
      const registrations = groupedAccounts.length;
      const confirmed = countMatching(groupedAccounts, (account) =>
        Boolean(account.emailConfirmedAt),
      );
      const teamsCreated = countMatching(
        groupedAccounts,
        (account) => account.hasTeam,
      );

      return {
        label,
        registrations,
        confirmed,
        teamsCreated,
        teamConversionRate: toRate(teamsCreated, registrations),
      } satisfies AcquisitionBreakdownRow;
    })
    .sort(
      (left, right) =>
        right.registrations - left.registrations ||
        left.label.localeCompare(right.label, "fr"),
    );
}

function joinAttribution(source: string | null, medium: string | null) {
  if (!source) return "Accès direct / non attribué";
  return medium ? `${source} · ${medium}` : source;
}

function countMatching(
  accounts: AcquisitionAccount[],
  predicate: (account: AcquisitionAccount) => boolean,
) {
  return accounts.reduce(
    (total, account) => total + (predicate(account) ? 1 : 0),
    0,
  );
}

function toRate(value: number, total: number) {
  return total === 0 ? 0 : Math.round((value / total) * 1000) / 10;
}

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}
