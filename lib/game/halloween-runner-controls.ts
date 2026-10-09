/** Input only. Never changes the deterministic course or the server's score proof. */
export function createHalloweenRunnerControls() {
  let jump = false;
  const pointers = new Set<number>();
  const keys = new Set<string>();
  return {
    jump() { jump = true; },
    pressPointer(id: number) { pointers.add(id); },
    releasePointer(id: number) { pointers.delete(id); },
    pressKey(key: string) { keys.add(key); },
    releaseKey(key: string) { keys.delete(key); },
    read() { return { jump, duck: pointers.size > 0 || keys.size > 0 }; },
    consumeJump() { jump = false; },
    clear() { jump = false; pointers.clear(); keys.clear(); },
  };
}

/** Full forward visibility on every screen; only the decorative framing changes. */
export function halloweenRunnerViewport(width: number, height: number) {
  const scale = Math.min(width / 1040, height / 420);
  return { scale, x: (width - 1040 * scale) / 2 + 80 * scale, y: Math.max(0, Math.min(height - 420 * scale, height * .8 - 334 * scale)) };
}
