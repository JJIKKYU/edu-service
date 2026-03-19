"use client";

import { FileCodeIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FunctionList } from "./function-list";

interface FunctionItem {
  id: string;
  name: string;
  className: string;
  completed: boolean;
}

interface FileCardProps {
  displayName: string;
  files: Array<{ id: string; name: string }>;
  functions: FunctionItem[];
  tags: string[];
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex);
}

export function FileCard({ displayName, files, functions, tags }: FileCardProps) {
  const totalFunctions = functions.length;
  const completedFunctions = functions.filter((f) => f.completed).length;
  const progressRate =
    totalFunctions === 0
      ? 0
      : Math.round((completedFunctions / totalFunctions) * 100);

  // Get unique class names for subtitle
  const classNames = [...new Set(functions.map((f) => f.className))];
  const subtitle = `함수 ${totalFunctions}개 · ${classNames.join(", ")}`;

  const extensions = files.map((f) => getExtension(f.name));

  return (
    <Collapsible className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left">
        <FileCodeIcon className="size-[18px] shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold">{displayName}</p>
            {extensions.map((ext) => (
              <Badge key={ext} variant="secondary">
                {ext}
              </Badge>
            ))}
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex w-[120px] items-center gap-2">
            <Progress value={progressRate} className="flex-1" />
            <span className="text-muted-foreground text-xs">
              {progressRate}%
            </span>
          </div>
          <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:hidden [[data-state=open]_&]:hidden" />
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=closed]:hidden [[data-state=closed]_&]:hidden" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t">
          <FunctionList functions={functions} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
