"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { installChristmasFrameLocaleBridge } from "./christmas-frame-locale";

type ChristmasExperienceFrameProps = { locale: "fr" | "en" };
const MIN_FRAME_HEIGHT = 480;
const MAX_FRAME_HEIGHT = 24_000;

export function validChristmasFrameHeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 200 && value <= MAX_FRAME_HEIGHT;
}

export function ChristmasExperienceFrame({ locale }: ChristmasExperienceFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const localeCleanupRef = useRef<(() => void) | null>(null);
  const [height, setHeight] = useState(1_400);
  const measure = useCallback(() => {
    try {
      const doc = frameRef.current?.contentDocument;
      if (!doc?.body) return;
      const measured = doc.body.getBoundingClientRect().height;
      if (validChristmasFrameHeight(measured)) setHeight(Math.max(MIN_FRAME_HEIGHT, Math.ceil(measured)));
    } catch { /* The frame is served on this origin; ignore a navigation away. */ }
  }, []);
  const onLoad = useCallback(() => {
    localeCleanupRef.current?.();
    observerRef.current?.disconnect();
    measure();
    const body = frameRef.current?.contentDocument?.body;
    if (body && typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(body);
    }
    const doc = frameRef.current?.contentDocument;
    if (locale === "en" && doc) {
      void import("@/lib/i18n/ui-translations").then(({ translateUiText }) => {
        if (frameRef.current?.contentDocument !== doc) return;
        localeCleanupRef.current = installChristmasFrameLocaleBridge(doc, translateUiText);
        measure();
      }).catch(() => undefined);
    }
  }, [locale, measure]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow
        || !event.data || typeof event.data !== "object" || event.data.type !== "noel:height"
        || !validChristmasFrameHeight(event.data.height)) return;
      setHeight(Math.max(MIN_FRAME_HEIGHT, Math.ceil(event.data.height)));
    }
    window.addEventListener("message", onMessage);
    return () => { window.removeEventListener("message", onMessage); observerRef.current?.disconnect(); localeCleanupRef.current?.(); };
  }, []);

  return <iframe ref={frameRef} onLoad={onLoad}
    src={`/jeu/noel/experience/index.html?lang=${locale}`}
    title={locale === "en" ? "Christmas in the peloton" : "Le Noël du Peloton"}
    className="block w-full border-0"
    style={{ height }}
    allow="fullscreen"
    data-christmas-experience-frame
  />;
}
