import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import ts from "typescript";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "lib", "i18n", "generated-fr-en.json");
const SCAN_ROOTS = ["app", "components", "lib"];
const TRANSLATABLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "placeholder",
  "title",
]);
const VISIBLE_PROPERTY_NAMES = new Set([
  "actionLabel",
  "alt",
  "ariaLabel",
  "content",
  "description",
  "emptyLabel",
  "eyebrow",
  "helper",
  "hint",
  "label",
  "message",
  "name",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);
const FRENCH_WORD_MARKERS =
  /\b(?:à|au|aux|baroudeur|bord|ce|ces|cet|cette|classement|classements|contre-la-montre|coureur|coureurs|course|courses|dans|de|des|directeur|du|elle|elles|en|est|et|il|ils|installation|installer|inventaire|jour|jours|la|le|les|leur|leurs|mais|montagne|moyenne|niveau|niveaux|notre|nous|objectif|objectifs|ou|par|parrainage|pas|pavé|pavés|plaine|pour|primaire|primaires|profil|prologue|résultat|résultats|saison|saisons|sans|secondaire|secondaires|ses|son|sont|statistique|statistiques|sur|tableau|tous|toutes|tout|un|une|vallon|vallons|vos|votre|vous|équipe|équipes|afficher|aucun|aucune|connexion|inscription|retour|valider|voir)\b/i;
const FRENCH_ACCENTS = /[àâäçéèêëîïôöùûüÿœæ]/i;
const ENGLISH_MARKERS =
  /\b(?:a|all|and|are|back|dashboard|day|display|edition|equipment|for|from|game|hide|in|is|my|next|of|on|previous|results|rider|season|show|team|the|this|to|training|with|your)\b/i;
const KNOWN_PROPER_NAMES =
  /Cyclo\s*Stratège|Cyclostratège|Cyclogazette|Critérium|Tiramisù|Élite/gi;

const MANUAL_TRANSLATIONS = {
  ACC: "ACC",
  BAR: "FTR",
  CLM: "TT",
  DES: "DH",
  END: "STA",
  MO: "MO",
  MON: "MO",
  MOY: "AVG",
  PAV: "COB",
  PLA: "FL",
  PRO: "PRL",
  REC: "REC",
  RES: "RES",
  SPR: "SP",
  VAL: "HIL",
};

function normalizeText(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&agrave;", "à")
    .replaceAll("&acirc;", "â")
    .replaceAll("&ccedil;", "ç")
    .replaceAll("&eacute;", "é")
    .replaceAll("&egrave;", "è")
    .replaceAll("&ecirc;", "ê")
    .replaceAll("&icirc;", "î")
    .replaceAll("&iuml;", "ï")
    .replaceAll("&ocirc;", "ô")
    .replaceAll("&ugrave;", "ù")
    .replaceAll("&ucirc;", "û")
    .replaceAll("&rsquo;", "’")
    .replaceAll("&laquo;", "«")
    .replaceAll("&raquo;", "»")
    .replaceAll("&middot;", "·")
    .replaceAll("&apos;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function isCandidate(value, visible = false) {
  if (value.length < 2 || value.length > 1_500) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(value)) return false;
  if (/^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/)/i.test(value)) {
    return false;
  }

  const languageSample = value.replace(KNOWN_PROPER_NAMES, " ");
  const hasFrenchWords = FRENCH_WORD_MARKERS.test(languageSample);
  if (ENGLISH_MARKERS.test(languageSample) && !hasFrenchWords) return false;
  if (hasFrenchWords || FRENCH_ACCENTS.test(languageSample)) return true;
  return visible && !ENGLISH_MARKERS.test(languageSample);
}

function collectCandidates() {
  const candidates = new Set(Object.keys(MANUAL_TRANSLATIONS));

  for (const scanRoot of SCAN_ROOTS) {
    walk(path.join(ROOT, scanRoot), (filePath) => {
      if (!/\.(?:ts|tsx)$/.test(filePath)) return;
      if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(filePath)) return;

      const sourceText = fs.readFileSync(filePath, "utf8");
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      visit(sourceFile, candidates);
    });
  }

  return [...candidates].sort((left, right) => left.localeCompare(right, "fr"));
}

function visit(node, candidates) {
  if (ts.isJsxText(node)) {
    addCandidate(candidates, node.text, true);
  } else if (
    ts.isJsxAttribute(node) &&
    node.initializer &&
    ts.isStringLiteral(node.initializer) &&
    TRANSLATABLE_ATTRIBUTES.has(node.name.text)
  ) {
    addCandidate(candidates, node.initializer.text, true);
  } else if (
    ts.isStringLiteralLike(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    const propertyName = getPropertyName(node.parent);
    addCandidate(candidates, node.text, Boolean(propertyName && VISIBLE_PROPERTY_NAMES.has(propertyName)));
  }

  ts.forEachChild(node, (child) => visit(child, candidates));
}

function addCandidate(candidates, rawValue, visible = false) {
  const value = normalizeText(rawValue);
  if (isCandidate(value, visible)) candidates.add(value);
}

function getPropertyName(node) {
  if (!node || !ts.isPropertyAssignment(node)) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function walk(directory, callback) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".next")) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, callback);
    else callback(entryPath);
  }
}

function readCatalog() {
  if (!fs.existsSync(OUTPUT)) return {};
  return JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
}

async function main() {
  const candidates = collectCandidates();
  const catalog = { ...readCatalog(), ...MANUAL_TRANSLATIONS };
  const missing = candidates.filter((candidate) => !catalog[candidate]);

  if (process.argv.includes("--export-candidates")) {
    const candidateOutput = path.join(ROOT, ".codex-tools", "i18n-candidates.json");
    fs.mkdirSync(path.dirname(candidateOutput), { recursive: true });
    fs.writeFileSync(candidateOutput, `${JSON.stringify(candidates, null, 2)}\n`);
    console.log(`Exported ${candidates.length} candidates to ${path.relative(ROOT, candidateOutput)}.`);
    return;
  }

  if (process.argv.includes("--check")) {
    if (missing.length > 0) {
      console.error(`${missing.length} French UI strings are missing from ${path.relative(ROOT, OUTPUT)}.`);
      for (const value of missing.slice(0, 30)) console.error(`- ${value}`);
      process.exitCode = 1;
      return;
    }
    console.log(`${candidates.length} French UI strings are covered by the English catalog.`);
    return;
  }

  console.log(`${candidates.length} candidates; ${missing.length} missing translations.`);
  console.log(
    "Use --export-candidates with scripts/build-i18n-catalog-local.py to update the catalog, or --check to audit it.",
  );
}

await main();
