const dirtyEditors = new Set<symbol>();

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirtyEditors.size) return;
  event.preventDefault();
  event.returnValue = "";
}

export function registerUnsavedManagementChanges() {
  const token = Symbol();
  if (!dirtyEditors.size) window.addEventListener("beforeunload", beforeUnload);
  dirtyEditors.add(token);
  return () => {
    dirtyEditors.delete(token);
    if (!dirtyEditors.size) window.removeEventListener("beforeunload", beforeUnload);
  };
}

export function confirmManagementDraftNavigation(href: string, changesQuery = false) {
  if (!dirtyEditors.size) return true;
  const target = new URL(href, window.location.href);
  if (!changesQuery && target.pathname === window.location.pathname && target.search === window.location.search) return true;
  return window.confirm(document.documentElement.lang.startsWith("en")
    ? "You have unsaved changes. Leave this page?"
    : "Des modifications ne sont pas enregistrées. Quitter cette page ?");
}
