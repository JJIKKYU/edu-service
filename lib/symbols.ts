export type SymbolKind = "function" | "variable";

export interface SymbolItem {
  id: string;
  name: string;
  className: string;
  kind: string;
  completed: boolean;
}

export function countSymbolsByKind(symbols: SymbolItem[]) {
  return symbols.reduce(
    (counts, symbol) => {
      if (symbol.kind === "function") counts.functionCount += 1;
      else counts.variableCount += 1;
      if (symbol.completed) counts.completedCount += 1;
      return counts;
    },
    { functionCount: 0, variableCount: 0, completedCount: 0 }
  );
}
