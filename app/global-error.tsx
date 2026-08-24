"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("global_application_error", {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#f2f6f3", color: "#0b3029" }}>
        <main
          style={{
            alignItems: "center",
            display: "flex",
            fontFamily: "Arial, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <section
            style={{
              background: "white",
              border: "1px solid #d8e3dd",
              borderRadius: "28px",
              boxShadow: "0 24px 70px rgba(11, 48, 41, 0.12)",
              maxWidth: "620px",
              padding: "36px",
              width: "100%",
            }}
          >
            <p
              style={{
                color: "#2d806c",
                fontSize: "12px",
                fontWeight: 900,
                letterSpacing: "0.2em",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Cyclostratège
            </p>
            <h1 style={{ fontSize: "34px", margin: "14px 0 0" }}>
              Le service a rencontré un incident temporaire
            </h1>
            <p style={{ color: "#5e746d", lineHeight: 1.65, marginTop: "16px" }}>
              Votre partie est conservée. Relancez l’application ; si le service
              est encore en cours de récupération, vous pourrez réessayer dans
              quelques instants.
            </p>
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                background: "#0b3029",
                border: 0,
                borderRadius: "16px",
                color: "white",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 900,
                marginTop: "18px",
                minHeight: "48px",
                padding: "12px 24px",
              }}
            >
              Réessayer
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
