"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { prepareChatImage } from "@/lib/game/chat-image-client";
import { getPastedChatImages, validateChatImage } from "@/lib/game/chat-images";

export function useChatImageDraft(disabled: boolean) {
  const [image, setImage] = useState<{ file: File; previewUrl: string; requestId: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const preparingRef = useRef(false);
  const imageRef = useRef(image);

  useEffect(() => () => {
    generation.current++;
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.previewUrl);
  }, []);

  function clear() {
    generation.current++;
    preparingRef.current = false;
    setPreparing(false);
    if (imageRef.current) URL.revokeObjectURL(imageRef.current.previewUrl);
    setImage(null);
    imageRef.current = null;
    setError(null);
  }

  async function select(file: File) {
    if (disabled || preparingRef.current) return;
    if (imageRef.current) { setError("Une seule image par message. Retirez l’image actuelle pour la remplacer."); return; }
    const invalid = validateChatImage(file);
    if (invalid) { setError(invalid); return; }
    const currentGeneration = ++generation.current;
    preparingRef.current = true;
    setPreparing(true);
    setError(null);
    try {
      const prepared = await prepareChatImage(file);
      if (currentGeneration !== generation.current) return;
      const requestId = crypto.randomUUID();
      const next = { file: prepared, previewUrl: URL.createObjectURL(prepared), requestId };
      imageRef.current = next;
      setImage(next);
    } catch (cause) {
      if (currentGeneration === generation.current) setError(cause instanceof Error ? cause.message : "Cette image n’a pas pu être préparée.");
    } finally {
      if (currentGeneration === generation.current) { preparingRef.current = false; setPreparing(false); }
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const images = getPastedChatImages(event.clipboardData);
    if (!images.length) return; // Plain text pastes retain the browser's normal behavior.
    event.preventDefault();
    if (disabled) return;
    if (images.length > 1) { setError("Collez une seule image à la fois."); return; }
    void select(images[0]);
  }

  return { image, preparing, error, select, clear, onPaste };
}
