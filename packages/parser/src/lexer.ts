export interface Token {
  indent: number;
  type: string;
  props: { key: string; value: string }[];
  /** Optional bare identifier after the type, e.g. `Page CustomerDetail`. */
  label?: string;
  textContent?: string;
  line: number;
}

/** Strip surrounding quotes and resolve escapes from a quoted value. */
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, '\n');
  }
  return value;
}

/**
 * Split a line into words, treating quoted strings (which may contain
 * spaces) as single atomic tokens.
 */
function splitWords(line: string): string[] {
  const words: string[] = [];
  const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    words.push(m[0]);
  }
  return words;
}

export function tokenize(input: string): Token[] {
  const lines = input.split('\n');
  const tokens: Token[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine.trim() === '') continue;

    const matchIndent = rawLine.match(/^(\s*)/);
    const indent = matchIndent ? matchIndent[1].length : 0;

    const words = splitWords(rawLine.trim());
    const type = words[0];
    if (!type) continue;

    const props: { key: string; value: string }[] = [];
    const bare: string[] = [];
    let rest = words.slice(1);
    let textContent: string | undefined;

    // A trailing quoted string or bare binding is the node's text content.
    const last = rest[rest.length - 1];
    if (last && (last.startsWith('"') || (last.startsWith('$') && !last.includes('=')))) {
      textContent = last.startsWith('"') ? unquote(last) : last;
      rest = rest.slice(0, -1);
    }

    for (const part of rest) {
      const eqIndex = part.indexOf('=');
      if (eqIndex > 0) {
        props.push({
          key: part.substring(0, eqIndex),
          value: unquote(part.substring(eqIndex + 1)),
        });
      } else {
        bare.push(part);
      }
    }

    // The first bare identifier after the type is the node's label.
    const label = bare.find((w) => !w.startsWith('$'));

    tokens.push({
      indent,
      type,
      props,
      label,
      textContent,
      line: i + 1,
    });
  }

  return tokens;
}
