import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
  Toaster: () => null,
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    file: {
      findMany: vi.fn(),
    },
  },
}));

// Mock fetch for client-side API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import MigrationPage from "@/app/migration/page";
import { prisma } from "@/lib/prisma";
import { toast } from "sonner";

const mockPrisma = vi.mocked(prisma);
const mockToastError = vi.mocked(toast.error);

function createFileFromContent(name: string, content: string) {
  return new File([content], name, { type: "text/plain" });
}

type FileData = {
  id: string;
  name: string;
  createdAt: Date;
  functions: Array<{
    id: string;
    name: string;
    className: string;
    completed: boolean;
    fileId: string;
  }>;
};

async function renderWithData(files: FileData[]) {
  mockPrisma.file.findMany.mockResolvedValue(files);
  const Page = await MigrationPage();
  render(Page);
}

function makeFile(
  id: string,
  name: string,
  fns: Array<{ id: string; name: string; className: string; completed: boolean }>
): FileData {
  return {
    id,
    name,
    createdAt: new Date(),
    functions: fns.map((f) => ({ ...f, fileId: id })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// MIGRATE-001: 빈 상태 안내
describe("MIGRATE-001: 빈 상태 안내", () => {
  it("등록된 파일이 없으면 안내 문구, 업로드 버튼, 요약 0값이 표시된다", async () => {
    await renderWithData([]);

    expect(screen.getByText("등록된 파일이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /파일 업로드/ })).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

// MIGRATE-002: Swift 파일 업로드 및 파싱
describe("MIGRATE-002: Swift 파일 업로드 및 파싱", () => {
  it(".swift 파일 업로드 후 API가 호출된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n  func refresh() {}\n}"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "HomeViewModel.swift" }),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(mockFetch).toHaveBeenCalledWith("/api/files", expect.objectContaining({ method: "POST" }));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("업로드 후 파일 카드에 파일명, 함수 수, 진행률 0%가 표시된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    expect(screen.getByText("HomeViewModel.swift")).toBeInTheDocument();
    expect(screen.getByText(/함수 2개/)).toBeInTheDocument();
    // 요약 카드에 0%가 표시된다 (파일 카드의 0%와 합해 다수)
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
  });
});

// MIGRATE-003: ObjC 파일 업로드 및 파싱
describe("MIGRATE-003: ObjC 파일 업로드 및 파싱", () => {
  it(".m 파일 업로드 후 API가 호출된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.m",
      "@interface NetworkManager\n- (void)fetchData {}\n- (void)cancelRequest {}\n@end"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "NetworkManager.m" }),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(mockFetch).toHaveBeenCalledWith("/api/files", expect.objectContaining({ method: "POST" }));
  });

  it("업로드 후 파일 카드에 파일명, 함수 수가 표시된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.m", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
        { id: "f2", name: "cancelRequest", className: "NetworkManager", completed: false },
      ]),
    ]);

    expect(screen.getByText("NetworkManager.m")).toBeInTheDocument();
    expect(screen.getByText(/함수 2개/)).toBeInTheDocument();
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
  });
});

// MIGRATE-004: 파일 카드 확장하여 함수 목록 확인
describe("MIGRATE-004: 파일 카드 확장하여 함수 목록 확인", () => {
  it("파일 카드 클릭 시 클래스별 함수 목록과 체크박스가 표시된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(screen.getByText("HomeViewModel.swift"));

    expect(screen.getByText("HomeViewModel")).toBeInTheDocument();
    expect(screen.getByText("loadData")).toBeInTheDocument();
    expect(screen.getByText("refresh")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });
});

// MIGRATE-005: 함수 TCK 전환 완료 체크
describe("MIGRATE-005: 함수 TCK 전환 완료 체크", () => {
  it("체크박스 클릭 시 PATCH API가 호출된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(screen.getByText("HomeViewModel.swift"));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "f1", completed: true }),
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);

    expect(mockFetch).toHaveBeenCalledWith("/api/functions/f1", { method: "PATCH" });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("이미 체크된 함수가 있으면 진행률이 반영된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    // 50%가 요약 카드와 파일 카드 모두에 표시됨
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);
  });
});

// MIGRATE-006: 대시보드 집계 요약
describe("MIGRATE-006: 대시보드 집계 요약", () => {
  it("파일 2개, 함수 5개, 완료 2개 → 파일 수 2, 함수 수 5, 완료율 40%", async () => {
    await renderWithData([
      makeFile("1", "FileA.swift", [
        { id: "f1", name: "funcA1", className: "ClassA", completed: true },
        { id: "f2", name: "funcA2", className: "ClassA", completed: false },
      ]),
      makeFile("2", "FileB.swift", [
        { id: "f3", name: "funcB1", className: "ClassB", completed: true },
        { id: "f4", name: "funcB2", className: "ClassB", completed: false },
        { id: "f5", name: "funcB3", className: "ClassB", completed: false },
      ]),
    ]);

    expect(screen.getByText("2")).toBeInTheDocument(); // file count
    expect(screen.getByText("5")).toBeInTheDocument(); // function count
    expect(screen.getAllByText("40%").length).toBeGreaterThanOrEqual(1); // completion rate
  });
});

// MIGRATE-007: 중복 파일 업로드 거부
describe("MIGRATE-007: 중복 파일 업로드 거부", () => {
  it("이미 등록된 파일명 업로드 시 에러 토스트", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    const file = createFileFromContent("HomeViewModel.swift", "class HomeViewModel {}");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "이미 등록된 파일입니다" }),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(mockToastError).toHaveBeenCalledWith("이미 등록된 파일입니다");
  });
});

// MIGRATE-008: 지원하지 않는 파일 형식 업로드 거부
describe("MIGRATE-008: 지원하지 않는 파일 형식 업로드 거부", () => {
  it(".py 파일 업로드 시 에러 토스트", async () => {
    await renderWithData([]);

    const file = createFileFromContent("utils.py", "def hello(): pass");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "지원하지 않는 파일 형식입니다" }),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // applyAccept: false to bypass HTML accept filter (server validates too)
    await userEvent.upload(input, file, { applyAccept: false });

    expect(mockToastError).toHaveBeenCalledWith("지원하지 않는 파일 형식입니다");
  });
});

// MIGRATE-009: 파일 카드 접기 (토글)
describe("MIGRATE-009: 파일 카드 접기 (토글)", () => {
  it("확장된 카드를 다시 클릭하면 함수 목록이 숨겨진다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    const trigger = screen.getByText("HomeViewModel.swift");

    // 클릭 → 확장
    await userEvent.click(trigger);
    expect(screen.getByText("loadData")).toBeInTheDocument();

    // 다시 클릭 → 접기 (collapsible content should have hidden attribute)
    await userEvent.click(trigger);

    const collapsibleContent = document.querySelector('[data-state="closed"][data-slot="collapsible-content"]');
    expect(collapsibleContent).toBeTruthy();
  });
});

// MIGRATE-010: ObjC 헤더(.h) 파일 업로드 및 파싱
describe("MIGRATE-010: ObjC 헤더(.h) 파일 업로드 및 파싱", () => {
  it(".h 파일 업로드 후 API가 호출된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.h",
      "@interface NetworkManager\n- (void)fetchData;\n- (void)cancelRequest;\n@end"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "NetworkManager.h" }),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(mockFetch).toHaveBeenCalledWith("/api/files", expect.objectContaining({ method: "POST" }));
  });

  it("업로드 후 파일 카드에 파일명, 함수 수가 표시된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
        { id: "f2", name: "cancelRequest", className: "NetworkManager", completed: false },
      ]),
    ]);

    expect(screen.getByText("NetworkManager.h")).toBeInTheDocument();
    expect(screen.getByText(/함수 2개/)).toBeInTheDocument();
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
  });
});

// MIGRATE-011: 파일 내 모든 함수 체크 완료
describe("MIGRATE-011: 파일 내 모든 함수 체크 완료", () => {
  it("모든 함수가 완료되면 진행률 100%", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: true },
      ]),
    ]);

    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
  });
});
