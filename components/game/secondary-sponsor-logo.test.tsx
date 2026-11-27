import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { SecondarySponsorIdentity } from "@/lib/game/secondary-sponsor";
import { SecondarySponsorLogo } from "./secondary-sponsor-logo";
import { getSecondarySponsorLogoBackgroundColor } from "@/lib/game/secondary-sponsor-logo-backgrounds";

const sponsor: SecondarySponsorIdentity = {
  id: "contrast", name: "Colombia partenaire", countryCode: "CO", countryName: "Colombie",
  prestige: 3, primaryColor: "#123456", accentColor: "#FEDCBA", logoVariant: "badge",
};

describe("secondary sponsor logo contrast variants", () => {
  it.each(["black", "white"] as const)("keeps the opaque card transparent and its real mark visible in %s", async colorMode => {
    const bitmap = await sharp(Buffer.from([253, 244, 229, 30, 80, 160]), { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
    const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{ ...sponsor,
      logoPath: `data:image/png;base64,${bitmap.toString("base64")}`, logoBackgroundColor: "#fdf4e5",
    }} colorMode={colorMode} />);
    const { data, info } = await sharp(Buffer.from(html)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const backgroundOffset = (Math.floor(info.height / 2) * info.width + 50) * info.channels;
    const markOffset = (Math.floor(info.height / 2) * info.width + 190) * info.channels;
    expect(data[backgroundOffset + 3]).toBe(0);
    expect(data[markOffset + 3]).toBe(255);
    expect([...data.subarray(markOffset, markOffset + 3)]).toEqual(colorMode === "black" ? [17, 17, 17] : [255, 255, 255]);
  });
  it.each(["veloria-bank", "terroirs-unis"])("removes the opaque %s card background in monochrome instead of painting a rectangle", key => {
    const logoPath = `/images/sponsors/${key}/logo.webp`;
    const logoBackgroundColor = getSecondarySponsorLogoBackgroundColor(logoPath);
    expect(logoBackgroundColor).toMatch(/^#[a-f0-9]{6}$/);
    for (const colorMode of ["black", "white"] as const) {
      const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{ ...sponsor, id: key, logoPath, logoBackgroundColor }} colorMode={colorMode} />);
      expect(html).toContain(`href="${logoPath}"`);
      expect(html).toContain('color-interpolation-filters="sRGB"');
      expect(html).toContain('in2="SourceAlpha"');
      expect(html).toContain('result="backgroundMask"');
      expect(html).toContain(`flood-color="${colorMode === "black" ? "#111111" : "#FFFFFF"}"`);
      expect(html).not.toContain("brightness(0)");
    }
    const original = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{ ...sponsor, logoPath, logoBackgroundColor }} />);
    expect(original).toContain(`src="${logoPath}"`);
    expect(original).not.toContain("<filter");
  });
  it("uses the existing library asset in all color modes instead of inventing another brand mark", () => {
    for (const colorMode of ["original", "black", "white"] as const) {
      const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{...sponsor, name: "Ardennes Outillage", logoPath: "/images/sponsors/ardennes-outillage/logo.webp"}} colorMode={colorMode} />);
      expect(html).toContain('src="/images/sponsors/ardennes-outillage/logo.webp"');
      expect(html).toContain('alt="Logo de Ardennes Outillage"');
      expect(html).not.toContain("<svg");
      expect(html).not.toContain("/_next/image");
      if (colorMode === "black") expect(html).toContain("brightness(0)");
      if (colorMode === "white") expect(html).toContain("invert(1)");
    }
  });
  it.each(["badge", "monogram", "orbit", "stripe", "wordmark"] as const)("recolors the complete %s mark and lettering in both contrast variants", logoVariant => {
    for (const colorMode of ["black", "white"] as const) {
      const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{ ...sponsor, logoVariant }} colorMode={colorMode} />);
      expect(html).toContain(`data-secondary-logo-color="${colorMode}"`);
      expect(html).toMatch(/(?:fill|stroke)="#111111"/);
      expect(html).toMatch(/(?:fill|stroke)="#FFFFFF"/);
      expect(html).not.toContain(sponsor.primaryColor);
      expect(html).not.toContain(sponsor.accentColor);
      expect(html).toContain("COLOMBIA PARTENAIRE");
    }
  });

  it("preserves the existing brand appearance when no mode is selected", () => {
    const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={sponsor} />);
    expect(html).toContain(sponsor.primaryColor);
    expect(html).toContain(sponsor.accentColor);
    expect(html).toContain('data-secondary-logo-color="original"');
  });
});
