import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "개발 모드에서는 브라우저 localStorage를 사용합니다" },
    { status: 410 }
  );
}

