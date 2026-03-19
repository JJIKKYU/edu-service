import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTags, serializeTags } from "@/lib/tags";

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as
    | { fileIds?: unknown; tags?: unknown }
    | null;

  const fileIds = Array.isArray(body?.fileIds)
    ? [...new Set(body.fileIds.filter((value): value is string => typeof value === "string"))]
    : [];
  const tags = Array.isArray(body?.tags)
    ? normalizeTags(body.tags.filter((value): value is string => typeof value === "string"))
    : [];

  if (fileIds.length === 0) {
    return NextResponse.json(
      { error: "수정할 파일이 필요합니다" },
      { status: 400 }
    );
  }

  const files = await prisma.file.findMany({
    where: { id: { in: fileIds } },
    select: { id: true },
  });

  if (files.length !== fileIds.length) {
    return NextResponse.json(
      { error: "파일을 찾을 수 없습니다" },
      { status: 404 }
    );
  }

  const serializedTags = serializeTags(tags);

  const updated = await prisma.file.updateMany({
    where: { id: { in: fileIds } },
    data: { tags: serializedTags },
  });

  return NextResponse.json({
    fileIds,
    tags,
    updatedCount: updated.count,
  });
}
