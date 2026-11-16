"use client";

import Image from "next/image";
import { useId, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { CHAT_IMAGE_TYPES, CHAT_IMAGE_UPLOAD_MAX_BYTES } from "@/lib/game/chat-images";
import {
  MEDIA_CENTER_ARTICLE_FONTS,
  MEDIA_CENTER_MAX_ALT_LENGTH,
  MEDIA_CENTER_MAX_BLOCKS,
  MEDIA_CENTER_MAX_CAPTION_LENGTH,
  MEDIA_CENTER_MAX_IMAGES,
  type MediaCenterArticleBlock,
  type MediaCenterArticleFont,
  type MediaCenterArticleTextRun,
} from "@/lib/game/media-center-article";
import { uploadMediaCenterImage } from "@/lib/game/media-center-images";
import { MediaCenterArticleContent } from "./media-center-article-content";

export type MediaCenterDraftBlock = { id: number; block: MediaCenterArticleBlock };

type TextBlock = Extract<MediaCenterArticleBlock, { type: "text" }>;
type ImageBlock = Extract<MediaCenterArticleBlock, { type: "image" }>;
type Mark = "bold" | "italic";
type Copy = keyof typeof editorCopy;
type EditorLabels = Record<Copy, string>;

const editorCopy = {
  content: ["Contenu de la tribune", "Column content"],
  preview: ["Aperçu", "Preview"],
  edit: ["Revenir à l’édition", "Return to editing"],
  text: ["Texte", "Text"],
  image: ["Illustration", "Illustration"],
  insertText: ["Ajouter du texte", "Add text"],
  insertImage: ["Importer une image", "Upload image"],
  writingHint: ["Écrivez votre texte…", "Write your text…"],
  font: ["Typographie", "Typeface"],
  bold: ["Gras", "Bold"],
  italic: ["Italique", "Italic"],
  moveUp: ["Monter le bloc", "Move block up"],
  moveDown: ["Descendre le bloc", "Move block down"],
  remove: ["Retirer le bloc", "Remove block"],
  alignment: ["Placement", "Placement"],
  left: ["À gauche", "Left"],
  center: ["Au centre", "Centered"],
  right: ["À droite", "Right"],
  wide: ["Pleine largeur", "Full width"],
  caption: ["Légende (facultative)", "Caption (optional)"],
  alt: ["Description de l’image", "Image description"],
  altPlaceholder: ["Ce que montre l’image", "What the image shows"],
  imageHint: ["PNG, JPEG ou WebP · 2 Mo par image", "PNG, JPEG or WebP · 2 MB per image"],
  imageLimit: ["Limite de 4 images atteinte.", "The 4-image limit has been reached."],
  blockLimit: ["Limite de 20 blocs atteinte.", "The 20-block limit has been reached."],
  importing: ["Import de l’image…", "Uploading image…"],
  tooLarge: ["L’image dépasse 2 Mo.", "The image exceeds 2 MB."],
  invalidFormat: ["Choisissez une image PNG, JPEG ou WebP.", "Choose a PNG, JPEG or WebP image."],
  importError: ["Impossible d’importer cette image. Réessayez.", "Could not upload this image. Try again."],
  untitled: ["Titre de la tribune", "Column title"],
  emptyPreview: ["Ajoutez du texte pour prévisualiser votre tribune.", "Add text to preview your column."],
  limitText: ["caractères", "characters"],
} as const;

const inputClass = "w-full min-w-0 rounded-lg border border-[#CCDBD3] bg-white px-3 py-2 text-sm text-[#183F37] disabled:opacity-50";
const toolClass = "inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent px-2.5 text-xs font-bold text-[#315B3E] transition hover:border-[#CCDBD3] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176951] disabled:opacity-35";
const englishFontLabels: Record<MediaCenterArticleFont, string> = {
  default: "Gazette",
  serif: "Classic",
  sans: "Modern",
  mono: "Typewriter",
};

export function MediaCenterArticleEditor({
  draft, setDraft, title, isEnglish, bodyLength, bodyMinimum, bodyMaximum, disabled, onUploadingChange,
}: {
  draft: MediaCenterDraftBlock[];
  setDraft: (update: (previous: MediaCenterDraftBlock[]) => MediaCenterDraftBlock[]) => void;
  title: string;
  isEnglish: boolean;
  bodyLength: number;
  bodyMinimum: number;
  bodyMaximum: number;
  disabled: boolean;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const copy = Object.fromEntries(Object.entries(editorCopy).map(([key, labels]) => [key, labels[isEnglish ? 1 : 0]])) as EditorLabels;
  const [preview, setPreview] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<number>(0);
  const [focusTextId, setFocusTextId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextBlockId = useRef(1);
  const uploadLock = useRef(false);
  const id = useId();
  const images = draft.filter(({ block }) => block.type === "image").length;
  const maximumBlocksReached = draft.length >= MEDIA_CENTER_MAX_BLOCKS;
  const maximumImagesReached = images >= MEDIA_CENTER_MAX_IMAGES;

  function addBlock(block: MediaCenterArticleBlock, afterId: number) {
    const newId = nextBlockId.current++;
    setDraft((previous) => {
      const index = previous.findIndex(({ id }) => id === afterId);
      const position = index < 0 ? previous.length : index + 1;
      return [...previous.slice(0, position), { id: newId, block }, ...previous.slice(position)];
    });
    setActiveBlockId(newId);
    if (block.type === "text") setFocusTextId(newId);
  }

  function updateBlock(blockId: number, block: MediaCenterArticleBlock) {
    setDraft((previous) => previous.map((entry) => entry.id === blockId ? { id: blockId, block } : entry));
  }

  function moveBlock(blockId: number, offset: -1 | 1) {
    setDraft((previous) => {
      const index = previous.findIndex(({ id }) => id === blockId);
      const destination = index + offset;
      if (index < 0 || destination < 0 || destination >= previous.length) return previous;
      const reordered = previous.slice();
      const [entry] = reordered.splice(index, 1);
      reordered.splice(destination, 0, entry);
      return reordered;
    });
  }

  async function upload(file: File) {
    if (disabled || uploadLock.current || maximumBlocksReached || maximumImagesReached) return;
    setError(null);
    if (!(CHAT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError(copy.invalidFormat);
      return;
    }
    if (file.size > CHAT_IMAGE_UPLOAD_MAX_BYTES) {
      setError(copy.tooLarge);
      return;
    }
    const afterId = activeBlockId;
    uploadLock.current = true;
    setUploading(true);
    onUploadingChange(true);
    try {
      const image = await uploadMediaCenterImage(file);
      addBlock({ type: "image", ...image, alt: "", align: "wide" }, afterId);
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : copy.importError);
    } finally {
      uploadLock.current = false;
      setUploading(false);
      onUploadingChange(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-[#CCDBD3] bg-[#EDF4F0] p-3 sm:p-4" aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 id={id} className="text-sm font-black text-[#183F37]">{copy.content}</h4>
        <button type="button" className={toolClass} onClick={() => { setFocusTextId(null); setPreview(!preview); }}>
          {preview ? copy.edit : copy.preview}
        </button>
      </div>
      {preview ? (
        <div className="rounded-xl border border-[#CCDBD3] bg-white p-4 text-[#183F37] sm:p-6">
          <h5 className="mb-4 text-xl font-black [overflow-wrap:anywhere]" data-i18n-skip={title.trim() ? "" : undefined}>
            {title.trim() || copy.untitled}
          </h5>
          {bodyLength > 0 || images > 0 ? (
            <MediaCenterArticleContent blocks={draft.map(({ block }) => block).filter((block) => (
              block.type === "image" || block.content.some(({ text }) => text.trim())
            ))} />
          ) : (
            <p className="text-sm text-[#60756E]">{copy.emptyPreview}</p>
          )}
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {draft.map(({ id: blockId, block }, index) => {
              const active = activeBlockId === blockId;
              return (
                <li
                  key={blockId}
                  onFocusCapture={() => setActiveBlockId(blockId)}
                  className={`min-w-0 rounded-xl border bg-white ${active ? "border-[#83B6A2]" : "border-[#D6E1DA]"}`}
                >
                  <div className="flex items-center justify-between gap-1 rounded-t-xl border-b border-[#E1E9E4] bg-[#F7FAF8] px-2">
                    <span className="pl-1 text-xs font-bold text-[#315B3E]">
                      {block.type === "text" ? copy.text : copy.image}
                    </span>
                    <div className="flex items-center">
                      <IconButton label={copy.moveUp} disabled={disabled || index === 0} onClick={() => moveBlock(blockId, -1)}>↑</IconButton>
                      <IconButton label={copy.moveDown} disabled={disabled || index === draft.length - 1} onClick={() => moveBlock(blockId, 1)}>↓</IconButton>
                      <IconButton label={copy.remove} disabled={disabled || draft.length === 1} onClick={() => {
                        const nextId = draft[index - 1]?.id ?? draft[index + 1]?.id;
                        setDraft((previous) => previous.filter(({ id }) => id !== blockId));
                        if (nextId !== undefined) setActiveBlockId(nextId);
                      }}>×</IconButton>
                    </div>
                  </div>
                  {block.type === "text" ? (
                    <RichTextBlock
                      block={block}
                      copy={copy}
                      isEnglish={isEnglish}
                      disabled={disabled}
                      focusOnMount={focusTextId === blockId}
                      update={(next) => updateBlock(blockId, next)}
                    />
                  ) : (
                    <IllustrationBlock block={block} copy={copy} disabled={disabled} update={(next) => updateBlock(blockId, next)} />
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" className={toolClass} disabled={disabled || uploading || maximumBlocksReached} onClick={() => addBlock({ type: "text", font: "default", content: [] }, activeBlockId)}>
              + {copy.insertText}
            </button>
            <button type="button" className={toolClass} disabled={disabled || uploading || maximumBlocksReached || maximumImagesReached} onClick={() => fileInput.current?.click()}>
              + {copy.insertImage}
            </button>
            <span className="text-xs text-[#60756E]">
              {maximumBlocksReached ? copy.blockLimit : maximumImagesReached ? copy.imageLimit : copy.imageHint}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept={CHAT_IMAGE_TYPES.join(",")}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>
        </>
      )}
      {uploading ? <p className="mt-2 text-xs text-[#315B3E]" role="status">{copy.importing}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-[#A02727]" role="alert">{error}</p> : null}
      <p className={`mt-2 text-right text-xs ${bodyLength > bodyMaximum ? "font-bold text-[#A02727]" : "text-[#60756E]"}`}>
        {bodyLength} / {bodyMaximum.toLocaleString(isEnglish ? "en-GB" : "fr-FR")} {copy.limitText}
        {bodyLength < bodyMinimum ? ` · min. ${bodyMinimum}` : ""}
      </p>
    </section>
  );
}

function RichTextBlock({ block, copy, isEnglish, disabled, focusOnMount, update }: {
  block: TextBlock;
  copy: EditorLabels;
  isEnglish: boolean;
  disabled: boolean;
  focusOnMount: boolean;
  update: (value: TextBlock) => void;
}) {
  const editable = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [marks, setMarks] = useState({ bold: false, italic: false });

  function rememberSelection() {
    const root = editable.current;
    const current = document.getSelection();
    if (!root || !current?.rangeCount || !root.contains(current.anchorNode) || !root.contains(current.focusNode)) return;
    selection.current = current.getRangeAt(0).cloneRange();
    setMarks({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic") });
  }

  function syncText() {
    if (editable.current) update({ ...block, content: readEditableText(editable.current) });
    rememberSelection();
  }

  function toggleMark(mark: Mark) {
    const root = editable.current;
    if (!root || disabled) return;
    const lastRange = selection.current;
    root.focus();
    const current = document.getSelection();
    if (lastRange && root.contains(lastRange.startContainer) && root.contains(lastRange.endContainer)) {
      current?.removeAllRanges();
      current?.addRange(lastRange);
    }
    document.execCommand(mark);
    syncText();
  }

  function pasteText(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    syncText();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E1E9E4] px-2 py-1">
        <button type="button" disabled={disabled} className={`${toolClass} font-black aria-pressed:bg-[#DDEFE5]`} aria-label={copy.bold} title={copy.bold} aria-pressed={marks.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleMark("bold")}>B</button>
        <button type="button" disabled={disabled} className={`${toolClass} font-serif italic aria-pressed:bg-[#DDEFE5]`} aria-label={copy.italic} title={copy.italic} aria-pressed={marks.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleMark("italic")}>I</button>
        <label className="ml-1 flex items-center gap-2 text-xs font-bold text-[#315B3E]">
          {copy.font}
          <select
            value={block.font}
            disabled={disabled}
            onChange={(event) => update({ ...block, font: event.target.value as MediaCenterArticleFont })}
            className="max-w-full rounded-lg border border-[#CCDBD3] bg-white px-2 py-1.5 text-xs"
          >
            {Object.entries(MEDIA_CENTER_ARTICLE_FONTS).map(([font, { label }]) => (
              <option key={font} value={font}>{isEnglish ? englishFontLabels[font as MediaCenterArticleFont] : label}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        ref={(node) => {
          if (!node) return;
          if (editable.current === null) {
            for (const run of block.content) {
              const span = document.createElement("span");
              if (run.bold) span.style.fontWeight = "bold";
              if (run.italic) span.style.fontStyle = "italic";
              span.textContent = run.text;
              node.append(span);
            }
            if (focusOnMount) requestAnimationFrame(() => {
              if (node.isConnected) node.focus();
            });
          }
          editable.current = node;
        }}
        contentEditable={!disabled}
        aria-readonly={disabled}
        role="textbox"
        aria-label={copy.text}
        aria-multiline
        tabIndex={0}
        onInput={syncText}
        onFocus={rememberSelection}
        onBlur={rememberSelection}
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={pasteText}
        onDrop={(event) => event.preventDefault()}
        style={block.font === "default" ? undefined : { fontFamily: MEDIA_CENTER_ARTICLE_FONTS[block.font].family }}
        data-placeholder={copy.writingHint}
        data-i18n-skip=""
        className="min-h-28 whitespace-pre-wrap px-3 py-3 font-serif text-base leading-7 text-[#183F37] outline-none focus:ring-2 focus:ring-inset focus:ring-[#83B6A2] empty:before:pointer-events-none empty:before:text-[#60756E] empty:before:content-[attr(data-placeholder)] [overflow-wrap:anywhere]"
      />
    </>
  );
}

function IllustrationBlock({ block, copy, disabled, update }: { block: ImageBlock; copy: EditorLabels; disabled: boolean; update: (value: ImageBlock) => void }) {
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
      <div className="relative min-h-28 overflow-hidden rounded-md bg-[#E5EEE9]">
        <Image src={block.src} alt={block.alt} fill sizes="(max-width: 640px) 90vw, 144px" unoptimized className="object-contain" />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-bold text-[#315B3E]">
          {copy.caption}
          <input value={block.caption ?? ""} disabled={disabled} maxLength={MEDIA_CENTER_MAX_CAPTION_LENGTH} onChange={(event) => update({ ...block, caption: event.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="block text-xs font-bold text-[#315B3E]">
          {copy.alt}
          <input value={block.alt} disabled={disabled} placeholder={copy.altPlaceholder} maxLength={MEDIA_CENTER_MAX_ALT_LENGTH} onChange={(event) => update({ ...block, alt: event.target.value })} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-[#315B3E]">
          {copy.alignment}
          <select value={block.align} disabled={disabled} onChange={(event) => update({ ...block, align: event.target.value as ImageBlock["align"] })} className="rounded-lg border border-[#CCDBD3] bg-white px-2 py-1.5 text-xs">
            {(["left", "center", "right", "wide"] as const).map((alignment) => <option value={alignment} key={alignment}>{copy[alignment]}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function IconButton({ children, label, disabled, onClick }: { children: ReactNode; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className={`${toolClass} min-w-10 text-base`} title={label} aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}

function readEditableText(root: HTMLElement): MediaCenterArticleTextRun[] {
  const runs: MediaCenterArticleTextRun[] = [];
  const blockTags = ["DIV", "P", "LI"];

  function append(text: string, bold: boolean, italic: boolean) {
    if (!text) return;
    const last = runs.at(-1);
    if (last && Boolean(last.bold) === bold && Boolean(last.italic) === italic) {
      last.text += text;
    } else {
      runs.push({ text, ...(bold ? { bold: true } : {}), ...(italic ? { italic: true } : {}) });
    }
  }

  function readChildren(parent: HTMLElement, bold: boolean, italic: boolean) {
    if (blockTags.includes(parent.tagName)
      && parent.childNodes.length === 1 && parent.firstChild instanceof HTMLBRElement) return;
    let previousBlock = false;
    for (const [index, child] of Array.from(parent.childNodes).entries()) {
      const isBlock = child instanceof HTMLElement && blockTags.includes(child.tagName);
      if (index > 0 && (isBlock || previousBlock)) append("\n", false, false);
      previousBlock = isBlock;
      if (child.nodeType === Node.TEXT_NODE) {
        append(child.textContent ?? "", bold, italic);
      } else if (child instanceof HTMLBRElement) {
        append("\n", bold, italic);
      } else if (child instanceof HTMLElement) {
        const weight = child.style.fontWeight;
        const style = child.style.fontStyle;
        const childBold = weight ? weight === "bold" || Number(weight) >= 600 : bold || ["B", "STRONG"].includes(child.tagName);
        const childItalic = style ? style === "italic" : italic || ["I", "EM"].includes(child.tagName);
        readChildren(child, childBold, childItalic);
      }
    }
  }

  readChildren(root, false, false);
  return runs;
}
