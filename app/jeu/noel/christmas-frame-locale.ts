type TranslateUiText = (source: string) => string;
const ATTRIBUTES = ["alt", "aria-description", "aria-label", "aria-valuetext", "placeholder", "title"];
const SKIP = new Set(["SCRIPT", "STYLE", "CANVAS", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);

type Translation = { source: string; applied: string };

/** Translate only this trusted experience, including its same-origin minigame frame. */
export function installChristmasFrameLocaleBridge(doc: Document, translate: TranslateUiText): () => void {
  return installDocumentBridge(doc, translate, 0);
}

function installDocumentBridge(doc: Document, translate: TranslateUiText, depth: number): () => void {
  const root = doc.documentElement;
  const Observer = doc.defaultView?.MutationObserver;
  if (!root || !Observer) return () => undefined;
  const childWindow = doc.defaultView;
  const originalConfirm = childWindow?.confirm;
  const translatedConfirm = (message?: string) => originalConfirm!.call(childWindow, translate(String(message ?? "")));
  if (childWindow) childWindow.confirm = translatedConfirm;
  const texts = new WeakMap<Text, Translation>();
  const attributes = new WeakMap<Element, Map<string, Translation>>();
  const frames = new Map<HTMLIFrameElement, { cleanup: () => void; document: Document | null; load: () => void }>();
  const skipped = (element: Element | null) => Boolean(element && (SKIP.has(element.tagName)
    || element.closest('[data-i18n-skip], [translate="no"], [contenteditable]:not([contenteditable="false"])')));

  function applyText(node: Text) {
    if (skipped(node.parentElement) || !/[A-Za-zÀ-ÿ]/.test(node.data)) return;
    const old = texts.get(node);
    const source = old && node.data === old.applied ? old.source : node.data;
    const applied = translate(source);
    texts.set(node, { source, applied });
    if (node.data !== applied) node.data = applied;
  }
  function applyFrame(frame: HTMLIFrameElement) {
    if (depth >= 2 || frames.has(frame)) return;
    const entry = { cleanup: () => undefined as void, document: null as Document | null, load: () => undefined as void };
    entry.load = () => {
      try {
        const child = frame.contentDocument;
        if (!child || child === entry.document || child.defaultView?.location.origin !== doc.defaultView?.location.origin) return;
        entry.cleanup();
        entry.document = child;
        entry.cleanup = installDocumentBridge(child, translate, depth + 1);
      } catch { /* Cross-origin navigation must never be inspected. */ }
    };
    frames.set(frame, entry);
    frame.addEventListener("load", entry.load);
    entry.load();
  }
  function applyElement(element: Element) {
    const saved = attributes.get(element) ?? new Map<string, Translation>();
    for (const attribute of ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const old = saved.get(attribute);
      const source = old && current === old.applied ? old.source : current;
      const applied = translate(source);
      saved.set(attribute, { source, applied });
      if (current !== applied) element.setAttribute(attribute, applied);
    }
    attributes.set(element, saved);
    if (element.tagName === "IFRAME") applyFrame(element as HTMLIFrameElement);
  }
  function apply(node: Node) {
    // Nodes belong to the child window: parent-realm instanceof checks are incorrect.
    if (node.nodeType === 3) { applyText(node as Text); return; }
    if (node.nodeType === 1) {
      if (skipped(node as Element)) return;
      applyElement(node as Element);
    }
    const walker = doc.createTreeWalker(node, 5, {
      acceptNode(candidate) {
        const element = candidate.nodeType === 1 ? candidate as Element : candidate.parentElement;
        return skipped(element) ? 2 : 1;
      },
    });
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === 3) applyText(walker.currentNode as Text);
      else applyElement(walker.currentNode as Element);
    }
  }
  const options: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES };
  const observer = new Observer(mutations => {
    observer.disconnect();
    try {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const added of mutation.addedNodes) apply(added);
        } else apply(mutation.target);
      }
      for (const [frame, entry] of frames) {
        if (root.contains(frame)) continue;
        frame.removeEventListener("load", entry.load);
        entry.cleanup();
        frames.delete(frame);
      }
    } finally { observer.observe(root, options); }
  });
  apply(root);
  doc.documentElement.lang = "en";
  observer.observe(root, options);
  return () => {
    observer.disconnect();
    for (const [frame, entry] of frames) { frame.removeEventListener("load", entry.load); entry.cleanup(); }
    frames.clear();
    if (childWindow?.confirm === translatedConfirm && originalConfirm) childWindow.confirm = originalConfirm;
  };
}
