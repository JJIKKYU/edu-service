import { NextResponse } from "next/server";

import {
  getGitDiffResult,
  isGitAutomationError,
  parseGitDiffRequestBody,
} from "@/lib/server/dev-git";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new Error("invalid-json");
    });
    const payload = parseGitDiffRequestBody(body);
    const result = await getGitDiffResult(payload);

    return NextResponse.json({
      ...result,
      changedFilesCount: result.summary.changedFiles,
      matchedCandidatesCount: result.summary.matchedCandidates,
      newlyCompletedSymbolsCount: result.summary.newlyCompletedSymbols,
      completedSymbolIds: [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid-json") {
      return NextResponse.json(
        { error: "요청 본문은 유효한 JSON이어야 합니다" },
        { status: 400 }
      );
    }

    if (isGitAutomationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Git 동기화를 처리하지 못했습니다" },
      { status: 500 }
    );
  }
}
