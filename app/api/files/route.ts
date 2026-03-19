import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFile } from "@/lib/parsers";

export async function GET() {
  const files = await prisma.file.findMany({
    include: { symbols: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
  }

  const fileName = file.name;
  const tagsRaw = formData.get("tags") as string | null;
  const tags = tagsRaw ?? "";

  // Parse file (throws for unsupported extensions)
  let parseResult;
  try {
    const content = await file.text();
    parseResult = parseFile(fileName, content);
  } catch (e) {
    const message = e instanceof Error ? e.message : "파싱 실패";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.file.findUnique({ where: { name: fileName } });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 파일입니다" }, { status: 409 });
  }

  // Save file + symbols
  const created = await prisma.file.create({
    data: {
      name: fileName,
      tags,
      symbols: {
        create: parseResult.groups.flatMap((group) =>
          group.symbols.map((symbol) => ({
            name: symbol.name,
            className: group.className,
            kind: symbol.kind,
          }))
        ),
      },
    },
    include: { symbols: true },
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { fileIds?: unknown } | null;

  const fileIds = Array.isArray(body?.fileIds)
    ? [...new Set(body.fileIds.filter((value): value is string => typeof value === "string"))]
    : [];

  if (fileIds.length === 0) {
    return NextResponse.json(
      { error: "삭제할 파일이 필요합니다" },
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

  await prisma.symbol.deleteMany({
    where: { fileId: { in: fileIds } },
  });

  const deleted = await prisma.file.deleteMany({
    where: { id: { in: fileIds } },
  });

  return NextResponse.json({
    fileIds,
    deletedCount: deleted.count,
  });
}
