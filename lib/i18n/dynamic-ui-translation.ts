const PLACEHOLDER = /\{\{(?:\d+|[A-Za-z]\w*)\}\}|%(?:\d+\$)?[sIL]/g;

export type UiTranslationTemplate = {
  source: string;
  pattern: RegExp;
  target: string;
  placeholders: string[];
  literals: string[];
  specificity: number;
};

export function compileUiTranslationTemplate(source: string, target: string): UiTranslationTemplate | null {
  const matches = [...source.matchAll(PLACEHOLDER)];
  if (!matches.length || matches.length > 8) return null;
  const placeholders = matches.map(match => match[0]);
  const targetSlots = [...target.matchAll(PLACEHOLDER)].map(match => match[0]);
  const requiredSlots = (slots: string[]) => slots.filter(slot => !/^\{\{grammar\d+\}\}$/.test(slot)).sort().join('|');
  if (requiredSlots(placeholders) !== requiredSlots(targetSlots)) return null;
  if (targetSlots.some(slot => !placeholders.includes(slot))) return null;
  const literals: string[] = [];
  let offset = 0;
  for (const match of matches) {
    literals.push(source.slice(offset, match.index));
    offset = match.index! + match[0].length;
  }
  literals.push(source.slice(offset));
  if (literals.slice(1, -1).some(literal => !literal.trim())) return null;
  const specificity = literals.join('').replace(/[^\p{L}]/gu, '').length;
  if (specificity < 8) return null;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${literals.map(escape).join('(.{0,500}?)')}$`, 'u');
  return {source, pattern, target, placeholders, literals: literals.filter(Boolean), specificity};
}

export function applyUiTranslationTemplate(
  template: UiTranslationTemplate,
  value: string,
  translateParameter: (value: string, placeholder: string) => string = value => value,
): string | null {
  if (!template.literals.every(literal => value.includes(literal))) return null;
  const match = template.pattern.exec(value);
  if (!match) return null;
  const namedValues = new Map<string, string>();
  for (const [index, placeholder] of template.placeholders.entries()) {
    // Grammar slots are emitted only for literal French agreement suffixes.
    // Never discard a rider name, a number or an arbitrary captured value.
    if (/^\{\{grammar\d+\}\}$/.test(placeholder) && !/^(?:s|e|es|x)?$/.test(match[index + 1])) return null;
    if (placeholder.startsWith('{{')) {
      const existing = namedValues.get(placeholder);
      if (existing !== undefined && existing !== match[index + 1]) return null;
      namedValues.set(placeholder, match[index + 1]);
    }
  }
  let sqlIndex = 0;
  return template.target.replace(PLACEHOLDER, placeholder => {
    const index = placeholder.startsWith('{{')
      ? template.placeholders.indexOf(placeholder)
      : sqlIndex++;
    return translateParameter(match[index + 1], placeholder);
  });
}
