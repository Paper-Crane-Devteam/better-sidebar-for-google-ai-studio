/**
 * Prompt variable support using double curly braces: {{variableName}}
 * Pattern as string so bundlers don't alter regex literals.
 */
const VARIABLE_PATTERN_STR = '\\{\\{([^{}]+)\\}\\}';

/**
 * Extract unique variable names from text. Variables are {{name}}.
 * @returns Sorted unique variable names (order stable for forms)
 */
export function extractPromptVariables(text: string): string[] {
  const s = typeof text === 'string' ? text : '';
  if (!s) return [];
  const set = new Set<string>();
  const re = new RegExp(VARIABLE_PATTERN_STR, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const name = m[1].trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort();
}

/**
 * Check if text contains at least one {{variable}}.
 * Uses same extraction logic as the modal so behavior is consistent.
 */
export function hasPromptVariables(text: string): boolean {
  return extractPromptVariables(text).length > 0;
}

/**
 * Replace {{variable}} placeholders with values. Missing keys are replaced with empty string.
 */
export function substitutePromptVariables(
  text: string,
  values: Record<string, string>
): string {
  const s = typeof text === 'string' ? text : '';
  if (!s) return s;
  const re = new RegExp(VARIABLE_PATTERN_STR, 'g');
  return s.replace(re, (_, name: string) => {
    const key = name.trim();
    return key in values ? String(values[key]) : '';
  });
}
