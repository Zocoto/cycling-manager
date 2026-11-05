export const TUTORIAL_CLIENT_REQUEST_TIMEOUT_MS = 15_000;

export class TutorialRequestTimeoutError extends Error {
  constructor() {
    super("Tutorial request timed out");
    this.name = "TutorialRequestTimeoutError";
  }
}

/** A timeout releases the UI; it does not cancel a server mutation. */
export async function waitForTutorialRequest<T>(
  request: Promise<T>,
  timeoutMs = TUTORIAL_CLIENT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TutorialRequestTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
