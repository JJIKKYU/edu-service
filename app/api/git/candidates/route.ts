import { NextResponse } from "next/server";

import { buildStoredCandidateRecord } from "@/lib/migration-storage";
import {
  isGitAutomationError,
  parseRepoFileRequestBody,
  readRepoFile,
} from "@/lib/server/dev-git";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => {
      throw new Error("invalid-json");
    })) as Record<string, unknown>;
    const payload = parseRepoFileRequestBody({
      repoPath: body.repoPath,
      relativePath: body.relativePath ?? body.candidatePath,
    });
    const repoFile = await readRepoFile(payload.repoPath, payload.relativePath);
    const storedFile = buildStoredCandidateRecord({
      filename: repoFile.name,
      relativePath: repoFile.relativePath,
      content: repoFile.content,
    });

    return NextResponse.json(storedFile);
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
      { error: "후보 파일을 불러오지 못했습니다" },
      { status: 500 }
    );
  }
}
