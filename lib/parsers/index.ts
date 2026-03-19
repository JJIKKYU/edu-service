import { parseSwift } from "./swift-parser";
import { parseObjC } from "./objc-parser";
import type { ParseResult } from "./types";

export type { ParseResult };

// Hoisted RegExp (js-hoist-regexp)
const EXT_RE = /\.(\w+)$/;

export function parseFile(filename: string, source: string): ParseResult {
  const match = EXT_RE.exec(filename);
  const ext = match?.[1]?.toLowerCase();

  switch (ext) {
    case "swift":
      return parseSwift(source);
    case "m":
    case "h":
      return parseObjC(source);
    default:
      throw new Error("지원하지 않는 파일 형식입니다");
  }
}
