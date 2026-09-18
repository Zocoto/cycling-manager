import type { RiderQuickPreview } from "@/lib/game/rider-quick-preview";

type PreviewRequest = {
  expiresAt: number;
  request: Promise<RiderQuickPreview>;
};

const previewRequests = new Map<string, PreviewRequest>();

export function getRiderPreview(riderId: string): Promise<RiderQuickPreview> {
  const cached = previewRequests.get(riderId);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const request = fetch(`/api/riders/${encodeURIComponent(riderId)}/preview`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Rider preview request failed with ${response.status}.`);
    }
    return (await response.json()) as RiderQuickPreview;
  });

  previewRequests.set(riderId, {
    expiresAt: Date.now() + 30_000,
    request,
  });
  void request.catch(() => {
    if (previewRequests.get(riderId)?.request === request) {
      previewRequests.delete(riderId);
    }
  });
  return request;
}
