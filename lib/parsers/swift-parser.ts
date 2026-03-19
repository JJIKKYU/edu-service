export type ParseResult = {
  groups: Array<{
    className: string;
    functions: string[];
  }>;
};

// Hoisted RegExp (js-hoist-regexp)
const SWIFT_CLASS_OR_PROTOCOL_RE =
  /(?:class|protocol|struct|enum|extension)\s+(\w+)[^{]*\{/g;
const SWIFT_FUNC_RE = /func\s+(\w+)/g;

function extractFunctions(body: string): string[] {
  const functions: string[] = [];
  let match: RegExpExecArray | null;
  SWIFT_FUNC_RE.lastIndex = 0;
  while ((match = SWIFT_FUNC_RE.exec(body)) !== null) {
    functions.push(match[1]);
  }
  return functions;
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

    const functions = extractFunctions(body);

    // Mark range as consumed
    for (let i = classMatch.index; i <= closeBraceIndex; i++) {
      consumed.add(i);
    }

    groups.push({ className, functions });
  }

  // Collect global functions (not inside any class/protocol)
  const globalFunctions: string[] = [];
  SWIFT_FUNC_RE.lastIndex = 0;
  let funcMatch: RegExpExecArray | null;
  while ((funcMatch = SWIFT_FUNC_RE.exec(source)) !== null) {
    if (!consumed.has(funcMatch.index)) {
      globalFunctions.push(funcMatch[1]);
    }
  }

  if (globalFunctions.length > 0) {
    groups.push({ className: "Global", functions: globalFunctions });
  }

  return { groups };
}
