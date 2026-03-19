import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const fn = await prisma.function.findUnique({ where: { id } });
  if (!fn) {
    return NextResponse.json({ error: "함수를 찾을 수 없습니다" }, { status: 404 });
  }

  const updated = await prisma.function.update({
    where: { id },
    data: { completed: !fn.completed },
  });

  return NextResponse.json(updated);
}
