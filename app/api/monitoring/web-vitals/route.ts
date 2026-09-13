const KNOWN_METRICS = new Set([
  "CLS",
  "FCP",
  "FID",
  "INP",
  "LCP",
  "TTFB",
  "Next.js-hydration",
  "Next.js-render",
  "Next.js-route-change-to-render",
]);

type WebVitalPayload = {
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

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 16_000) {
    return Response.json({ error: "Payload trop volumineux." }, { status: 413 });
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Payload invalide." }, { status: 400 });
  }

  const rawMetrics =
    input && typeof input === "object" && "metrics" in input
      ? (input as { metrics?: unknown }).metrics
      : null;
  if (!Array.isArray(rawMetrics) || rawMetrics.length > 10) {
    return Response.json({ error: "Métriques invalides." }, { status: 400 });
  }

  const metrics = rawMetrics.flatMap((metric) => {
    const parsed = parseMetric(metric);
    return parsed ? [parsed] : [];
  });
  if (metrics.length === 0) {
    return Response.json({ error: "Aucune métrique valide." }, { status: 400 });
  }

  console.info(
    JSON.stringify({
      event: "web_vitals",
      metrics,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    }),
  );

  return new Response(null, { status: 204 });
}

function parseMetric(value: unknown): WebVitalPayload | null {
  if (!value || typeof value !== "object") return null;
  const metric = value as Record<string, unknown>;
  if (
    typeof metric.id !== "string" ||
    metric.id.length > 200 ||
    typeof metric.name !== "string" ||
    !KNOWN_METRICS.has(metric.name) ||
    typeof metric.value !== "number" ||
    !Number.isFinite(metric.value) ||
    typeof metric.delta !== "number" ||
    !Number.isFinite(metric.delta) ||
    typeof metric.rating !== "string" ||
    typeof metric.navigationType !== "string" ||
    typeof metric.pathname !== "string" ||
    metric.pathname.length > 300 ||
    !metric.pathname.startsWith("/") ||
    typeof metric.viewportWidth !== "number" ||
    !Number.isFinite(metric.viewportWidth) ||
    typeof metric.recordedAt !== "string"
  ) {
    return null;
  }

  return {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating.slice(0, 40),
    navigationType: metric.navigationType.slice(0, 60),
    pathname: metric.pathname,
    viewportWidth: Math.max(0, Math.round(metric.viewportWidth)),
    recordedAt: metric.recordedAt.slice(0, 40),
  };
}
