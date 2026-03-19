import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseFile } from "@/lib/parsers";

export async function GET() {
  const files = await prisma.file.findMany({
    include: { functions: true },
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

  // Save file + functions
  const created = await prisma.file.create({
    data: {
      name: fileName,
      functions: {
        create: parseResult.groups.flatMap((group) =>
          group.functions.map((fn) => ({
            name: fn,
            className: group.className,
          }))
        ),
      },
    },
    include: { functions: true },
  });

  return NextResponse.json(created, { status: 201 });
}
