"use client";

import { useEffect, useId, useState } from "react";

type Availability = "checking" | "ready" | "unsupported";

const PUSH_PREFERENCE_KEY = "cyclo-stratege:push-notifications";
let pushActivationPromise: Promise<void> | null = null;

export function PushNotificationControl() {
  const panelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [availability, setAvailability] = useState<Availability>("checking");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let removeDefaultActivationListeners = () => {};

    async function initialize() {
      if (!supportsWebPush()) {
        if (!cancelled) setAvailability("unsupported");
        return;
      }

      let registration: ServiceWorkerRegistration;
      let subscription: PushSubscription | null;
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        subscription = await registration.pushManager.getSubscription();
      } catch {
        if (!cancelled) {
          setAvailability("unsupported");
          setMessage("Les notifications ne sont pas disponibles sur cet appareil.");
        }
        return;
      }
      if (cancelled) return;

      setAvailability("ready");
      if (!isPushPreferenceEnabled()) {
        setIsEnabled(false);
        return;
      }

      if (Notification.permission === "granted") {
        try {
          const activeSubscription = subscription
            ?? await ensurePushSubscription(registration);
          await synchronizeSubscription(activeSubscription);
          if (cancelled) return;
          setIsEnabled(true);
          writePushPreference(true);
        } catch (error) {
          if (cancelled) return;
          setIsEnabled(false);
          setMessage(getPushActivationErrorMessage(error));
        }
        return;
      }

      setIsEnabled(false);
      if (Notification.permission === "denied") {
        setMessage(
          "Autorisation refusée. Vous pouvez la réactiver dans les réglages du navigateur.",
        );
        return;
      }

      const requestDefaultActivation = () => {
        removeDefaultActivationListeners();
        setIsBusy(true);
        void requestAndSynchronizePushNotifications()
          .then(() => {
            if (cancelled) return;
            writePushPreference(true);
            setIsEnabled(true);
            setMessage("Notifications activées sur cet appareil.");
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            setIsEnabled(false);
            setMessage(getPushActivationErrorMessage(error));
          })
          .finally(() => {
            if (!cancelled) setIsBusy(false);
          });
      };
      removeDefaultActivationListeners = () => {
        window.removeEventListener(
          "pointerdown",
          requestDefaultActivation,
          true,
        );
        window.removeEventListener("keydown", requestDefaultActivation, true);
      };
      window.addEventListener("pointerdown", requestDefaultActivation, {
        capture: true,
        once: true,
      });
      window.addEventListener("keydown", requestDefaultActivation, {
        capture: true,
        once: true,
      });
    }

    void initialize();
    return () => {
      cancelled = true;
      removeDefaultActivationListeners();
    };
  }, []);

  async function enableNotifications() {
    if (!supportsWebPush()) return;
    setIsBusy(true);
    setMessage(null);
    writePushPreference(true);

    try {
      await requestAndSynchronizePushNotifications();
      setIsEnabled(true);
      setMessage("Notifications activées sur cet appareil.");
    } catch (error) {
      setIsEnabled(false);
      setMessage(getPushActivationErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function disableNotifications() {
    if (!supportsWebPush()) return;
    setIsBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "Désactivation impossible.");
        }
        await subscription.unsubscribe();
      }

      writePushPreference(false);
      setIsEnabled(false);
      setMessage("Notifications désactivées sur cet appareil.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de désactiver les notifications.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  const buttonLabel = isEnabled
    ? "Notifications activées"
    : "Configurer les notifications";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={buttonLabel}
        aria-label={buttonLabel}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--game-header-accent)] sm:h-10 sm:w-10 ${
          isEnabled
            ? "border-[var(--game-header-accent)] bg-[var(--game-header-accent-soft)] text-[var(--game-header-accent)]"
            : "border-[#D6DFD2]/25 bg-white/5 text-[#D6DFD2] hover:border-[var(--game-header-accent)] hover:text-[var(--game-header-accent)]"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-[18px] w-[18px]"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8.3a5 5 0 0 1 10 0c0 5 2 5.2 2 5.2H3s2-.2 2-5.2Z" />
          <path d="M8 16h4" />
        </svg>
        {isEnabled ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-[#071A17] bg-[#72D6A2]" />
        ) : null}
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="fixed right-3 top-24 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border border-[#78947D]/45 bg-[#FFFDF4] p-4 text-[#082A2A] shadow-2xl shadow-black/35 lg:absolute lg:right-0 lg:top-12"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.12em] text-[#278B70]">
                Alertes de jeu
              </p>
              <p className="mt-1 text-sm leading-5 text-[#456258]">
                Recevez les événements importants même lorsque Cyclo Stratège est fermé.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#78947D]/35 text-lg text-[#456258]"
            >
              ×
            </button>
          </div>

          <ul className="mt-3 grid gap-1 text-xs leading-5 text-[#38564D]">
            <li>• Départ d’un live où votre équipe est inscrite</li>
            <li>• Offres de transfert reçues et réponses à vos offres</li>
            <li>• Cyclogazette publiée à 20 h</li>
            <li>• Rapports de scouting finalisés</li>
            <li>• Travaux d’infrastructure terminés</li>
          </ul>

          <p className="mt-3 rounded-lg bg-[#278B70]/10 px-3 py-2 text-xs font-semibold text-[#1B6655]">
            Plage calme : aucun envoi entre 22 h et 8 h, heure de Paris.
          </p>

          {availability === "unsupported" ? (
            <p className="mt-3 text-xs font-semibold text-[#9A3B43]">
              Installez l’application ou utilisez une version récente de Chrome, Edge ou Safari pour activer les notifications.
            </p>
          ) : (
            <button
              type="button"
              disabled={isBusy || availability === "checking"}
              onClick={() => void (isEnabled
                ? disableNotifications()
                : enableNotifications())}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#0A4338] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#126453] disabled:cursor-wait disabled:opacity-60"
            >
              {isBusy
                ? "Mise à jour…"
                : isEnabled
                  ? "Désactiver sur cet appareil"
                  : "Activer sur cet appareil"}
            </button>
          )}

          {message ? (
            <p aria-live="polite" className="mt-2 text-xs font-semibold text-[#456258]">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

async function synchronizeSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error || "Synchronisation de l’appareil impossible.");
  }
}

async function requestAndSynchronizePushNotifications() {
  if (!pushActivationPromise) {
    pushActivationPromise = performPushActivation().finally(() => {
      pushActivationPromise = null;
    });
  }
  return pushActivationPromise;
}

async function performPushActivation() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Autorisation refusée. Vous pouvez la réactiver dans les réglages du navigateur."
        : "L’autorisation est nécessaire pour recevoir les alertes.",
    );
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await ensurePushSubscription(registration);
  await synchronizeSubscription(subscription);
}

async function ensurePushSubscription(registration: ServiceWorkerRegistration) {
  const currentSubscription = await registration.pushManager.getSubscription();
  if (currentSubscription) return currentSubscription;

  const response = await fetch("/api/push/public-key", {
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    publicKey?: string;
    error?: string;
  };
  if (!response.ok || !payload.publicKey) {
    throw new Error(payload.error || "Configuration push indisponible.");
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(payload.publicKey),
  });
}

function isPushPreferenceEnabled() {
  try {
    return window.localStorage.getItem(PUSH_PREFERENCE_KEY) !== "disabled";
  } catch {
    return true;
  }
}

function writePushPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(
      PUSH_PREFERENCE_KEY,
      enabled ? "enabled" : "disabled",
    );
  } catch {
    // Le stockage local peut être indisponible en navigation privée.
  }
}

function getPushActivationErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Impossible d’activer les notifications.";
}

function supportsWebPush() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}
