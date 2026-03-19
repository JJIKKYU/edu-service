"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface DashboardSummaryProps {
  fileCount: number;
  functionCount: number;
  completedCount: number;
}

export function DashboardSummary({
  fileCount,
  functionCount,
  completedCount,
}: DashboardSummaryProps) {
  const completionRate =
    functionCount === 0 ? 0 : Math.round((completedCount / functionCount) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">전체 파일</p>
            <p className="mt-1 text-2xl font-bold">{fileCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">전체 함수</p>
            <p className="mt-1 text-2xl font-bold">{functionCount}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-muted-foreground text-xs">완료율</p>
            <p className="mt-1 text-2xl font-bold">{completionRate}%</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={completionRate} className="flex-1" />
        <span className="text-muted-foreground text-xs">
          {completedCount} / {functionCount} 완료
        </span>
      </div>
    </div>
  );
}
