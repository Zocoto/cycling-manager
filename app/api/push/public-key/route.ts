import { getWebPushPublicKey } from "@/services/push-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    return Response.json(
      { error: "Les notifications ne sont pas encore configurées." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { publicKey },
    { headers: { "Cache-Control": "no-store" } },
  );
}
