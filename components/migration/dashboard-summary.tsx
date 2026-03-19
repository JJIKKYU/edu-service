"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  MIGRATION_VIEWS,
  type MigrationView,
  getViewLabel,
} from "@/lib/migration-view";

interface DashboardSummaryProps {
  view: MigrationView;
  fileCount: number;
  functionCount: number;
  variableCount: number;
  completedCount: number;
}

export function DashboardSummary({
  view,
  fileCount,
  functionCount,
  variableCount,
  completedCount,
}: DashboardSummaryProps) {
  const totalCount = functionCount + variableCount;
  const viewLabel = getViewLabel(view);
  const completionRate =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {MIGRATION_VIEWS.map((option) => {
          const href = option === "all" ? "/migration" : `/migration?view=${option}`;
          const selected = option === view;
          const optionLabel = getViewLabel(option);

          return (
            <Link
              key={option}
              href={href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors",
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {optionLabel}
            </Link>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">{viewLabel} 파일</p>
            <p className="mt-1 text-2xl font-bold">{fileCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">{viewLabel} 항목</p>
            <p className="mt-1 text-2xl font-bold">{totalCount}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              함수 {functionCount}개 · 변수 {variableCount}개
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">{viewLabel} 완료율</p>
            <p className="mt-1 text-2xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={completionRate} className="flex-1" />
        <span className="text-muted-foreground text-xs">
          {completedCount} / {totalCount} 완료
        </span>
      </div>
    </div>
  );
}
