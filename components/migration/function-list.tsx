"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SymbolItem } from "@/lib/symbols";

interface FunctionListProps {
  symbols: SymbolItem[];
  onToggleSymbol: (symbolId: string) => void;
}

export function FunctionList({ symbols, onToggleSymbol }: FunctionListProps) {
  const groups = new Map<string, SymbolItem[]>();
  for (const symbol of symbols) {
    const group = groups.get(symbol.className) || [];
    group.push(symbol);
    groups.set(symbol.className, group);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {Array.from(groups.entries()).map(([className, classSymbols]) => (
        <div key={className}>
          <p className="text-muted-foreground mb-2 text-xs font-bold">
            {className}
          </p>
          <div className="ml-2 flex flex-col gap-2">
            {classSymbols.map((symbol) => (
              <label key={symbol.id} className="flex items-center gap-2">
                <Checkbox
                  checked={symbol.completed}
                  onCheckedChange={() => onToggleSymbol(symbol.id)}
                />
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    symbol.completed && "text-muted-foreground line-through"
                  )}
                >
                  <Badge variant={symbol.kind === "function" ? "secondary" : "outline"}>
                    {symbol.kind === "function" ? "함수" : "변수"}
                  </Badge>
                  {symbol.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
