"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

type BufferedMetric = {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating: string;
  navigationType: string;
  pathname: string;
  viewportWidth: number;
  recordedAt: string;
};

const SAMPLE_STORAGE_KEY = "cyclostratege:web-vitals:sampled";
const SAMPLE_RATE = 0.25;
const bufferedMetrics: BufferedMetric[] = [];
let flushTimer: number | null = null;

function isSampledSession() {
  try {
    const stored = window.sessionStorage.getItem(SAMPLE_STORAGE_KEY);
    if (stored !== null) return stored === "1";
    const sampled = Math.random() < SAMPLE_RATE;
    window.sessionStorage.setItem(SAMPLE_STORAGE_KEY, sampled ? "1" : "0");
    return sampled;
  } catch {
    return false;
  }
}

function flushMetrics() {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (bufferedMetrics.length === 0) return;

  const body = JSON.stringify({ metrics: bufferedMetrics.splice(0) });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/monitoring/web-vitals", body);
    return;
  }

  void fetch("/api/monitoring/web-vitals", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "text/plain;charset=UTF-8" },
  });
}

const bufferWebVital: ReportWebVitalsCallback = (metric) => {
  if (!isSampledSession()) return;

  bufferedMetrics.push({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
    pathname: window.location.pathname,
    viewportWidth: window.innerWidth,
    recordedAt: new Date().toISOString(),
  });

  if (flushTimer === null) {
    flushTimer = window.setTimeout(flushMetrics, 5_000);
  }
};

export function WebVitalsReporter() {
  useReportWebVitals(bufferWebVital);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushMetrics();
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      flushMetrics();
    };
  }, []);

  return null;
}
