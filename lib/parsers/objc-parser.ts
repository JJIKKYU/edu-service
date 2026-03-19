import type { ParseResult } from "./swift-parser";

// Hoisted RegExp (js-hoist-regexp)
const OBJC_INTERFACE_OR_PROTOCOL_RE =
  /@(?:interface|protocol)\s+(\w+)[\s\S]*?@end/g;
const OBJC_METHOD_RE =
  /[-+]\s*\([^)]*\)\s*(\w+)/g;

function extractMethods(body: string): string[] {
  const methods: string[] = [];
  let match: RegExpExecArray | null;
  OBJC_METHOD_RE.lastIndex = 0;
  while ((match = OBJC_METHOD_RE.exec(body)) !== null) {
    methods.push(match[1]);
  }
  return methods;
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
    const functions = extractMethods(body);

    // Mark range as consumed
    for (
      let i = classMatch.index;
      i < classMatch.index + classMatch[0].length;
      i++
    ) {
      consumed.add(i);
    }

    groups.push({ className, functions });
  }

  // Collect global methods (not inside any @interface/@protocol)
  const globalFunctions: string[] = [];
  OBJC_METHOD_RE.lastIndex = 0;
  let methodMatch: RegExpExecArray | null;
  while ((methodMatch = OBJC_METHOD_RE.exec(source)) !== null) {
    if (!consumed.has(methodMatch.index)) {
      globalFunctions.push(methodMatch[1]);
    }
  }

  if (globalFunctions.length > 0) {
    groups.push({ className: "Global", functions: globalFunctions });
  }

  return { groups };
}
