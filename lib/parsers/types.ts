import type { SymbolKind } from "@/lib/symbols";

export type ParsedSymbol = {
  name: string;
  kind: SymbolKind;
};

export type ParseResult = {
  groups: Array<{
    className: string;
    symbols: ParsedSymbol[];
  }>;
};
