import type { ParseResult, ParsedSymbol } from "./types";

// Hoisted RegExp (js-hoist-regexp)
const OBJC_INTERFACE_OR_PROTOCOL_RE =
  /@(?:interface|protocol)\s+(\w+)[\s\S]*?@end/g;
const OBJC_METHOD_RE =
  /[-+]\s*\([^)]*\)\s*(\w+)/g;
const OBJC_PROPERTY_RE =
  /@property\s*\([^)]*\)\s*[^;]*?\b(\w+)\s*;/g;
const OBJC_TYPED_ENUM_RE =
  /typedef\s+NS_ENUM\s*\([^,]+,\s*(\w+)\s*\)/g;
const OBJC_ENUM_RE = /enum\s+(\w+)/g;

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

  OBJC_METHOD_RE.lastIndex = 0;
  while ((match = OBJC_METHOD_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "function" });
  }

  OBJC_PROPERTY_RE.lastIndex = 0;
  while ((match = OBJC_PROPERTY_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "variable" });
  }

  OBJC_TYPED_ENUM_RE.lastIndex = 0;
  while ((match = OBJC_TYPED_ENUM_RE.exec(body)) !== null) {
    symbols.push({ name: match[1], kind: "variable" });
  }

  OBJC_ENUM_RE.lastIndex = 0;
  while ((match = OBJC_ENUM_RE.exec(body)) !== null) {
    if (match[1]) {
      symbols.push({ name: match[1], kind: "variable" });
    }
  }

  return uniqueSymbols(symbols);
}

export function parseObjC(source: string): ParseResult {
  const groups: ParseResult["groups"] = [];
  const consumed = new Set<number>();

  OBJC_INTERFACE_OR_PROTOCOL_RE.lastIndex = 0;
  let classMatch: RegExpExecArray | null;

  while (
    (classMatch = OBJC_INTERFACE_OR_PROTOCOL_RE.exec(source)) !== null
  ) {
    const className = classMatch[1];
    const body = classMatch[0];
    const symbols = extractSymbols(body);

    // Mark range as consumed
    for (
      let i = classMatch.index;
      i < classMatch.index + classMatch[0].length;
      i++
    ) {
      consumed.add(i);
    }

    groups.push({ className, symbols });
  }

  // Collect global symbols (not inside any @interface/@protocol)
  const globalSource = [...source]
    .map((char, index) => (consumed.has(index) ? " " : char))
    .join("");
  const globalSymbols = extractSymbols(globalSource);

  if (globalSymbols.length > 0) {
    groups.push({ className: "Global", symbols: globalSymbols });
  }

  return { groups };
}
