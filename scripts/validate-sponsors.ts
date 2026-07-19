import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { SPONSORS } from "../data/sponsors";
import type {
  JerseyStyle,
  Sponsor,
} from "../types/sponsor";

const REQUIRED_JERSEY_STYLES = [
  "classic",
  "modern",
  "bold",
] as const satisfies readonly JerseyStyle[];

const SPONSOR_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COUNTRY_CODE_PATTERN =
  /^[A-Z]{2}$/;

const HEX_COLOR_PATTERN =
  /^#[0-9A-F]{6}$/i;

const PNG_SIGNATURE = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]);

type AssetKind = "logo" | "jersey";

type ValidationMessageCollection = {
  errors: string[];
  warnings: string[];
};

type AssetInspectionResult = {
  found: boolean;
};

function isStrictAssetValidation(): boolean {
  return process.argv.includes(
    "--strict-assets"
  );
}

function addError(
  messages: ValidationMessageCollection,
  message: string
): void {
  messages.errors.push(message);
}

function addWarning(
  messages: ValidationMessageCollection,
  message: string
): void {
  messages.warnings.push(message);
}

function normalizeComparableText(
  value: string
): string {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function validateRequiredText({
  sponsor,
  fieldName,
  value,
  messages,
}: {
  sponsor: Sponsor;
  fieldName: string;
  value: string;
  messages: ValidationMessageCollection;
}): void {
  if (!value.trim()) {
    addError(
      messages,
      `${sponsor.id} : le champ "${fieldName}" est vide.`
    );

    return;
  }

  if (value !== value.trim()) {
    addWarning(
      messages,
      `${sponsor.id} : le champ "${fieldName}" contient des espaces inutiles au début ou à la fin.`
    );
  }
}

function validateInteger({
  sponsor,
  fieldName,
  value,
  minimum,
  maximum,
  messages,
}: {
  sponsor: Sponsor;
  fieldName: string;
  value: number;
  minimum: number;
  maximum?: number;
  messages: ValidationMessageCollection;
}): void {
  if (!Number.isInteger(value)) {
    addError(
      messages,
      `${sponsor.id} : "${fieldName}" doit être un nombre entier.`
    );

    return;
  }

  if (value < minimum) {
    addError(
      messages,
      `${sponsor.id} : "${fieldName}" doit être supérieur ou égal à ${minimum}.`
    );
  }

  if (
    maximum !== undefined &&
    value > maximum
  ) {
    addError(
      messages,
      `${sponsor.id} : "${fieldName}" doit être inférieur ou égal à ${maximum}.`
    );
  }
}

function validateSponsorMetadata({
  sponsor,
  messages,
  encounteredSponsorIds,
  encounteredSponsorNames,
  encounteredJerseyIds,
  encounteredAssetPaths,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
  encounteredSponsorIds: Set<string>;
  encounteredSponsorNames: Set<string>;
  encounteredJerseyIds: Set<string>;
  encounteredAssetPaths: Set<string>;
}): void {
  validateRequiredText({
    sponsor,
    fieldName: "id",
    value: sponsor.id,
    messages,
  });

  validateRequiredText({
    sponsor,
    fieldName: "name",
    value: sponsor.name,
    messages,
  });

  validateRequiredText({
    sponsor,
    fieldName: "shortName",
    value: sponsor.shortName,
    messages,
  });

  validateRequiredText({
    sponsor,
    fieldName: "sector",
    value: sponsor.sector,
    messages,
  });

  validateRequiredText({
    sponsor,
    fieldName: "description",
    value: sponsor.description,
    messages,
  });

  if (
    !SPONSOR_ID_PATTERN.test(sponsor.id)
  ) {
    addError(
      messages,
      `${sponsor.id} : l’identifiant doit être en minuscules, sans accent et au format kebab-case.`
    );
  }

  if (
    encounteredSponsorIds.has(sponsor.id)
  ) {
    addError(
      messages,
      `${sponsor.id} : cet identifiant est utilisé plusieurs fois.`
    );
  } else {
    encounteredSponsorIds.add(sponsor.id);
  }

  const normalizedSponsorName =
    normalizeComparableText(sponsor.name);

  if (
    encounteredSponsorNames.has(
      normalizedSponsorName
    )
  ) {
    addError(
      messages,
      `${sponsor.id} : le nom "${sponsor.name}" est déjà utilisé par un autre sponsor.`
    );
  } else {
    encounteredSponsorNames.add(
      normalizedSponsorName
    );
  }

  if (
    !COUNTRY_CODE_PATTERN.test(
      sponsor.countryCode
    )
  ) {
    addError(
      messages,
      `${sponsor.id} : countryCode doit contenir exactement deux lettres majuscules.`
    );
  }

  if (sponsor.shortName.length > 24) {
    addWarning(
      messages,
      `${sponsor.id} : shortName dépasse 24 caractères et risque d’être tronqué dans certaines tuiles.`
    );
  }

  if (
    sponsor.description.trim().length < 40
  ) {
    addWarning(
      messages,
      `${sponsor.id} : la description contient moins de 40 caractères.`
    );
  }

  validateInteger({
    sponsor,
    fieldName: "prestige",
    value: sponsor.prestige,
    minimum: 1,
    maximum: 5,
    messages,
  });

  validateInteger({
    sponsor,
    fieldName: "minimumReputation",
    value: sponsor.minimumReputation,
    minimum: 0,
    messages,
  });

  validateBudgetRange({
    sponsor,
    messages,
  });

  validateContractDurationRange({
    sponsor,
    messages,
  });

  validateSponsorLogo({
    sponsor,
    messages,
    encounteredAssetPaths,
  });

  validateSponsorJerseys({
    sponsor,
    messages,
    encounteredJerseyIds,
    encounteredAssetPaths,
  });

  validateSponsorColors({
    sponsor,
    messages,
  });
}

function validateBudgetRange({
  sponsor,
  messages,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
}): void {
  const { min, max } =
    sponsor.budgetRange;

  if (
    !Number.isInteger(min) ||
    min <= 0
  ) {
    addError(
      messages,
      `${sponsor.id} : budgetRange.min doit être un entier strictement positif.`
    );
  }

  if (
    !Number.isInteger(max) ||
    max <= 0
  ) {
    addError(
      messages,
      `${sponsor.id} : budgetRange.max doit être un entier strictement positif.`
    );
  }

  if (max < min) {
    addError(
      messages,
      `${sponsor.id} : budgetRange.max ne peut pas être inférieur à budgetRange.min.`
    );
  }
}

function validateContractDurationRange({
  sponsor,
  messages,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
}): void {
  const { min, max } =
    sponsor.contractDurationRange;

  validateInteger({
    sponsor,
    fieldName:
      "contractDurationRange.min",
    value: min,
    minimum: 1,
    messages,
  });

  validateInteger({
    sponsor,
    fieldName:
      "contractDurationRange.max",
    value: max,
    minimum: 1,
    messages,
  });

  if (max < min) {
    addError(
      messages,
      `${sponsor.id} : contractDurationRange.max ne peut pas être inférieur à contractDurationRange.min.`
    );
  }

  if (max > 3) {
    addWarning(
      messages,
      `${sponsor.id} : la durée maximale dépasse les 3 saisons actuellement prévues pour le MVP.`
    );
  }
}

function validateSponsorLogo({
  sponsor,
  messages,
  encounteredAssetPaths,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
  encounteredAssetPaths: Set<string>;
}): void {
  const expectedLogoPath =
    `/images/sponsors/${sponsor.id}/logo.png`;

  if (
    sponsor.logoPath !== expectedLogoPath
  ) {
    addError(
      messages,
      `${sponsor.id} : logoPath doit être "${expectedLogoPath}".`
    );
  }

  registerAssetPath({
    sponsor,
    assetPath: sponsor.logoPath,
    messages,
    encounteredAssetPaths,
  });
}

function validateSponsorJerseys({
  sponsor,
  messages,
  encounteredJerseyIds,
  encounteredAssetPaths,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
  encounteredJerseyIds: Set<string>;
  encounteredAssetPaths: Set<string>;
}): void {
  if (sponsor.jerseys.length !== 3) {
    addError(
      messages,
      `${sponsor.id} : exactement trois maillots sont obligatoires.`
    );
  }

  const encounteredStyles =
    new Set<JerseyStyle>();

  for (const jersey of sponsor.jerseys) {
    validateRequiredText({
      sponsor,
      fieldName: `jersey.${jersey.style}.name`,
      value: jersey.name,
      messages,
    });

    if (
      !REQUIRED_JERSEY_STYLES.includes(
        jersey.style
      )
    ) {
      addError(
        messages,
        `${sponsor.id} : le style "${jersey.style}" est invalide.`
      );

      continue;
    }

    if (
      encounteredStyles.has(jersey.style)
    ) {
      addError(
        messages,
        `${sponsor.id} : le style "${jersey.style}" est déclaré plusieurs fois.`
      );
    } else {
      encounteredStyles.add(
        jersey.style
      );
    }

    const expectedJerseyId =
      `${sponsor.id}-${jersey.style}`;

    if (jersey.id !== expectedJerseyId) {
      addError(
        messages,
        `${sponsor.id} : l’identifiant du maillot ${jersey.style} doit être "${expectedJerseyId}".`
      );
    }

    if (
      encounteredJerseyIds.has(jersey.id)
    ) {
      addError(
        messages,
        `${sponsor.id} : l’identifiant de maillot "${jersey.id}" est utilisé plusieurs fois dans le catalogue.`
      );
    } else {
      encounteredJerseyIds.add(
        jersey.id
      );
    }

    const expectedImagePath =
      `/images/sponsors/${sponsor.id}/jersey-${jersey.style}.png`;

    if (
      jersey.imagePath !==
      expectedImagePath
    ) {
      addError(
        messages,
        `${sponsor.id} : imagePath du maillot ${jersey.style} doit être "${expectedImagePath}".`
      );
    }

    registerAssetPath({
      sponsor,
      assetPath: jersey.imagePath,
      messages,
      encounteredAssetPaths,
    });
  }

  for (
    const requiredStyle of
    REQUIRED_JERSEY_STYLES
  ) {
    if (
      !encounteredStyles.has(
        requiredStyle
      )
    ) {
      addError(
        messages,
        `${sponsor.id} : le maillot "${requiredStyle}" est absent.`
      );
    }
  }
}

function registerAssetPath({
  sponsor,
  assetPath,
  messages,
  encounteredAssetPaths,
}: {
  sponsor: Sponsor;
  assetPath: string;
  messages: ValidationMessageCollection;
  encounteredAssetPaths: Set<string>;
}): void {
  if (
    encounteredAssetPaths.has(assetPath)
  ) {
    addError(
      messages,
      `${sponsor.id} : le chemin "${assetPath}" est partagé par plusieurs assets.`
    );

    return;
  }

  encounteredAssetPaths.add(assetPath);
}

function validateSponsorColors({
  sponsor,
  messages,
}: {
  sponsor: Sponsor;
  messages: ValidationMessageCollection;
}): void {
  const colorFields = [
    "primary",
    "secondary",
    "accent",
    "background",
    "text",
  ] as const;

  for (const field of colorFields) {
    const value = sponsor.colors[field];

    if (!HEX_COLOR_PATTERN.test(value)) {
      addError(
        messages,
        `${sponsor.id} : colors.${field} doit être une couleur hexadécimale au format #RRGGBB.`
      );
    }
  }

  if (
    HEX_COLOR_PATTERN.test(
      sponsor.colors.background
    ) &&
    HEX_COLOR_PATTERN.test(
      sponsor.colors.text
    )
  ) {
    const contrastRatio =
      getContrastRatio(
        sponsor.colors.background,
        sponsor.colors.text
      );

    if (contrastRatio < 4.5) {
      addWarning(
        messages,
        `${sponsor.id} : le contraste texte/fond est faible (${contrastRatio.toFixed(
          2
        )}:1). La cible recommandée est 4.5:1.`
      );
    }
  }
}

function getContrastRatio(
  firstColor: string,
  secondColor: string
): number {
  const firstLuminance =
    getRelativeLuminance(firstColor);

  const secondLuminance =
    getRelativeLuminance(secondColor);

  const lighter = Math.max(
    firstLuminance,
    secondLuminance
  );

  const darker = Math.min(
    firstLuminance,
    secondLuminance
  );

  return (
    (lighter + 0.05) /
    (darker + 0.05)
  );
}

function getRelativeLuminance(
  color: string
): number {
  const red = Number.parseInt(
    color.slice(1, 3),
    16
  );

  const green = Number.parseInt(
    color.slice(3, 5),
    16
  );

  const blue = Number.parseInt(
    color.slice(5, 7),
    16
  );

  const normalizedValues = [
    red,
    green,
    blue,
  ].map((value) => {
    const normalized = value / 255;

    if (normalized <= 0.03928) {
      return normalized / 12.92;
    }

    return Math.pow(
      (normalized + 0.055) / 1.055,
      2.4
    );
  });

  return (
    normalizedValues[0] * 0.2126 +
    normalizedValues[1] * 0.7152 +
    normalizedValues[2] * 0.0722
  );
}

function getExpectedAssets(
  sponsor: Sponsor
): Array<{
  publicPath: string;
  kind: AssetKind;
}> {
  return [
    {
      publicPath:
        `/images/sponsors/${sponsor.id}/logo.png`,
      kind: "logo",
    },
    ...REQUIRED_JERSEY_STYLES.map(
      (style) => ({
        publicPath:
          `/images/sponsors/${sponsor.id}/jersey-${style}.png`,
        kind: "jersey" as const,
      })
    ),
  ];
}

async function inspectPngAsset({
  sponsor,
  publicPath,
  kind,
  strictAssets,
  messages,
}: {
  sponsor: Sponsor;
  publicPath: string;
  kind: AssetKind;
  strictAssets: boolean;
  messages: ValidationMessageCollection;
}): Promise<AssetInspectionResult> {
  const relativePublicPath =
    publicPath.replace(/^\/+/, "");

  const absolutePath = path.join(
    process.cwd(),
    "public",
    relativePublicPath
  );

  let assetStat;

  try {
    assetStat = await stat(absolutePath);
  } catch {
    const message =
      `${sponsor.id} : asset manquant "${publicPath}".`;

    if (strictAssets) {
      addError(messages, message);
    } else {
      addWarning(messages, message);
    }

    return {
      found: false,
    };
  }

  if (!assetStat.isFile()) {
    addError(
      messages,
      `${sponsor.id} : "${publicPath}" existe mais n’est pas un fichier.`
    );

    return {
      found: false,
    };
  }

  const buffer = await readFile(
    absolutePath
  );

  if (
    buffer.length < 26 ||
    !buffer
      .subarray(0, 8)
      .equals(PNG_SIGNATURE)
  ) {
    addError(
      messages,
      `${sponsor.id} : "${publicPath}" n’est pas un fichier PNG valide.`
    );

    return {
      found: true,
    };
  }

  const width =
    buffer.readUInt32BE(16);

  const height =
    buffer.readUInt32BE(20);

  const colorType = buffer[25];

  const hasAlphaChannel =
    colorType === 4 ||
    colorType === 6 ||
    pngContainsChunk(buffer, "tRNS");

  if (!hasAlphaChannel) {
    addWarning(
      messages,
      `${sponsor.id} : "${publicPath}" ne semble pas contenir de transparence. Un fond blanc peut apparaître dans l’interface.`
    );
  }

  if (assetStat.size > 1_500_000) {
    addWarning(
      messages,
      `${sponsor.id} : "${publicPath}" dépasse 1,5 Mo (${formatFileSize(
        assetStat.size
      )}).`
    );
  }

  if (kind === "logo") {
    if (width !== height) {
      addWarning(
        messages,
        `${sponsor.id} : le logo "${publicPath}" n’est pas carré (${width} × ${height}).`
      );
    }

    if (width < 256 || height < 256) {
      addWarning(
        messages,
        `${sponsor.id} : le logo "${publicPath}" est inférieur à 256 × 256 px.`
      );
    }
  }

  if (kind === "jersey") {
    if (width >= height) {
      addWarning(
        messages,
        `${sponsor.id} : le maillot "${publicPath}" n’est pas au format portrait (${width} × ${height}).`
      );
    }

    if (width < 400 || height < 500) {
      addWarning(
        messages,
        `${sponsor.id} : le maillot "${publicPath}" est inférieur au format conseillé de 400 × 500 px.`
      );
    }
  }

  return {
    found: true,
  };
}

function pngContainsChunk(
  buffer: Buffer,
  searchedChunkType: string
): boolean {
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const chunkLength =
      buffer.readUInt32BE(offset);

    const chunkType = buffer.toString(
      "ascii",
      offset + 4,
      offset + 8
    );

    if (
      chunkType === searchedChunkType
    ) {
      return true;
    }

    const nextOffset =
      offset + 12 + chunkLength;

    if (
      nextOffset <= offset ||
      nextOffset > buffer.length
    ) {
      return false;
    }

    if (chunkType === "IEND") {
      return false;
    }

    offset = nextOffset;
  }

  return false;
}

function formatFileSize(
  value: number
): string {
  const megabytes =
    value / 1_000_000;

  return `${megabytes.toFixed(2)} Mo`;
}

async function validateCatalog(): Promise<void> {
  const messages:
    ValidationMessageCollection = {
      errors: [],
      warnings: [],
    };

  const strictAssets =
    isStrictAssetValidation();

  const encounteredSponsorIds =
    new Set<string>();

  const encounteredSponsorNames =
    new Set<string>();

  const encounteredJerseyIds =
    new Set<string>();

  const encounteredAssetPaths =
    new Set<string>();

  for (const sponsor of SPONSORS) {
    validateSponsorMetadata({
      sponsor,
      messages,
      encounteredSponsorIds,
      encounteredSponsorNames,
      encounteredJerseyIds,
      encounteredAssetPaths,
    });
  }

  const assetInspections =
    await Promise.all(
      SPONSORS.flatMap((sponsor) =>
        getExpectedAssets(sponsor).map(
          (asset) =>
            inspectPngAsset({
              sponsor,
              publicPath:
                asset.publicPath,
              kind: asset.kind,
              strictAssets,
              messages,
            })
        )
      )
    );

  const foundAssetCount =
    assetInspections.filter(
      (inspection) => inspection.found
    ).length;

  const expectedAssetCount =
    SPONSORS.length * 4;

  console.log("");
  console.log(
    "Validation du catalogue sponsors"
  );
  console.log(
    `${SPONSORS.length} sponsor(s) analysé(s).`
  );
  console.log(
    `${foundAssetCount}/${expectedAssetCount} asset(s) présent(s).`
  );
  console.log(
    strictAssets
      ? "Mode assets : strict."
      : "Mode assets : avertissement."
  );

  if (messages.warnings.length > 0) {
    console.log("");
    console.warn(
      `${messages.warnings.length} avertissement(s) :`
    );

    for (
      const warning of messages.warnings
    ) {
      console.warn(`- ${warning}`);
    }
  }

  if (messages.errors.length > 0) {
    console.log("");
    console.error(
      `${messages.errors.length} erreur(s) :`
    );

    for (
      const error of messages.errors
    ) {
      console.error(`- ${error}`);
    }

    throw new Error(
      "Le catalogue sponsors est invalide."
    );
  }

  console.log("");
  console.log(
    "Catalogue sponsors valide."
  );
}

async function main(): Promise<void> {
  try {
    await validateCatalog();
  } catch (error) {
    console.log("");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
}

void main();
