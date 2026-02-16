/**
 * Prompt variable support:
 *   - Text input:  {{variableName}}
 *   - Dropdown:    {{variableName:option1,option2,option3}}
 *   - Import:      {{@import:PromptTitle}}
 *
 * Pattern captures everything inside {{ }}.
 */
const VARIABLE_PATTERN_STR = '\\{\\{([^{}]+)\\}\\}';

/** Parsed variable descriptor */
export interface PromptVariable {
  /** Raw name (without options). For @import this is the full "@import:Title" */
  raw: string;
  /** Display name shown in the form */
  name: string;
  /** 'input' = free text, 'select' = dropdown, 'import' = reference to another prompt */
  kind: 'input' | 'select' | 'import';
  /** Dropdown options (only when kind === 'select') */
  options?: string[];
  /** Referenced prompt title (only when kind === 'import') */
  importTitle?: string;
}

/**
 * Parse a single raw variable token (the text between {{ and }}).
 */
function parseVariableToken(raw: string): PromptVariable {
  const trimmed = raw.trim();

  // @import:PromptTitle
  if (trimmed.startsWith('@import:')) {
    const title = trimmed.slice('@import:'.length).trim();
    return { raw: trimmed, name: title, kind: 'import', importTitle: title };
  }

  // variableName:opt1,opt2,opt3
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0) {
    const name = trimmed.slice(0, colonIdx).trim();
    const optsPart = trimmed.slice(colonIdx + 1);
    const options = optsPart.split(',').map((o) => o.trim()).filter(Boolean);
    if (options.length > 0) {
      return { raw: trimmed, name, kind: 'select', options };
    }
  }

  // Plain text variable
  return { raw: trimmed, name: trimmed, kind: 'input' };
}

/**
 * Extract all parsed variable descriptors from text.
 * De-duplicated by raw token, preserving first-occurrence order.
 */
export function parsePromptVariables(text: string): PromptVariable[] {
  const s = typeof text === 'string' ? text : '';
  if (!s) return [];
  const seen = new Set<string>();
  const result: PromptVariable[] = [];
  const re = new RegExp(VARIABLE_PATTERN_STR, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const raw = m[1].trim();
    if (raw && !seen.has(raw)) {
      seen.add(raw);
      result.push(parseVariableToken(raw));
    }
  }
  return result;
}

/**
 * Extract unique variable names from text (legacy compat — returns sorted name strings).
 * Now also returns dropdown variable names (without options) and skips @import tokens.
 */
export function extractPromptVariables(text: string): string[] {
  return parsePromptVariables(text)
    .filter((v) => v.kind !== 'import')
    .map((v) => v.name)
    .sort();
}

/**
 * Check if text contains at least one {{variable}} (any kind).
 */
export function hasPromptVariables(text: string): boolean {
  return parsePromptVariables(text).filter((v) => v.kind !== 'import').length > 0;
}

/**
 * Check if text contains at least one {{@import:...}} reference.
 */
export function hasImportReferences(text: string): boolean {
  return parsePromptVariables(text).some((v) => v.kind === 'import');
}

/**
 * Replace {{variable}} / {{variable:opt1,opt2}} placeholders with values.
 * @import tokens are NOT touched here — resolve them first with resolveImports().
 */
export function substitutePromptVariables(
  text: string,
  values: Record<string, string>,
): string {
  const s = typeof text === 'string' ? text : '';
  if (!s) return s;
  const re = new RegExp(VARIABLE_PATTERN_STR, 'g');
  return s.replace(re, (fullMatch, inner: string) => {
    const trimmed = inner.trim();
    // Don't substitute @import tokens here
    if (trimmed.startsWith('@import:')) return fullMatch;
    const parsed = parseVariableToken(trimmed);
    return parsed.name in values ? String(values[parsed.name]) : '';
  });
}

/**
 * Resolve all {{@import:Title}} references by inlining the referenced prompt content.
 * Handles nested imports with cycle detection.
 *
 * @param text       The prompt content to resolve
 * @param getPrompt  Lookup function: title → prompt content (or undefined if not found)
 * @param visited    Set of titles already in the resolution chain (cycle detection)
 */
export function resolveImports(
  text: string,
  getPrompt: (title: string) => string | undefined,
  visited: Set<string> = new Set(),
): string {
  const s = typeof text === 'string' ? text : '';
  if (!s) return s;
  const re = new RegExp(VARIABLE_PATTERN_STR, 'g');
  return s.replace(re, (fullMatch, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed.startsWith('@import:')) return fullMatch;
    const title = trimmed.slice('@import:'.length).trim();
    if (!title) return fullMatch;
    // Cycle detection
    if (visited.has(title)) return `[circular: ${title}]`;
    const content = getPrompt(title);
    if (content == null) return `[not found: ${title}]`;
    // Recursively resolve nested imports
    const nextVisited = new Set(visited);
    nextVisited.add(title);
    return resolveImports(content, getPrompt, nextVisited);
  });
}
