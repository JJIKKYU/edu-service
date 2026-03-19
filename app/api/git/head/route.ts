import { NextResponse } from "next/server";

import {
  getRepoHeadCommit,
  isGitAutomationError,
  parseRepoPathRequestBody,
} from "@/lib/server/dev-git";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new Error("invalid-json");
    });
    const payload = parseRepoPathRequestBody(body);
    const headCommit = await getRepoHeadCommit(payload.repoPath);

    return NextResponse.json({ headCommit });
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
      { error: "HEAD 커밋을 조회하지 못했습니다" },
      { status: 500 }
    );
  }
}
