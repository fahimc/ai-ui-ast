import { encode as encodeO200k } from 'gpt-tokenizer/encoding/o200k_base';
import { encode as encodeCl100k } from 'gpt-tokenizer/encoding/cl100k_base';

/**
 * Token counting with explicitly pinned tokenizer encodings.
 *
 * v0.2 never relies on a tokenizer package's default encoding and never
 * falls back to a chars/4 approximation on the reproducible benchmark path:
 * if the selected encoding cannot be loaded, counting fails loudly.
 *
 * `estimateTokens` is the only approximation and it is clearly named as a
 * UI-only helper — it is never used by `validate:tokens`.
 */

export type TokenizerEncoding = 'o200k_base' | 'cl100k_base';

export const TOKENIZER_ENCODINGS: TokenizerEncoding[] = ['o200k_base', 'cl100k_base'];

export const ENCODING_LABELS: Record<TokenizerEncoding, string> = {
  o200k_base: 'o200k_base (GPT-4o / GPT-4.1 family)',
  cl100k_base: 'cl100k_base (GPT-3.5 / GPT-4 legacy)',
};

const ENCODERS: Record<TokenizerEncoding, (text: string) => number[]> = {
  o200k_base: encodeO200k,
  cl100k_base: encodeCl100k,
};

/** Count tokens with an explicitly selected encoding. Throws on failure. */
export function countTokens(text: string, encoding: TokenizerEncoding = 'o200k_base'): number {
  return ENCODERS[encoding](text).length;
}

/** UI-only rough estimate (chars/4). Never used by the reproducible benchmark. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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

export function compareTokens(auiCode: string, reactCode: string, encoding: TokenizerEncoding = 'o200k_base'): TokenComparison {
  const aui = countTokens(auiCode, encoding);
  const react = countTokens(reactCode, encoding);
  const saved = Math.max(0, react - aui);
  const ratio = react / aui;
  const reductionPct = (1 - aui / react) * 100;
  return { aui, react, saved, ratio, reductionPct };
}

export function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}
