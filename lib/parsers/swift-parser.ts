import type { ParseResult, ParsedSymbol } from "./types";

// Hoisted RegExp (js-hoist-regexp)
const SWIFT_CLASS_OR_PROTOCOL_RE =
  /(?:class|protocol|struct|extension)\s+(\w+)[^{]*\{/g;
const SWIFT_FUNC_RE = /func\s+(\w+)/g;
const SWIFT_VAR_RE = /(?:^|[^\w])(?:let|var)\s+(\w+)/gm;
const SWIFT_ENUM_RE = /(?:^|[^\w])enum\s+(\w+)/gm;

function uniqueSymbols(symbols: ParsedSymbol[]): ParsedSymbol[] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    const key = `${symbol.kind}:${symbol.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSymbols(body: string): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  let match: RegExpExecArray | null;

  SWIFT_FUNC_RE.lastIndex = 0;
  while ((match = SWIFT_FUNC_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "function" });
  }

  SWIFT_VAR_RE.lastIndex = 0;
  while ((match = SWIFT_VAR_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "variable" });
  }

  SWIFT_ENUM_RE.lastIndex = 0;
  while ((match = SWIFT_ENUM_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "variable" });
  }

  return uniqueSymbols(symbols);
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

export function parseSwift(source: string): ParseResult {
  const groups: ParseResult["groups"] = [];
  const consumed = new Set<number>();

  SWIFT_CLASS_OR_PROTOCOL_RE.lastIndex = 0;
  let classMatch: RegExpExecArray | null;

  while ((classMatch = SWIFT_CLASS_OR_PROTOCOL_RE.exec(source)) !== null) {
    const className = classMatch[1];
    const openBraceIndex = source.indexOf("{", classMatch.index);
    const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
    const body = source.slice(openBraceIndex + 1, closeBraceIndex);

    const symbols = extractSymbols(body);

    // Mark range as consumed
    for (let i = classMatch.index; i <= closeBraceIndex; i++) {
      consumed.add(i);
    }

    groups.push({ className, symbols });
  }

  // Collect global symbols (not inside any class/protocol)
  const globalSymbols: ParsedSymbol[] = [];
  const globalSource = [...source]
    .map((char, index) => (consumed.has(index) ? " " : char))
    .join("");

  SWIFT_FUNC_RE.lastIndex = 0;
  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = SWIFT_FUNC_RE.exec(globalSource)) !== null) {
    globalSymbols.push({ name: funcMatch[1], kind: "function" });
  }

  SWIFT_VAR_RE.lastIndex = 0;
  while ((funcMatch = SWIFT_VAR_RE.exec(globalSource)) !== null) {
    globalSymbols.push({ name: funcMatch[1], kind: "variable" });
  }

  SWIFT_ENUM_RE.lastIndex = 0;
  while ((funcMatch = SWIFT_ENUM_RE.exec(globalSource)) !== null) {
    globalSymbols.push({ name: funcMatch[1], kind: "variable" });
  }

  const dedupedGlobalSymbols = uniqueSymbols(globalSymbols);

  if (dedupedGlobalSymbols.length > 0) {
    groups.push({ className: "Global", symbols: dedupedGlobalSymbols });
  }

  return { groups };
}
