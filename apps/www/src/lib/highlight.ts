export interface Token {
  text: string;
  cls?: string;
}

export type Lang = 'aui' | 'tsx' | 'json';

const STR = /"(?:[^"\\]|\\.)*"/y;
const BINDING = /\$[A-Za-z0-9_.]*/y;

/** Highlight one line of .aui source. */
function highlightAui(line: string): Token[] {
  const tokens: Token[] = [];
  const head = line.match(/^(\s*)([^\s]+)(.*)$/);
  if (!head) return [{ text: line }];
  tokens.push({ text: head[1] });
  tokens.push({ text: head[2], cls: 'tok-node' });
  const rest = head[3];
  let i = 0;
  while (i < rest.length) {
    const ch = rest[i];
    if (/\s/.test(ch)) {
      let j = i;
      while (j < rest.length && /\s/.test(rest[j])) j++;
      tokens.push({ text: rest.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '"') {
      STR.lastIndex = i;
      const m = STR.exec(rest);
      if (m) {
        tokens.push({ text: m[0], cls: 'tok-str' });
        i = m.index + m[0].length;
        continue;
      }
    }
    if (ch === '$') {
      BINDING.lastIndex = i;
      const m = BINDING.exec(rest);
      if (m) {
        tokens.push({ text: m[0], cls: 'tok-binding' });
        i = m.index + m[0].length;
        continue;
      }
    }
    const prop = rest.slice(i).match(/^[A-Za-z][A-Za-z0-9_-]*/);
    if (prop && rest[i + prop[0].length] === '=') {
      tokens.push({ text: prop[0], cls: 'tok-prop' });
      i += prop[0].length;
      continue;
    }
    const value = rest.slice(i).match(/^=\S+/);
    if (value) {
      tokens.push({ text: value[0], cls: 'tok-value' });
      i += value[0].length;
      continue;
    }
    tokens.push({ text: ch });
    i++;
  }
  return tokens;
}

const TSX_RULES: Array<[RegExp, string]> = [
  [/\/\/.*/, 'tok-comment'],
  [/"(?:[^"\\]|\\.)*"/, 'tok-str'],
  [/'[^'\\]*(?:\\.[^'\\]*)*'/, 'tok-str'],
  [/<\/?[A-Za-z][A-Za-z0-9.]*|\/?>/, 'tok-node'],
  [/[A-Za-z][A-Za-z0-9]*(?==)/, 'tok-prop'],
  [/\b(?:import|from|export|function|return|const|let|var|if|else|true|false|null|undefined|new|typeof|as|type|interface)\b/, 'tok-kw'],
  [/\$[A-Za-z0-9_.]*/, 'tok-binding'],
];

/** Highlight one line of tsx/js. */
function highlightTsx(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    let matched = false;
    for (const [re, cls] of TSX_RULES) {
      re.lastIndex = i;
      const m = re.exec(line);
      if (m && m.index === i) {
        tokens.push({ text: m[0], cls });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ text: line[i] });
      i++;
    }
  }
  return tokens;
}

/** Highlight one line of JSON. */
function highlightJson(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      STR.lastIndex = i;
      const m = STR.exec(line);
      if (m) {
        const isKey = line[i + m[0].length] === ':';
        tokens.push({ text: m[0], cls: isKey ? 'tok-prop' : 'tok-str' });
        i = m.index + m[0].length;
        continue;
      }
    }
    const num = line.slice(i).match(/^-?\d+(\.\d+)?/);
    if (num) {
      tokens.push({ text: num[0], cls: 'tok-value' });
      i += num[0].length;
      continue;
    }
    const word = line.slice(i).match(/^(true|false|null)/);
    if (word) {
      tokens.push({ text: word[0], cls: 'tok-kw' });
      i += word[0].length;
      continue;
    }
    tokens.push({ text: ch });
    i++;
  }
  return tokens;
}

export function highlight(code: string, lang: Lang): Token[][] {
  const fn = lang === 'aui' ? highlightAui : lang === 'tsx' ? highlightTsx : highlightJson;
  return code.split('\n').map((line) => fn(line));
}
