"use client";

import Image from "next/image";
import { useState } from "react";

type SponsorLogoProps = {
  src: string;
  alt: string;
  sponsorName: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

export function SponsorLogo(
  props: SponsorLogoProps
) {
  return (
    <SponsorLogoImage
      key={props.src}
      {...props}
    />
  );
}

function SponsorLogoImage({
  src,
  alt,
  sponsorName,
  primaryColor,
  backgroundColor,
  textColor,
}: SponsorLogoProps) {
  const [hasImageError, setHasImageError] =
    useState(false);

  if (hasImageError) {
    return (
      <SponsorLogoFallback
        alt={alt}
        sponsorName={sponsorName}
        primaryColor={primaryColor}
        backgroundColor={backgroundColor}
        textColor={textColor}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={420}
      height={180}
      unoptimized
      className="max-h-28 w-auto max-w-full object-contain"
      onError={() => {
        setHasImageError(true);
      }}
    />
  );
}

function SponsorLogoFallback({
  alt,
  sponsorName,
  primaryColor,
  backgroundColor,
  textColor,
}: Omit<SponsorLogoProps, "src">) {
  const initials =
    getSponsorInitials(sponsorName);

  return (
    <div
      role="img"
      aria-label={alt}
      className="flex max-w-full items-center gap-4"
    >
      <span
        className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-2xl font-black shadow-sm"
        style={{
          borderColor: `${primaryColor}55`,
          backgroundColor,
          color: textColor,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute -bottom-8 -right-8 h-20 w-20 rotate-45 rounded-xl opacity-20"
          style={{
            backgroundColor: primaryColor,
          }}
        />

        <span className="relative">
          {initials}
        </span>
      </span>

      <span className="min-w-0">
        <span
          className="block truncate text-2xl font-black tracking-[-0.03em]"
          style={{
            color: textColor,
          }}
        >
          {sponsorName}
        </span>

        <span
          className="mt-1 block text-xs font-extrabold uppercase tracking-[0.18em]"
          style={{
            color: primaryColor,
          }}
        >
          Partenaire cycliste
        </span>
      </span>
    </div>
  );
}

function getSponsorInitials(
  sponsorName: string
): string {
  const initials = sponsorName
    .trim()
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  return initials || "SP";
}