import { readKlipyPage } from "./chat-gifs";

/** Keep search cancellation and the response-body timeout on older mobile browsers. */
export async function requestKlipyPage(
  url: string,
  kind: "gif" | "meme",
  signal: AbortSignal,
) {
  if (signal.aborted) throw new DOMException("Search cancelled", "AbortError");

  // AbortSignal.any/timeout are unavailable on some otherwise supported phones.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) {
      throw new Error(response.status === 429
        ? "La recherche est très sollicitée. Réessayez un peu plus tard."
        : "Les GIF sont momentanément indisponibles.");
    }
    return readKlipyPage(await response.json(), kind);
  } catch (error) {
    if (timedOut) throw new Error("Les GIF sont momentanément indisponibles.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}
