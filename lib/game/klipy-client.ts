let sessionCustomerId: string | undefined;

/** An opaque local identifier; no account ID or conversation is sent to KLIPY. */
export function getKlipyCustomerId() {
  if (sessionCustomerId) return sessionCustomerId;
  try {
    const stored = localStorage.getItem("cs-klipy-client");
    if (stored && /^[\w-]{1,64}$/.test(stored)) return (sessionCustomerId = stored);
  } catch { /* Private browsing can block local storage. */ }
  sessionCustomerId = crypto.randomUUID();
  try { localStorage.setItem("cs-klipy-client", sessionCustomerId); } catch { /* Keep a session-only ID. */ }
  return sessionCustomerId;
}
