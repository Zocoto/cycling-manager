"use client";

import { useRef, type PointerEvent } from "react";
import { NationalJerseyDesignArtwork, NATIONAL_JERSEY_SHIRT_PATH } from "./national-jersey-design-artwork";
import type { NationalJerseyDraft } from "@/lib/game/national-jersey-preview";

export function NationalJerseyEditingCanvas({ countryCode, countryName, draft, selectedId, idPrefix, disabled, onSelect, onMove, large = false }: {
  countryCode: string; countryName: string; draft: NationalJerseyDraft; selectedId: string | null; idPrefix: string; disabled: boolean;
  onSelect: (id: string | null) => void; onMove: (id: string, position: { x: number; y: number }) => void;
  large?: boolean;
}) {
  const drag = useRef<{ pointerId: number; id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const selected = draft.elements.find(element => element.id === selectedId);
  const clipId = `${idPrefix}-editing-shirt`;
  const gridId = `${idPrefix}-editing-grid`;
  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const position = event.currentTarget.createSVGPoint();
    position.x = event.clientX; position.y = event.clientY;
    return position.matrixTransform(matrix.inverse());
  }
  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <svg viewBox="0 0 120 132" role="group" aria-label={`Déplacer les éléments du maillot de ${countryName}`} tabIndex={disabled ? -1 : 0}
    className={`mx-auto w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#278B70] [&_[data-national-jersey-element]]:cursor-move [&_[data-national-jersey-element]]:touch-none ${large ? "h-[min(70dvh,36rem)]" : "h-[clamp(3rem,calc(50svh_-_12rem),11rem)] lg:h-[min(38svh,20rem)]"}`}
    style={{ touchAction: "pan-y" }}
    onPointerDown={event => {
      if (disabled || !event.isPrimary || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("[data-national-jersey-element]") : null;
      const element = draft.elements.find(layer => layer.id === target?.getAttribute("data-national-jersey-element"));
      onSelect(element?.id ?? null);
      const position = point(event);
      if (!element || !position) return;
      event.preventDefault(); event.currentTarget.focus();
      drag.current = { pointerId: event.pointerId, id: element.id, startX: position.x, startY: position.y, x: element.x, y: element.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (disabled || !active || active.pointerId !== event.pointerId) return;
      const position = point(event);
      if (position) onMove(active.id, { x: active.x + position.x - active.startX, y: active.y + position.y - active.startY });
    }}
    onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { drag.current = null; }}
    onKeyDown={event => {
      if (disabled || !selected || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 5 : 1;
      onMove(selected.id, { x: selected.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: selected.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
    }}>
    <defs>
      <clipPath id={clipId}><path d={NATIONAL_JERSEY_SHIRT_PATH} /></clipPath>
      <pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#43768D" strokeWidth="0.35" /></pattern>
    </defs>
    <rect width="120" height="132" fill={`url(#${gridId})`} opacity="0.24" pointerEvents="none" />
    <g clipPath={`url(#${clipId})`}><NationalJerseyDesignArtwork countryCode={countryCode} design={draft} idPrefix={`${idPrefix}-editing`} /></g>
    <path d={NATIONAL_JERSEY_SHIRT_PATH} fill="none" stroke="#173F50" strokeWidth="1" pointerEvents="none" />
    <path d="M39 9c4 7 10 10 21 10S77 16 81 9" fill="none" stroke="#173F50" strokeWidth="2" pointerEvents="none" />
    {selected ? <g transform={`translate(${selected.x} ${selected.y}) rotate(${selected.rotation})`} pointerEvents="none" data-editing-selection={selected.id}>
      <rect x={-selected.width / 2 - 1} y={-selected.height / 2 - 1} width={selected.width + 2} height={selected.height + 2} fill="none" stroke="#087B61" strokeWidth="1" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x * (selected.width / 2 + 1)} cy={y * (selected.height / 2 + 1)} r="1.5" fill="#087B61" stroke="white" strokeWidth="0.5" />)}
    </g> : null}
  </svg>;
}
