import "server-only";

import type {
  PlayerActivityDeviceType,
  PlayerActivityEventType,
} from "@/lib/game/player-activity";
import {
  getPlayerActivitySectionLabel,
  PLAYER_ACTIVITY_SECTIONS,
} from "@/lib/game/player-activity";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type PlayerActivityMonitoringFilters = {
  eventType: PlayerActivityEventType | null;
  sectionKey: string | null;
  page: number;
};

export type PlayerActivityMonitoringEvent = {
  id: number;
  actorName: string;
  actorUsername: string | null;
  teamName: string | null;
  eventType: PlayerActivityEventType;
  routePath: string;
  sectionKey: string;
  sectionLabel: string;
  actionKey: string | null;
  actionLabel: string | null;
  deviceType: PlayerActivityDeviceType;
  occurredAt: string;
};

export type PlayerActivityMonitoringOverview = {
  windowStartedAt: string;
  generatedAt: string;
  summary: {
    totalEvents: number;
    uniquePlayers: number;
    pageViews: number;
    actions: number;
    mobileEvents: number;
  };
  sections: Array<{
    sectionKey: string;
    sectionLabel: string;
    totalEvents: number;
    pageViews: number;
    actions: number;
    uniquePlayers: number;
    lastActivityAt: string;
  }>;
  events: PlayerActivityMonitoringEvent[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export async function getPlayerActivityMonitoring(
  supabase: SupabaseServerClient,
  filters: PlayerActivityMonitoringFilters,
) {
  const { data, error } = await supabase.rpc(
    "get_player_activity_monitoring",
    {
      p_event_filter: filters.eventType,
      p_section_filter: filters.sectionKey,
      p_page: filters.page,
      p_page_size: 50,
    },
  );

  if (error) {
    throw new Error(`Impossible de charger l’activité des joueurs : ${error.message}`);
  }

  return normalizeMonitoringOverview(data);
}

export function normalizeMonitoringOverview(
  value: unknown,
): PlayerActivityMonitoringOverview {
  const root = asRecord(value);
  const summary = asRecord(root.summary);
  const pagination = asRecord(root.pagination);
  const sections = Array.isArray(root.sections) ? root.sections : [];
  const events = Array.isArray(root.events) ? root.events : [];

  return {
    windowStartedAt: asIsoDate(root.windowStartedAt),
    generatedAt: asIsoDate(root.generatedAt),
    summary: {
      totalEvents: asCount(summary.totalEvents),
      uniquePlayers: asCount(summary.uniquePlayers),
      pageViews: asCount(summary.pageViews),
      actions: asCount(summary.actions),
      mobileEvents: asCount(summary.mobileEvents),
    },
    sections: completeMonitoringSections(sections),
    events: events
      .map(normalizeMonitoringEvent)
      .filter((event) => event !== null),
    pagination: {
      page: Math.max(1, asCount(pagination.page)),
      pageSize: Math.max(10, asCount(pagination.pageSize)),
      totalItems: asCount(pagination.totalItems),
      totalPages: Math.max(1, asCount(pagination.totalPages)),
    },
  };
}

function completeMonitoringSections(values: unknown[]) {
  const normalized = values.map((value) => {
    const section = asRecord(value);
    const sectionKey = asText(section.sectionKey, "inconnue");

    return {
      sectionKey,
      sectionLabel: getPlayerActivitySectionLabel(sectionKey),
      totalEvents: asCount(section.totalEvents),
      pageViews: asCount(section.pageViews),
      actions: asCount(section.actions),
      uniquePlayers: asCount(section.uniquePlayers),
      lastActivityAt: asIsoDate(section.lastActivityAt),
    };
  });
  const sectionByKey = new Map(
    normalized.map((section) => [section.sectionKey, section]),
  );
  const knownKeys = new Set(PLAYER_ACTIVITY_SECTIONS.map((section) => section.key));

  return [
    ...PLAYER_ACTIVITY_SECTIONS.map(
      (definition) =>
        sectionByKey.get(definition.key) ?? {
          sectionKey: definition.key,
          sectionLabel: definition.label,
          totalEvents: 0,
          pageViews: 0,
          actions: 0,
          uniquePlayers: 0,
          lastActivityAt: new Date(0).toISOString(),
        },
    ),
    ...normalized.filter((section) => !knownKeys.has(section.sectionKey)),
  ].sort(
    (left, right) =>
      right.pageViews - left.pageViews ||
      right.totalEvents - left.totalEvents ||
      left.sectionLabel.localeCompare(right.sectionLabel, "fr"),
  );
}
function normalizeMonitoringEvent(
  value: unknown,
): PlayerActivityMonitoringEvent | null {
  const event = asRecord(value);
  const eventType = event.eventType;
  const deviceType = event.deviceType;

  if (!isEventType(eventType) || !isDeviceType(deviceType)) return null;

  const sectionKey = asText(event.sectionKey, "inconnue");
  return {
    id: asCount(event.id),
    actorName: asText(event.actorName, "Joueur"),
    actorUsername: asNullableText(event.actorUsername),
    teamName: asNullableText(event.teamName),
    eventType,
    routePath: asText(event.routePath, "/jeu"),
    sectionKey,
    sectionLabel: getPlayerActivitySectionLabel(sectionKey),
    actionKey: asNullableText(event.actionKey),
    actionLabel: asNullableText(event.actionLabel),
    deviceType,
    occurredAt: asIsoDate(event.occurredAt),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asCount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function asIsoDate(value: unknown) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  return new Date(0).toISOString();
}

function isEventType(value: unknown): value is PlayerActivityEventType {
  return (
    value === "page_view" ||
    value === "form_submit" ||
    value === "interaction"
  );
}

function isDeviceType(value: unknown): value is PlayerActivityDeviceType {
  return value === "desktop" || value === "tablet" || value === "mobile";
}
