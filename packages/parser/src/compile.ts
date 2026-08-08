import type { CanonicalDocument, RawDocument } from './ast.ts';
import type { Diagnostic } from './diagnostics.ts';
import { hasErrors } from './diagnostics.ts';
import { normalize, type NormalizeOptions } from './normalize.ts';
import { parse } from './parser.ts';
import { compileReact, type CompileOptions as ReactCompileOptions } from './react.ts';
import { CORE_REGISTRY } from './registry.ts';
import type { Registry } from './registry.ts';
import { validate, type ResourceLimits, type ValidateOptions } from './validate.ts';

export interface CompileOptions extends ReactCompileOptions {
  /** Compiler target. Only 'react' is implemented in v0.2. */
  target?: 'react';
  /** Component registry (defaults to CORE_REGISTRY). */
  registry?: Registry;
  /**
   * When true, compilation refuses to emit code if any error-level
   * diagnostic exists. Default false (lenient: code is emitted with
   * diagnostics for inspection).
   */
  strict?: boolean;
  /** Import policy — see ValidateOptions. Defaults to registry-only. */
  imports?: ValidateOptions['imports'];
  /** Indentation mode — 'strict' (default) or 'llm'. */
  indentMode?: 'strict' | 'llm';
  /** Indentation width for strict mode. Default 2. */
  indentWidth?: number;
  /** Resource limits for untrusted input. */
  limits?: Partial<ResourceLimits>;
}

export interface CompileResult {
  /** Generated target code (present unless strict compilation failed). */
  code?: string;
  /** The raw syntax tree. */
  rawAst: RawDocument;
  /** The canonical IR (present when normalization succeeded). */
  ast?: CanonicalDocument;
  diagnostics: Diagnostic[];
  ok: boolean;
}

/**
 * High-level pipeline: parse → validate → normalize → compile.
 *
 * Consumers should not need to sequence the low-level calls themselves:
 *
 *   const result = compile(source, { target: 'react', registry, strict: true })
 *   if (!result.ok) console.error(formatDiagnostics(result.diagnostics))
 *   else console.log(result.code)
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const registry = options.registry ?? CORE_REGISTRY;
  const strict = options.strict ?? false;
  const diagnostics: Diagnostic[] = [];

  const rawAst = parse(source);
  const validationDiags = validate(source, {
    registry,
    imports: options.imports,
    indentMode: options.indentMode,
    indentWidth: options.indentWidth,
    limits: options.limits,
  } satisfies ValidateOptions);
  diagnostics.push(...validationDiags);

  const fail = () => ({ code: undefined, rawAst, diagnostics, ok: false });

  if (strict && hasErrors(diagnostics)) {
    return fail();
  }

  const normalized = normalize(rawAst, {
    registry,
    maxDepth: options.limits?.maxDepth,
    maxNodes: options.limits?.maxNodes,
  } satisfies NormalizeOptions);

  if (!normalized.value) {
    diagnostics.push(...normalized.diagnostics);
    return fail();
  }
  diagnostics.push(...normalized.diagnostics);

  if (strict && hasErrors(diagnostics)) {
    return fail();
  }

  const code = compileReact(normalized.value, { componentName: options.componentName, registry });
  return { code, rawAst, ast: normalized.value, diagnostics, ok: !hasErrors(diagnostics) };
}
