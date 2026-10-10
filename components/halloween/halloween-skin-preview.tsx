"use client";

import { useEffect, useRef } from "react";
import { SportingDirectorAvatar } from "@/components/game/sporting-director-avatar";
import { previewHalloweenAvatarKey } from "@/lib/game/halloween-avatar";
import type { HalloweenPreviewItem } from "@/lib/game/halloween-catalog";

export function HalloweenSkinPortrait({ avatarKey, item }: { avatarKey?: string | null; item: HalloweenPreviewItem }) {
  return <div className="halloween-skin-portrait" data-halloween-preview-item={item.id}>
    <SportingDirectorAvatar avatarKey={previewHalloweenAvatarKey(avatarKey, item.id)} size="xlarge" label={`Aperçu de ${item.name} sur votre portrait`} />
  </div>;
}

export function HalloweenSkinPreview({ avatarKey, item, onClose }: {
  avatarKey?: string | null; item: HalloweenPreviewItem; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  return <dialog ref={dialog} className="halloween-skin-dialog" aria-labelledby="halloween-skin-preview-title"
    onCancel={onClose} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="halloween-skin-dialog-heading"><div><p className="halloween-eyebrow">Essayage · sans achat</p><h3 id="halloween-skin-preview-title">{item.name}</h3></div><button type="button" className="halloween-subtle-button" onClick={onClose} aria-label="Fermer l’aperçu">✕</button></div>
    <div className="halloween-avatar-comparison">
      <figure><SportingDirectorAvatar avatarKey={avatarKey} size="xlarge" label="Votre portrait actuel" /><figcaption>Votre portrait actuel</figcaption></figure>
      <figure><SportingDirectorAvatar avatarKey={previewHalloweenAvatarKey(avatarKey, item.id)} size="xlarge" label={`Votre portrait avec ${item.name}`} /><figcaption>{item.kind === "transformation" ? "Avec la transformation" : "Avec cet élément"}</figcaption></figure>
    </div>
    <p>{item.description}</p><p className="halloween-secondary">Aperçu sans malédiction préalable. Votre portrait et vos roues ne sont pas modifiés.{item.kind === "transformation" ? " Un sort acheté s’envoie ensuite à un autre DS." : " Après acquisition, retrouvez cet élément dans l’onglet Style de votre éditeur d’avatar ou dans « Mes trésors »."}</p>
  </dialog>;
}
