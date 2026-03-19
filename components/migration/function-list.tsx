"use client";

import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface FunctionItem {
  id: string;
  name: string;
  className: string;
  completed: boolean;
}

interface FunctionListProps {
  functions: FunctionItem[];
}

export function FunctionList({ functions }: FunctionListProps) {
  const router = useRouter();

  // Group functions by className
  const groups = new Map<string, FunctionItem[]>();
  for (const fn of functions) {
    const group = groups.get(fn.className) || [];
    group.push(fn);
    groups.set(fn.className, group);
  }

  async function handleToggle(id: string) {
    await fetch(`/api/functions/${id}`, { method: "PATCH" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {Array.from(groups.entries()).map(([className, fns]) => (
        <div key={className}>
          <p className="text-muted-foreground mb-2 text-xs font-bold">
            {className}
          </p>
          <div className="ml-2 flex flex-col gap-2">
            {fns.map((fn) => (
              <label key={fn.id} className="flex items-center gap-2">
                <Checkbox
                  checked={fn.completed}
                  onCheckedChange={() => handleToggle(fn.id)}
                />
                <span
                  className={cn(
                    "text-sm",
                    fn.completed && "text-muted-foreground line-through"
                  )}
                >
                  {fn.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
