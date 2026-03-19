import { NextResponse } from "next/server";

function localStorageModeResponse() {
  return NextResponse.json(
    { error: "개발 모드에서는 브라우저 localStorage를 사용합니다" },
    { status: 410 }
  );
}

export async function GET() {
  return localStorageModeResponse();
}

export async function POST() {
  return localStorageModeResponse();
}

export async function DELETE() {
  return localStorageModeResponse();
}

