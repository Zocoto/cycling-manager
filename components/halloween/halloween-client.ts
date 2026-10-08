export async function halloweenRequest(kind: string, payload: Record<string, unknown> = {}, id = crypto.randomUUID()) {
  const body = JSON.stringify({ id, kind, payload });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("/api/halloween", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Action indisponible.");
      return result as Record<string, unknown>;
    } catch (error) {
      if (attempt || !(error instanceof TypeError)) throw error;
    }
  }
  throw new Error("Connexion interrompue. Réessayez.");
}
