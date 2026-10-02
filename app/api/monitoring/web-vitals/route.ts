import { after } from "next/server";
import { parseWebPerformanceSample } from "@/lib/performance/samples";
import { persistPerformanceSamples } from "@/services/performance-monitoring";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 16_000) return new Response(null, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 16_000) return new Response(null, { status: 413 });
  let input: unknown;
  try { input = JSON.parse(rawBody); } catch { return new Response(null, { status: 400 }); }
  const rawMetrics = input && typeof input === "object" && "metrics" in input ? (input as { metrics: unknown }).metrics : null;
  if (!Array.isArray(rawMetrics) || rawMetrics.length > 10) return new Response(null, { status: 400 });
  const samples = rawMetrics.flatMap((metric) => {
    const sample = parseWebPerformanceSample(metric);
    return sample ? [sample] : [];
  });
  if (!samples.length) return new Response(null, { status: 400 });
  after(() => persistPerformanceSamples(samples));
  return new Response(null, { status: 204 });
}
