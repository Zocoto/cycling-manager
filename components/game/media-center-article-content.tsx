import Image from "next/image";
import { Fragment, type ReactNode } from "react";

import {
  MEDIA_CENTER_ARTICLE_FONTS,
  type MediaCenterArticleBlock,
  type MediaCenterArticleTextRun,
} from "@/lib/game/media-center-article";
import { isMediaCenterImageSrc } from "@/lib/game/media-center-images";

const imageAlignment = {
  left: "mr-auto w-full sm:w-3/4",
  center: "mx-auto w-full sm:w-3/4",
  right: "ml-auto w-full sm:w-3/4",
  wide: "w-full",
} as const;

export function MediaCenterArticleContent({
  blocks,
  body = "",
  className = "",
}: {
  blocks?: readonly MediaCenterArticleBlock[] | null;
  body?: string;
  className?: string;
}) {
  if (!blocks?.length) {
    return (
      <p className={`whitespace-pre-line font-serif [overflow-wrap:anywhere] ${className}`}>
        {body}
      </p>
    );
  }

  return (
    <div className={`space-y-4 font-serif [overflow-wrap:anywhere] ${className}`}>
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return (
            <p
              key={index}
              className="whitespace-pre-wrap"
              style={{ fontFamily: MEDIA_CENTER_ARTICLE_FONTS[block.font].family }}
            >
              {block.content.map((run, runIndex) => (
                <Fragment key={runIndex}>{renderRun(run)}</Fragment>
              ))}
            </p>
          );
        }

        if (!isMediaCenterImageSrc(block.src)) return null;

        return (
          <figure key={index} className={imageAlignment[block.align]}>
            <Image
              src={block.src}
              alt={block.alt}
              width={block.width}
              height={block.height}
              unoptimized
              className="block h-auto w-full rounded-sm"
            />
            {block.caption ? (
              <figcaption className="mt-1.5 text-sm italic opacity-75">{block.caption}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

function renderRun({ text, italic, bold }: MediaCenterArticleTextRun): ReactNode {
  const content = italic ? <em>{text}</em> : text;
  return bold ? <strong>{content}</strong> : content;
}
