import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "lib", "i18n", "generated-fr-en.json");
const SCAN_ROOTS = ["app", "components", "lib", "services"];
const TRANSLATABLE_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-valuetext",
  "placeholder",
  "title",
]);
const TECHNICAL_JSX_ATTRIBUTES = new Set(["className", "href", "src", "id", "key", "style", "name", "type", "value"]);
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
const candidateLocations = new Map();
let currentSourceFile = "";

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
  if (/^(?:https?:|mailto:|tel:|@\/|\/|\.\/|\.\.\/|\?[\w-]+=|#[\w-])/i.test(value) || /<\/?[a-z][^>]*>/i.test(value)) {
    return false;
  }

  const languageSample = value.replace(KNOWN_PROPER_NAMES, " ");
  if (!/[A-Za-zÀ-ÿ]/.test(languageSample)) return false;
  const hasFrenchWords = FRENCH_WORD_MARKERS.test(languageSample);
  if (ENGLISH_MARKERS.test(languageSample) && !FRENCH_ACCENTS.test(languageSample) &&
      !/\b(?:coureurs?|votre|vous|aucun|aucune|choisir|afficher|inscrire|consulter|les|des|une|pour|avec|sur|dans|du|vos)\b/i.test(languageSample)) return false;
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
      if (filePath.startsWith(path.join(ROOT, "lib", "i18n") + path.sep)) return;

      const sourceText = fs.readFileSync(filePath, "utf8");
      currentSourceFile = path.relative(ROOT, filePath).replaceAll(path.sep, "/");
      for (const candidate of extractUiStrings(sourceText, filePath)) candidates.add(candidate);
    });
  }

  walk(path.join(ROOT, "supabase/migrations"), (filePath) => {
    if (!filePath.endsWith(".sql")) return;
    currentSourceFile = path.relative(ROOT, filePath).replaceAll(path.sep, "/");
    const source = fs.readFileSync(filePath, "utf8");
    // Player-facing RPC exceptions only, never arbitrary SQL literals or data.
    for (const match of source.matchAll(/(?:raise\s+exception\s+|message\s*=\s*(?:format\s*\(\s*)?)'((?:''|[^'])*)'/gi)) {
      const message = match[1].replaceAll("''", "'");
      addCandidate(candidates, message);
      if (/^raise/i.test(match[0])) {
        let index = 0;
        addCandidate(candidates, message.replace(/%%|%/g, token => token === '%%' ? '%' : `{{${index++}}}`));
      }
    }
  });

  return [...candidates].sort((left, right) => left.localeCompare(right, "fr"));
}

export function extractUiStrings(sourceText, filePath = "fixture.tsx") {
  const candidates = new Set();
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  visit(sourceFile, candidates);
  return candidates;
}

function visit(node, candidates, visibleAncestor = false) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
  // Custom component props often contain whole visible lists/cards. Only skip
  // known technical props, not every non-standard HTML attribute.
  if (ts.isJsxAttribute(node) && TECHNICAL_JSX_ATTRIBUTES.has(node.name.text)) return;
  const visible = visibleAncestor || (ts.isJsxAttribute(node) &&
    (VISIBLE_PROPERTY_NAMES.has(node.name.text) || ["items", "rows", "cards", "steps", "options"].includes(node.name.text)));
  if (ts.isTemplateExpression(node)) {
    const fullTemplate = node.head.text + node.templateSpans.map((span, index) =>
      `{{${isGrammarSuffix(span.expression) ? "grammar" : ""}${index}}}${span.literal.text}`).join("");
    addCandidate(candidates, fullTemplate);
  }
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
    addCandidate(candidates, node.text, visible || Boolean(propertyName && VISIBLE_PROPERTY_NAMES.has(propertyName)));
  }

  ts.forEachChild(node, (child) => visit(child, candidates, visible));
}

function isGrammarSuffix(expression) {
  if (ts.isParenthesizedExpression(expression)) return isGrammarSuffix(expression.expression);
  if (!ts.isConditionalExpression(expression)) return false;
  return [expression.whenTrue, expression.whenFalse].every(branch =>
    ts.isStringLiteralLike(branch) && /^(?:s|e|es|x)?$/.test(branch.text));
}

function addCandidate(candidates, rawValue, visible = false) {
  const value = normalizeText(rawValue);
  if (isCandidate(value, visible)) {
    candidates.add(value);
    const locations = candidateLocations.get(value) ?? new Set();
    locations.add(currentSourceFile);
    candidateLocations.set(value, locations);
  }
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
  const reviewedPath = path.join(ROOT, "lib/i18n/reviewed-fr-en.json");
  if (fs.existsSync(reviewedPath)) Object.assign(catalog, JSON.parse(fs.readFileSync(reviewedPath, "utf8")));
  const missing = candidates.filter((candidate) => !catalog[candidate]);

  if (process.argv.includes("--export-candidates")) {
    const candidateOutput = path.join(ROOT, ".codex-tools", "i18n-candidates.json");
    fs.mkdirSync(path.dirname(candidateOutput), { recursive: true });
    fs.writeFileSync(candidateOutput, `${JSON.stringify(candidates, null, 2)}\n`);
    fs.writeFileSync(path.join(ROOT, ".codex-tools/i18n-locations.json"), JSON.stringify(Object.fromEntries(
      [...candidateLocations].map(([key, locations]) => [key, [...locations]])), null, 2));
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
    const invalidTemplates = candidates.filter(source => {
      // Only AST-verified grammatical suffixes may disappear in English.
      const slots = text => text.match(/\{\{(?:\d+|[A-Za-z]\w*)\}\}|%(?:\d+\$)?[sIL]/g) ?? [];
      const required = text => slots(text).filter(slot => !/^\{\{grammar\d+\}\}$/.test(slot)).sort().join("|");
      const target = catalog[source] ?? "";
      return required(source) !== required(target) || slots(target).some(slot => !slots(source).includes(slot));
    });
    if (invalidTemplates.length) {
      console.error(`${invalidTemplates.length} translations do not preserve their dynamic placeholders.`);
      for (const source of invalidTemplates.slice(0, 12)) console.error(`- ${source}`);
      process.exitCode = 1;
    }
    return;
  }

  console.log(`${candidates.length} candidates; ${missing.length} missing translations.`);
  console.log(
    "Use --export-candidates with scripts/build-i18n-catalog-local.py to update the catalog, or --check to audit it.",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
