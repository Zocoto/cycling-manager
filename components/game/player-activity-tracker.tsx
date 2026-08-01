"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  getPlayerActivitySection,
  normalizePlayerActivityKey,
  normalizePlayerActivityLabel,
  normalizePlayerActivityRoute,
  type PlayerActivityInput,
} from "@/lib/game/player-activity";

const TRACKING_ENDPOINT = "/api/player-activity";
const MONITORING_ROUTE = "/jeu/monitoring-activite";
const MAX_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 2_500;

export function PlayerActivityTracker() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const queueRef = useRef<PlayerActivityInput[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (queueRef.current.length === 0) return;

    const events = queueRef.current.splice(0, MAX_BATCH_SIZE);
    void fetch(TRACKING_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // Le monitoring ne doit jamais perturber l’expérience de jeu.
    });
  }, []);

  const enqueue = useCallback(
    (event: PlayerActivityInput) => {
      queueRef.current.push(event);

      if (queueRef.current.length >= MAX_BATCH_SIZE) {
        flush();
        return;
      }

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
      }
    },
    [flush],
  );

  useEffect(() => {
    pathnameRef.current = pathname;
    const routePath = normalizePlayerActivityRoute(pathname);

    if (!routePath || routePath.startsWith(MONITORING_ROUTE)) return;

    const section = getPlayerActivitySection(routePath);
    enqueue({
      eventType: "page_view",
      routePath,
      sectionKey: section.key,
      actionKey: null,
      actionLabel: null,
      deviceType: getDeviceType(),
    });
  }, [enqueue, pathname]);

  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || shouldIgnore(form)) return;

      const routePath = normalizePlayerActivityRoute(pathnameRef.current);
      if (!routePath || routePath.startsWith(MONITORING_ROUTE)) return;

      const submitter =
        event.submitter instanceof HTMLElement ? event.submitter : null;
      const label = getActivityLabel(submitter) ?? getActivityLabel(form) ??
        "Soumission de formulaire";
      const section = getPlayerActivitySection(routePath);

      enqueue({
        eventType: "form_submit",
        routePath,
        sectionKey: section.key,
        actionKey: buildActionKey("form", form, label),
        actionLabel: label,
        deviceType: getDeviceType(),
      });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const control = target.closest<HTMLElement>(
        "button, summary, [role='button']",
      );
      if (!control || shouldIgnore(control)) return;

      if (
        control instanceof HTMLButtonElement &&
        control.type === "submit"
      ) {
        return;
      }

      const routePath = normalizePlayerActivityRoute(pathnameRef.current);
      if (!routePath || routePath.startsWith(MONITORING_ROUTE)) return;

      const label = getActivityLabel(control);
      if (!label) return;

      const section = getPlayerActivitySection(routePath);
      enqueue({
        eventType: "interaction",
        routePath,
        sectionKey: section.key,
        actionKey: buildActionKey("interaction", control, label),
        actionLabel: label,
        deviceType: getDeviceType(),
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "hidden" || queueRef.current.length === 0) {
        return;
      }

      const events = queueRef.current.splice(0, MAX_BATCH_SIZE);
      const payload = new Blob([JSON.stringify({ events })], {
        type: "application/json",
      });
      navigator.sendBeacon(TRACKING_ENDPOINT, payload);
    }

    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flush();
    };
  }, [enqueue, flush]);

  return null;
}

function shouldIgnore(element: Element) {
  return element.closest("[data-activity-ignore='true']") !== null;
}

function getActivityLabel(element: HTMLElement | null) {
  if (!element) return null;

  return normalizePlayerActivityLabel(
    element.dataset.activityLabel ??
      element.getAttribute("aria-label") ??
      element.getAttribute("title") ??
      element.textContent,
  );
}

function buildActionKey(
  prefix: string,
  element: HTMLElement,
  label: string,
) {
  const explicitKey = normalizePlayerActivityKey(element.dataset.activityKey);
  const inferredKey = normalizePlayerActivityKey(label) ?? "action";
  return `${prefix}-${explicitKey ?? inferredKey}`.slice(0, 80);
}

function getDeviceType(): PlayerActivityInput["deviceType"] {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}
