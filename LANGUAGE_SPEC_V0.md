# Language Specification v0

This document defines the proposed grammar and AST contract for the initial version (v0) of the AI UI AST (`.aui`) language.

## Grammar Overview

The language uses indentation-based nesting to represent the UI tree. It does not use brackets, XML-style tags, or arbitrary JS expressions.

### Node Structure

A node declaration follows this pattern:
`ComponentKey [propName=propValue...] ["Optional Text Content"]`

Nesting is represented by a strict 2-space or 4-space indent (must be consistent per file).

Example:

```aui
Card pad=lg
  Stack gap=md
    Heading level=2 "Title"
```

## Supported Nodes (v0)

### Structure

- `Page`: The root element of a view. Accepts `data` bindings.
- `Stack`: A vertical layout container. Props: `gap`, `align`.
- `Row`: A horizontal layout container. Props: `gap`, `align`, `justify`.
- `Grid`: A grid layout. Props: `min` (min column width), `gap`.
- `Card`: A contained surface. Props: `pad`.
- `Section`: A semantic grouping section.
- `Spacer`: Takes up remaining space in a flex layout.

### Content

- `Heading`: Text headers. Props: `level` (1-6).
- `Text`: Standard body text. Props: `tone`, `weight`.
- `Image`: Renders an image. Props: `src`, `alt`.
- `Icon`: Renders a semantic icon. Props: `name`.
- `Divider`: A visual separator.

### Controls

- `Button`: Clickable action. Props: `variant` (primary, secondary, etc.), `action`.
- `Link`: Navigation. Props: `href`.
- `Input`: Text input. Props: `type`, `placeholder`, `value`.
- `Select`: Dropdown selection. Props: `value`, `options`.
- `Checkbox`: Boolean selection. Props: `checked`.
- `Switch`: Toggle control. Props: `checked`.

### Feedback

- `Alert`: Important contextual message. Props: `tone` (info, success, warning, error).
- `Badge`: Status indicator. Props: `tone`.
- `Spinner`: Loading indicator.

### State and Logic

- `If condition`: Conditionally renders children.
- `For each in list`: Iterates and renders children for each item.
- `$binding`: Denotes a data binding from the application state (e.g. `$customer.name`).

## Tokens and Properties

Values for properties like `gap`, `pad`, `variant`, and `tone` are strict, predefined semantic tokens.

- Example gaps/pads: `none, xs, sm, md, lg, xl`
- Example tones: `default, muted, info, success, warning, error`

## Registry Adapter Mapping

The parser converts the `.aui` string into a language-agnostic AST.
During the React compilation phase, a **Component Registry Adapter** interprets this AST.
The adapter determines the exact React import path, component name, and prop transformations required for a specific third-party library (like Radix or MUI).

This enforces a strict boundary: the `.aui` grammar *never* includes UI library specifics. The compiler's registry configuration injects them.
