# Build Plan

This document outlines the phased implementation for the AI UI AST language, parser, compiler, and supporting ecosystem.

## Phase 1: Core Parsing and AST Validation

**Goal**: Parse `.aui` syntax into a validated, in-memory Abstract Syntax Tree.

- Implement an indentation-sensitive lexer and parser.
- Define TypeScript interfaces for the canonical AST (Nodes, Props, Values, Tokens).
- Implement structural validation (e.g., ensuring `Card` accepts valid child nodes, actions refer to valid references).
- Implement initial design-token validation against a hardcoded theme schema.

## Phase 2: Component Registry and Third-Party Management

**Goal**: Manage dependencies and map canonical AST nodes to real-world UI components without bleeding implementation details into `.aui` syntax.

- **Component Registry**: Implement a generic component registry that holds mappings from `.aui` components (like `Button`, `Card`) to specific implementations.
- **Adapter Layer**: Create an adapter layer pattern to plug in third-party libraries (e.g., Radix UI, Material UI, shadcn/ui).
  - The AST remains completely agnostic to these libraries.
  - At compile time, the active adapter provides the necessary React imports, wrapper syntax, and prop mappings.
  - Example: `Button variant=primary` translates to `<Button color="primary" />` for MUI adapter, but `<Button variant="default" />` for shadcn/ui adapter.
- Define the contract for "Registry Adapters" to ensure a consistent interface for mapping nodes, props, and actions.

## Phase 3: React Compiler

**Goal**: Translate a validated AST into standard, human-readable React + TypeScript code.

- Implement the React AST visitor/compiler.
- Hook into the Component Registry to generate valid `import` statements and correctly map props for the chosen target UI library.
- Implement formatting for the output string to match Prettier defaults.
- Guarantee that the output is syntactically valid and deterministically mapped from the `.aui` input.

## Phase 4: AI Integration and Benchmarking

**Goal**: Prove the core hypothesis that an LLM can generate this syntax better than TSX.

- Build a benchmark suite with standard UI views (dashboard, settings page, feed).
- Compare Claude/GPT token usage for TSX vs. AUI generation.
- Implement error recovery loops where AST validation failures are formatted back to the LLM for self-correction.
- Define metrics for "visual fidelity" by capturing rendered component snapshots.

## Acceptance Criteria for v0

- The parser accepts valid v0 grammar and deterministic AST structures.
- Structural or syntactical errors throw clear, repairable diagnostics suitable for an LLM.
- The registry pattern successfully maps the core components to at least one robust third-party component library (e.g., Radix UI).
- The compiler outputs accessible, type-safe React/TSX that matches the hand-written equivalent.
- Measured benchmark shows materially fewer output tokens required compared to TSX.
