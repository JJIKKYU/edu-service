import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const symbol = await prisma.symbol.findUnique({ where: { id } });
  if (!symbol) {
    return NextResponse.json({ error: "항목을 찾을 수 없습니다" }, { status: 404 });
  }

  const updated = await prisma.symbol.update({
    where: { id },
    data: { completed: !symbol.completed },
  });

  return NextResponse.json(updated);
}
