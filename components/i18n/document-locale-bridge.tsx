"use client";

import { useLayoutEffect } from "react";

import type { AppLocale } from "@/lib/i18n/config";
import { translateUiText } from "@/lib/i18n/ui-translations";

const TRANSLATABLE_ATTRIBUTES = [
  "alt",
  "aria-description",
  "aria-label",
  "aria-valuetext",
  "placeholder",
  "title",
  "value",
] as const;
const SKIPPED_ELEMENTS = new Set([
  "CODE",
  "KBD",
  "NOSCRIPT",
  "PRE",
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
]);
const originalText = new WeakMap<Text, string>();
const appliedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

export function DocumentLocaleBridge({ locale }: { locale: AppLocale }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let isApplying = false;

    const applyLocale = (target: Node = root) => {
      if (isApplying) return;
      isApplying = true;
      try {
        if (locale === "en") translateTree(target);
        else restoreTree(target);
      } finally {
        isApplying = false;
      }
    };

    applyLocale();

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          applyLocale(mutation.target);
          let next = mutation.target.nextSibling;
          while (next?.nodeType === Node.COMMENT_NODE) next = next.nextSibling;
          if (next instanceof Text && /^(?:s|e|es|x)$/.test(originalText.get(next) ?? next.data)) applyLocale(next);
          continue;
        }
        if (mutation.type === "attributes") {
          applyLocale(mutation.target);
          continue;
        }
        for (const node of mutation.addedNodes) applyLocale(node);
      }
      observe(observer, root);
    });

    observe(observer, root);
    return () => {
      observer.disconnect();
      restoreTree(root);
    };
  }, [locale]);

  return null;
}

function observe(observer: MutationObserver, root: HTMLElement) {
  observer.observe(root, {
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    characterData: true,
    childList: true,
    subtree: true,
  });
}

function translateTree(root: Node) {
  visitTree(root, translateTextNode, translateElement);
}

function restoreTree(root: Node) {
  visitTree(root, restoreTextNode, restoreElement);
}

function visitTree(
  root: Node,
  visitText: (node: Text) => void,
  visitElement: (element: Element) => void,
) {
  if (root instanceof Text) {
    if (!shouldSkip(root.parentElement)) visitText(root);
    return;
  }

  if (root instanceof Element) {
    if (shouldSkip(root)) return;
    visitElement(root);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Element && shouldSkip(node)) return NodeFilter.FILTER_REJECT;
      if (node instanceof Text && shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) visitText(current);
    else if (current instanceof Element) visitElement(current);
    current = walker.nextNode();
  }
}

function shouldSkip(element: Element | null): boolean {
  if (!element) return false;
  if (SKIPPED_ELEMENTS.has(element.tagName)) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  return Boolean(element.closest('[data-i18n-skip], [translate="no"]'));
}

function translateTextNode(node: Text) {
  let source = originalText.get(node);
  if (
    source === undefined ||
    (node.data !== source && node.data !== appliedText.get(node))
  ) {
    source = node.data;
    originalText.set(node, source);
  }
  const translated = isFrenchAgreementSuffix(node, source) ? "" : translateUiText(source);
  appliedText.set(node, translated);
  if (translated !== node.data) node.data = translated;
}

function isFrenchAgreementSuffix(node: Text, source: string): boolean {
  if (!/^(?:s|e|es|x)$/.test(source)) return false;
  let previous = node.previousSibling;
  while (previous?.nodeType === Node.COMMENT_NODE) previous = previous.previousSibling;
  if (!(previous instanceof Text)) return false;
  const original = originalText.get(previous);
  if (!original || previous.data === original) return false;
  // React renders conditional agreement suffixes as separate text nodes.
  // English adjectives do not take them; noun plurals (rider/day/etc.) do.
  return /(?:engagé|sélectionné|confirmé|inscrit|requis|ajouté|affecté|blessé|classé|attendu|retiré|terminé|disponible|entraîné|lu|enregistré|réalisé|récent|nouveau|prolongé|suivi|débloqué|programmé|intermédiaire|revendu|mené)e?$/u.test(original);
}

function restoreTextNode(node: Text) {
  const source = originalText.get(node);
  if (source === undefined) return;
  const translated = appliedText.get(node);
  if (node.data !== source && node.data !== translated) {
    originalText.set(node, node.data);
    return;
  }
  if (source !== node.data) node.data = source;
}

function translateElement(element: Element) {
  let originals = originalAttributes.get(element);
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    // Submit labels are interface copy; editable form values belong to the user.
    if (attribute === "value" && (element.tagName !== "INPUT" ||
      !["submit", "reset", "button"].includes(element.getAttribute("type") ?? ""))) continue;
    const current = element.getAttribute(attribute);
    if (!current) continue;
    if (!originals) {
      originals = new Map();
      originalAttributes.set(element, originals);
    }
    const previousSource = originals.get(attribute);
    if (
      previousSource === undefined ||
      (current !== previousSource && current !== translateUiText(previousSource))
    ) {
      originals.set(attribute, current);
    }
    const source = originals.get(attribute) ?? current;
    const translated = translateUiText(source);
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

function restoreElement(element: Element) {
  const originals = originalAttributes.get(element);
  if (!originals) return;
  for (const [attribute, source] of originals) {
    const current = element.getAttribute(attribute);
    if (current !== source && current !== translateUiText(source)) {
      if (current !== null) originals.set(attribute, current);
      continue;
    }
    if (current !== source) element.setAttribute(attribute, source);
  }
}
