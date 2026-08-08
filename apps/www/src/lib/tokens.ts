import { encode } from 'gpt-tokenizer';

/**
 * Count tokens with the real GPT-4/GPT-3.5 BPE tokenizer.
 * The analysis on the Examples page is only as credible as the count,
 * so we use the actual model tokenizer rather than an approximation.
 */
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch {
    // Fallback: rough char/4 estimate if the tokenizer ever fails to load.
    return Math.ceil(text.length / 4);
  }
}

export interface TokenComparison {
  aui: number;
  react: number;
  /** How many tokens .aui saves over the generated React. */
  saved: number;
  /** React tokens as a multiple of .aui tokens (e.g. 2.4×). */
  ratio: number;
  /** Percentage reduction going from React to .aui. */
  reductionPct: number;
}

export function compareTokens(auiCode: string, reactCode: string): TokenComparison {
  const aui = countTokens(auiCode);
  const react = countTokens(reactCode);
  const saved = Math.max(0, react - aui);
  const ratio = react / aui;
  const reductionPct = (1 - aui / react) * 100;
  return { aui, react, saved, ratio, reductionPct };
}

export function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}
