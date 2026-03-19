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
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    symbol: {
      deleteMany: vi.fn(),
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

const mockPrisma = prisma as unknown as {
  file: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  symbol: {
    deleteMany: ReturnType<typeof vi.fn>;
  };
};
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

function createFileFromContent(name: string, content: string) {
  return new File([content], name, { type: "text/plain" });
}

type FileData = {
  id: string;
  name: string;
  tags: string;
  createdAt: Date;
  symbols: Array<{
    id: string;
    name: string;
    className: string;
    kind: "function" | "variable";
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
  symbols: Array<{
    id: string;
    name: string;
    className: string;
    completed: boolean;
    kind?: "function" | "variable";
  }>,
  tags = ""
): FileData {
  return {
    id,
    name,
    tags,
    createdAt: new Date(),
    symbols: symbols.map((symbol) => ({
      ...symbol,
      kind: symbol.kind ?? "function",
      fileId: id,
    })),
  };
}

/** Opens the upload modal, selects files, optionally checks tags, and clicks confirm */
async function uploadViaModal(
  files: File | File[],
  options?: { tags?: string[]; applyAccept?: boolean }
) {
  const user = userEvent.setup();

  // Click "파일 업로드" to open modal
  await user.click(screen.getByRole("button", { name: /파일 업로드/ }));

  // Select files via hidden input inside the modal dialog
  const dialog = document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  const uploadOptions = options?.applyAccept === false ? { applyAccept: false } : undefined;
  if (uploadOptions) {
    await (user.upload as unknown as (...args: unknown[]) => Promise<void>)(
      input,
      files,
      uploadOptions
    );
  } else {
    await user.upload(input, files);
  }

  // Check tags if specified
  if (options?.tags) {
    for (const tag of options.tags) {
      await user.click(screen.getByLabelText(tag));
    }
  }

  // Click confirm
  await user.click(screen.getByRole("button", { name: "확인" }));
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

    await uploadViaModal(file);

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
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
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

    await uploadViaModal(file);

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
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
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

    expect(mockFetch).toHaveBeenCalledWith("/api/symbols/f1", { method: "PATCH" });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("이미 체크된 함수가 있으면 진행률이 반영된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

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

    await uploadViaModal(file);

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

    await uploadViaModal(file);

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

    // 다시 클릭 → 접기
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

    await uploadViaModal(file);

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
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
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

// MIGRATE-012: ObjC .h/.m 파일 그룹핑
describe("MIGRATE-012: ObjC .h/.m 파일 그룹핑", () => {
  it(".h와 .m이 같은 base name이면 하나의 카드로 표시된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
        { id: "f2", name: "cancelRequest", className: "NetworkManager", completed: false },
      ]),
      makeFile("2", "NetworkManager.m", [
        { id: "f3", name: "fetchData", className: "NetworkManager", completed: false },
        { id: "f4", name: "cancelRequest", className: "NetworkManager", completed: false },
      ]),
    ]);

    // 하나의 그룹으로 표시 — "NetworkManager" 카드 1개
    expect(screen.getByText("NetworkManager")).toBeInTheDocument();

    // 확장자 Badge 표시
    expect(screen.getByText(".h")).toBeInTheDocument();
    expect(screen.getByText(".m")).toBeInTheDocument();

    // 함수 중복 제거 — 2개만 표시 (4개가 아님)
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);

    // 대시보드 집계도 그룹 기준 — 파일 수 1, 함수 수 2
    expect(screen.getByText("1")).toBeInTheDocument(); // file count
    expect(screen.getByText("2")).toBeInTheDocument(); // function count
  });
});

// MIGRATE-013: 파일 업로드 모달에서 태그 선택
describe("MIGRATE-013: 파일 업로드 모달에서 태그 선택", () => {
  it("TCK 태그를 체크하고 업로드하면 tags가 포함된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n  func refresh() {}\n}"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "HomeViewModel.swift" }),
    });

    await uploadViaModal(file, { tags: ["TCK"] });

    expect(mockFetch).toHaveBeenCalledWith("/api/files", expect.objectContaining({ method: "POST" }));

    const calledFormData = mockFetch.mock.calls[0][1].body as FormData;
    expect(calledFormData.get("tags")).toBe("TCK");
  });
});

// MIGRATE-014: 태그 없이 파일 업로드
describe("MIGRATE-014: 태그 없이 파일 업로드", () => {
  it("태그 없이 업로드하면 tags가 빈 문자열이다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n}"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "HomeViewModel.swift" }),
    });

    await uploadViaModal(file);

    const calledFormData = mockFetch.mock.calls[0][1].body as FormData;
    expect(calledFormData.get("tags")).toBe("");
  });
});

// MIGRATE-015: 두 태그 모두 선택하여 업로드
describe("MIGRATE-015: 두 태그 모두 선택하여 업로드", () => {
  it("TCK, CMP 모두 체크하면 정렬된 tags가 전송된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n}"
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "HomeViewModel.swift" }),
    });

    await uploadViaModal(file, { tags: ["TCK", "CMP"] });

    const calledFormData = mockFetch.mock.calls[0][1].body as FormData;
    expect(calledFormData.get("tags")).toBe("CMP,TCK");
  });
});

// MIGRATE-016: 등록된 파일 태그 인라인 수정
describe("MIGRATE-016: 등록된 파일 태그 인라인 수정", () => {
  it("파일 카드 상단 토글을 클릭하면 PATCH API가 호출된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ fileIds: ["1"], tags: ["CMP", "TCK"], updatedCount: 1 }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "HomeViewModel.swift CMP 태그 적용" })
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/files/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileIds: ["1"],
        tags: ["TCK", "CMP"],
      }),
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("태그 토글을 눌러도 카드가 의도치 않게 펼쳐지지 않는다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ fileIds: ["1"], tags: ["CMP", "TCK"], updatedCount: 1 }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "HomeViewModel.swift CMP 태그 적용" })
    );

    expect(screen.queryByText("loadData")).not.toBeInTheDocument();
  });

  it("ObjC 그룹 카드에서 태그를 수정하면 묶인 파일 id 전체가 전송된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
      ], "TCK"),
      makeFile("2", "NetworkManager.m", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ], ""),
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ fileIds: ["1", "2"], tags: [], updatedCount: 2 }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "NetworkManager TCK 태그 해제" })
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/files/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileIds: ["1", "2"],
        tags: [],
      }),
    });
  });
});

// MIGRATE-017: 변수 항목 집계 및 체크
describe("MIGRATE-017: 변수 항목 집계 및 체크", () => {
  it("카드와 대시보드에 변수 개수가 별도로 표시되고 체크할 수 있다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        {
          id: "v1",
          name: "state",
          className: "HomeViewModel",
          kind: "variable",
          completed: false,
        },
      ]),
    ]);

    expect(screen.getAllByText(/함수 1개 · 변수 1개/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/함수 1개 · 변수 1개/).length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByText("HomeViewModel.swift"));
    expect(screen.getByText("변수")).toBeInTheDocument();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "v1", completed: true }),
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    expect(mockFetch).toHaveBeenCalledWith("/api/symbols/v1", { method: "PATCH" });
  });
});

// MIGRATE-018: 단일 파일 카드 삭제
describe("MIGRATE-018: 단일 파일 카드 삭제", () => {
  it("삭제 확인 후 DELETE API가 호출된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ fileIds: ["1"], deletedCount: 1 }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "HomeViewModel.swift 삭제" })
    );

    expect(screen.getByText("카드를 삭제할까요?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileIds: ["1"],
      }),
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});

// MIGRATE-019: ObjC 그룹 카드 삭제
describe("MIGRATE-019: ObjC 그룹 카드 삭제", () => {
  it("ObjC 그룹 카드 삭제 시 묶인 파일 id 전체가 전송된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
      makeFile("2", "NetworkManager.m", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ fileIds: ["1", "2"], deletedCount: 2 }),
    });

    await userEvent.click(
      screen.getByRole("button", { name: "NetworkManager 삭제" })
    );
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileIds: ["1", "2"],
      }),
    });
  });
});

// MIGRATE-020: 파일 삭제 취소
describe("MIGRATE-020: 파일 삭제 취소", () => {
  it("취소하면 삭제 API가 호출되지 않는다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: "HomeViewModel.swift 삭제" })
    );
    await userEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText("HomeViewModel.swift")).toBeInTheDocument();
  });
});
