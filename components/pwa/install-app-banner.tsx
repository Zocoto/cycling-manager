"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPlatform = "android" | "ios" | "other";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isRunningStandalone() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function getInstallPlatform(): InstallPlatform {
  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  if (/iPad|iPhone|iPod/i.test(navigator.userAgent) || isIPadOS) {
    return "ios";
  }

  if (/Android/i.test(navigator.userAgent)) {
    return "android";
  }

  return "other";
}

function subscribeToClientEnvironment() {
  return () => undefined;
}

function getServerInstallPlatform(): InstallPlatform {
  return "other";
}

function subscribeToDisplayMode(onStoreChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onStoreChange);

  return () => displayMode.removeEventListener("change", onStoreChange);
}

export function InstallAppBanner() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [wasInstalled, setWasInstalled] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [status, setStatus] = useState("");
  const platform = useSyncExternalStore(
    subscribeToClientEnvironment,
    getInstallPlatform,
    getServerInstallPlatform,
  );
  const isStandalone = useSyncExternalStore(
    subscribeToDisplayMode,
    isRunningStandalone,
    () => false,
  );
  const isInstalled = isStandalone || wasInstalled;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setWasInstalled(true);
      setStatus("Cyclo Stratège est maintenant installé sur votre appareil.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  const buttonLabel = installPrompt
    ? "Installer l’application"
    : platform === "ios"
      ? "Installer sur iPhone"
      : platform === "android"
        ? "Installer sur Android"
        : "Voir comment l’installer";

  async function handleInstall() {
    setStatus("");

    if (!installPrompt) {
      setIsGuideOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setStatus("Installation lancée. L’icône apparaîtra sur votre écran.");
      return;
    }

    setStatus("Installation annulée. Vous pourrez la relancer ici.");
  }

  return (
    <section
      data-pwa-install-banner
      aria-labelledby="install-app-title"
      className="relative overflow-hidden border-b border-[#315B3E]/20 bg-[#EAF5F3] px-5 py-4 text-[#082A2A] sm:px-8 sm:py-5"
    >
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#8DE3C9]/45 bg-[linear-gradient(105deg,#071A17_0%,#0B302B_62%,#176951_100%)] px-5 py-5 text-[#FFFDF4] shadow-[0_18px_48px_rgba(7,26,23,0.2)] sm:px-7 sm:py-6">
        <span
          aria-hidden="true"
          className="absolute -right-10 -top-20 h-56 w-56 rounded-full border-[36px] border-[#42CDA8]/10"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#42CDA8] via-[#F2C94C] to-[#42CDA8]"
        />

        <div className="relative grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <InstallPhoneIcon />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#F2C94C] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#071A17]">
                Nouveau
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8DE3C9]">
                iPhone · Android
              </span>
            </div>

            <h2
              id="install-app-title"
              className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl"
            >
              Cyclo Stratège vous suit désormais dans la poche.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D6DFD2] sm:text-base">
              Installez le jeu sur votre écran d’accueil : accès rapide, plein
              écran et aucune boutique d’applications nécessaire.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            <button
              type="button"
              onClick={handleInstall}
              aria-expanded={isGuideOpen}
              aria-controls="pwa-install-guide"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#F2C94C] px-5 py-3 text-sm font-black text-[#071A17] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#FFD968] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFDF4]"
            >
              <DownloadIcon />
              {buttonLabel}
            </button>

            {!installPrompt && isGuideOpen ? (
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="rounded-md px-3 py-2 text-xs font-bold text-[#D6DFD2] underline decoration-[#8DE3C9]/45 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F2C94C]"
              >
                Masquer les instructions
              </button>
            ) : null}
          </div>
        </div>

        {isGuideOpen ? <InstallGuide platform={platform} /> : null}

        <p aria-live="polite" className="relative mt-2 text-xs text-[#8DE3C9]">
          {status}
        </p>
      </div>
    </section>
  );
}

function InstallGuide({ platform }: { platform: InstallPlatform }) {
  const showIOS = platform !== "android";
  const showAndroid = platform !== "ios";

  return (
    <div
      id="pwa-install-guide"
      className="relative mt-5 grid gap-3 border-t border-[#8DE3C9]/20 pt-5 md:grid-cols-2"
    >
      {showIOS ? (
        <InstallStepCard
          title="Sur iPhone ou iPad"
          steps={[
            "Ouvrez le site dans Safari.",
            "Touchez Partager, puis « Sur l’écran d’accueil ».",
            "Validez avec « Ajouter ».",
          ]}
        />
      ) : null}

      {showAndroid ? (
        <InstallStepCard
          title="Sur Android"
          steps={[
            "Ouvrez le site dans Chrome.",
            "Touchez le menu ⋮, puis « Installer l’application ».",
            "Confirmez l’installation.",
          ]}
        />
      ) : null}
    </div>
  );
}

function InstallStepCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <article className="rounded-xl border border-[#8DE3C9]/20 bg-white/[0.06] p-4">
      <h3 className="text-sm font-black text-[#F2C94C]">{title}</h3>
      <ol className="mt-3 space-y-2 text-sm text-[#D6DFD2]">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#42CDA8] text-[10px] font-black text-[#071A17]">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function InstallPhoneIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#42CDA8] text-[#071A17] shadow-[0_12px_30px_rgba(66,205,168,0.25)] sm:h-18 sm:w-18"
    >
      <svg
        viewBox="0 0 40 40"
        className="h-10 w-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="3.5" width="22" height="33" rx="4" />
        <path d="M16 7h8" />
        <path d="M17 31.5h6" />
        <path d="M20 13v11" />
        <path d="m15.5 20 4.5 4.5 4.5-4.5" />
      </svg>
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v10" />
      <path d="m6 8 4 4 4-4" />
      <path d="M3 15v2h14v-2" />
    </svg>
  );
}
