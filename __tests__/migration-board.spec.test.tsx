import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
  Toaster: () => null,
}));

import MigrationPage from "@/app/migration/page";
import { toast } from "sonner";
import {
  loadStoredFiles,
  MIGRATION_STORAGE_KEY,
  saveStoredFiles,
  type StoredFileRecord,
} from "@/lib/migration-storage";

const mockToastError = toast.error as ReturnType<typeof vi.fn>;
const mockFetch = vi.fn();

global.fetch = mockFetch as typeof fetch;

function createFileFromContent(name: string, content: string) {
  return new File([content], name, { type: "text/plain" });
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
): StoredFileRecord {
  return {
    id,
    name,
    tags,
    createdAt: new Date().toISOString(),
    symbols: symbols.map((symbol) => ({
      ...symbol,
      kind: symbol.kind ?? "function",
    })),
  };
}

async function renderWithData(files: StoredFileRecord[]) {
  saveStoredFiles(files);
  const Page = await MigrationPage();
  render(Page);
}

async function renderWithDataAndView(files: StoredFileRecord[], view?: string) {
  saveStoredFiles(files);
  const Page = await MigrationPage({
    searchParams: Promise.resolve(view ? { view } : {}),
  });
  render(Page);
}

async function uploadViaModal(
  files: File | File[],
  options?: { tags?: string[]; applyAccept?: boolean }
) {
  const user = userEvent.setup();

  await user.click(screen.getByRole("button", { name: /파일 업로드/ }));

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

  if (options?.tags) {
    for (const tag of options.tags) {
      await user.click(screen.getByLabelText(tag));
    }
  }

  await user.click(screen.getByRole("button", { name: "확인" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  window.localStorage.removeItem(MIGRATION_STORAGE_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MIGRATE-001: 빈 상태 안내", () => {
  it("등록된 파일이 없으면 안내 문구, 업로드 버튼, 요약 0값이 표시된다", async () => {
    await renderWithData([]);

    expect(await screen.findByText("등록된 파일이 없습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /파일 업로드/ })).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

describe("MIGRATE-002: Swift 파일 업로드 및 파싱", () => {
  it(".swift 파일 업로드 후 카드가 추가된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n  func refresh() {}\n}"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("HomeViewModel.swift")).toBeInTheDocument();
    expect(loadStoredFiles()).toHaveLength(1);
  });

  it("업로드 후 파일 카드에 파일명, 함수 수, 진행률 0%가 표시된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "HomeViewModel.swift",
      "class HomeViewModel {\n  func loadData() {}\n  func refresh() {}\n}"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("HomeViewModel.swift")).toBeInTheDocument();
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-003: ObjC 파일 업로드 및 파싱", () => {
  it(".m 파일 업로드 후 카드가 추가된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.m",
      "@interface NetworkManager\n- (void)fetchData {}\n- (void)cancelRequest {}\n@end"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("NetworkManager.m")).toBeInTheDocument();
  });

  it("업로드 후 파일 카드에 파일명, 함수 수가 표시된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.m",
      "@interface NetworkManager\n- (void)fetchData {}\n- (void)cancelRequest {}\n@end"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("NetworkManager.m")).toBeInTheDocument();
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-004: 파일 카드 확장하여 함수 목록 확인", () => {
  it("파일 카드 클릭 시 클래스별 함수 목록과 체크박스가 표시된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(await screen.findByText("HomeViewModel.swift"));

    expect(screen.getByText("HomeViewModel")).toBeInTheDocument();
    expect(screen.getByText("loadData")).toBeInTheDocument();
    expect(screen.getByText("refresh")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});

describe("MIGRATE-005: 함수 TCK 전환 완료 체크", () => {
  it("체크박스 클릭 시 완료 상태가 반영된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(await screen.findByText("HomeViewModel.swift"));
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);

    await waitFor(() => expect(checkboxes[0]).toBeChecked());
    expect(loadStoredFiles()[0].symbols[0].completed).toBe(true);
  });

  it("이미 체크된 함수가 있으면 진행률이 반영된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    expect((await screen.findAllByText("50%")).length).toBeGreaterThanOrEqual(1);
  });
});

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

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getAllByText("40%").length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-007: 중복 파일 업로드 거부", () => {
  it("이미 등록된 파일명 업로드 시 에러 토스트", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await uploadViaModal(createFileFromContent("HomeViewModel.swift", "class HomeViewModel {}"));

    expect(mockToastError).toHaveBeenCalledWith("이미 등록된 파일입니다");
  });
});

describe("MIGRATE-008: 지원하지 않는 파일 형식 업로드 거부", () => {
  it(".py 파일 업로드 시 에러 토스트", async () => {
    await renderWithData([]);

    await uploadViaModal(createFileFromContent("utils.py", "def hello(): pass"));

    expect(mockToastError).toHaveBeenCalledWith("지원하지 않는 파일 형식입니다");
  });
});

describe("MIGRATE-009: 파일 카드 접기 (토글)", () => {
  it("확장된 카드를 다시 클릭하면 함수 목록이 숨겨진다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    const trigger = await screen.findByText("HomeViewModel.swift");
    await userEvent.click(trigger);
    expect(screen.getByText("loadData")).toBeInTheDocument();
    await userEvent.click(trigger);

    const collapsibleContent = document.querySelector(
      '[data-state="closed"][data-slot="collapsible-content"]'
    );
    expect(collapsibleContent).toBeTruthy();
  });
});

describe("MIGRATE-010: ObjC 헤더(.h) 파일 업로드 및 파싱", () => {
  it(".h 파일 업로드 후 카드가 추가된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.h",
      "@interface NetworkManager\n- (void)fetchData;\n- (void)cancelRequest;\n@end"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("NetworkManager.h")).toBeInTheDocument();
  });

  it("업로드 후 파일 카드에 파일명, 함수 수가 표시된다", async () => {
    await renderWithData([]);

    const file = createFileFromContent(
      "NetworkManager.h",
      "@interface NetworkManager\n- (void)fetchData;\n- (void)cancelRequest;\n@end"
    );

    await uploadViaModal(file);

    expect(await screen.findByText("NetworkManager.h")).toBeInTheDocument();
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-011: 파일 내 모든 함수 체크 완료", () => {
  it("모든 함수가 완료되면 진행률 100%", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: true },
      ]),
    ]);

    expect((await screen.findAllByText("100%")).length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-012: ObjC .h/.m 파일 그룹핑", () => {
  it(".h와 .m이 같은 base name이면 하나의 카드로 표시된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
      makeFile("2", "NetworkManager.m", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
        { id: "f3", name: "cancelRequest", className: "NetworkManager", completed: false },
      ]),
    ]);

    expect(await screen.findByText("NetworkManager")).toBeInTheDocument();
    expect(screen.getByText(".h")).toBeInTheDocument();
    expect(screen.getByText(".m")).toBeInTheDocument();
    expect(screen.getAllByText(/함수 2개/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("MIGRATE-013: 파일 업로드 모달에서 태그 선택", () => {
  it("TCK 태그를 체크하고 업로드하면 tags가 포함된다", async () => {
    await renderWithData([]);

    await uploadViaModal(
      createFileFromContent("HomeViewModel.swift", "class HomeViewModel { func loadData() {} }"),
      { tags: ["TCK"] }
    );

    expect(loadStoredFiles()[0].tags).toBe("TCK");
  });
});

describe("MIGRATE-014: 태그 없이 파일 업로드", () => {
  it("태그 없이 업로드하면 tags가 빈 문자열이다", async () => {
    await renderWithData([]);

    await uploadViaModal(
      createFileFromContent("HomeViewModel.swift", "class HomeViewModel { func loadData() {} }")
    );

    expect(loadStoredFiles()[0].tags).toBe("");
  });
});

describe("MIGRATE-015: 두 태그 모두 선택하여 업로드", () => {
  it("TCK, CMP 모두 체크하면 정렬된 tags가 전송된다", async () => {
    await renderWithData([]);

    await uploadViaModal(
      createFileFromContent("HomeViewModel.swift", "class HomeViewModel { func loadData() {} }"),
      { tags: ["TCK", "CMP"] }
    );

    expect(loadStoredFiles()[0].tags).toBe("CMP,TCK");
  });
});

describe("MIGRATE-016: 등록된 파일 태그 인라인 수정", () => {
  it("파일 카드 상단 토글을 클릭하면 태그가 반영된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "HomeViewModel.swift CMP 태그 적용" })
    );

    expect(loadStoredFiles()[0].tags).toBe("CMP,TCK");
  });

  it("태그 토글을 눌러도 카드가 의도치 않게 펼쳐지지 않는다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "HomeViewModel.swift CMP 태그 적용" })
    );

    expect(screen.queryByText("loadData")).not.toBeInTheDocument();
  });

  it("ObjC 그룹 카드에서 태그를 수정하면 묶인 파일 전체에 반영된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
      ], "TCK"),
      makeFile("2", "NetworkManager.m", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "NetworkManager TCK 태그 해제" })
    );

    expect(loadStoredFiles().map((file) => file.tags)).toEqual(["", ""]);
  });
});

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

    expect((await screen.findAllByText(/함수 1개 · 변수 1개/)).length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByText("HomeViewModel.swift"));
    expect(screen.getByText("변수")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[1]);

    expect(loadStoredFiles()[0].symbols[1].completed).toBe(true);
  });
});

describe("MIGRATE-018: 단일 파일 카드 삭제", () => {
  it("삭제 확인 후 카드가 제거된다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "HomeViewModel.swift 삭제" })
    );

    expect(screen.getByText("카드를 삭제할까요?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(screen.queryByText("HomeViewModel.swift")).not.toBeInTheDocument()
    );
    expect(loadStoredFiles()).toHaveLength(0);
  });
});

describe("MIGRATE-019: ObjC 그룹 카드 삭제", () => {
  it("ObjC 그룹 카드 삭제 시 묶인 파일 전체가 제거된다", async () => {
    await renderWithData([
      makeFile("1", "NetworkManager.h", [
        { id: "f1", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
      makeFile("2", "NetworkManager.m", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ]),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "NetworkManager 삭제" })
    );
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(loadStoredFiles()).toHaveLength(0);
  });
});

describe("MIGRATE-020: 파일 삭제 취소", () => {
  it("취소하면 삭제되지 않는다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ]),
    ]);

    await userEvent.click(
      await screen.findByRole("button", { name: "HomeViewModel.swift 삭제" })
    );
    await userEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(loadStoredFiles()).toHaveLength(1);
    expect(screen.getByText("HomeViewModel.swift")).toBeInTheDocument();
  });
});

describe("MIGRATE-021: 대시보드 뷰 전환 옵션 표시", () => {
  it("'전체', 'TCK', 'CMP' 옵션이 표시되고 기본은 전체다", async () => {
    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
      makeFile("2", "NetworkManager.swift", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ], "CMP"),
    ]);

    expect(await screen.findByRole("link", { name: "전체" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "TCK" })).toHaveAttribute("href", "/migration?view=tck");
    expect(screen.getByRole("link", { name: "CMP" })).toHaveAttribute("href", "/migration?view=cmp");
    expect(screen.getByText("전체 파일")).toBeInTheDocument();
  });
});

describe("MIGRATE-022: TCK 뷰로 요약과 목록 필터", () => {
  it("TCK 태그가 있는 카드와 집계만 표시된다", async () => {
    await renderWithDataAndView([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
      ], "TCK"),
      makeFile("2", "NetworkManager.swift", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: false },
      ], "CMP"),
      makeFile("3", "SharedManager.swift", [
        { id: "f3", name: "bridge", className: "SharedManager", completed: false },
      ], "CMP,TCK"),
      makeFile("4", "LegacyBridge.swift", [
        { id: "f4", name: "legacy", className: "LegacyBridge", completed: false },
      ]),
    ], "tck");

    expect(await screen.findByText("TCK 파일")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1 / 2 완료")).toBeInTheDocument();
    expect(screen.getByText("HomeViewModel.swift")).toBeInTheDocument();
    expect(screen.getByText("SharedManager.swift")).toBeInTheDocument();
    expect(screen.queryByText("NetworkManager.swift")).not.toBeInTheDocument();
    expect(screen.queryByText("LegacyBridge.swift")).not.toBeInTheDocument();
  });
});

describe("MIGRATE-023: CMP 뷰로 요약과 목록 필터", () => {
  it("CMP 태그가 있는 카드와 집계만 표시된다", async () => {
    await renderWithDataAndView([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
      ], "TCK"),
      makeFile("2", "NetworkManager.swift", [
        { id: "f2", name: "fetchData", className: "NetworkManager", completed: true },
      ], "CMP"),
      makeFile("3", "SharedManager.swift", [
        { id: "f3", name: "bridge", className: "SharedManager", completed: false },
      ], "CMP,TCK"),
      makeFile("4", "LegacyBridge.swift", [
        { id: "f4", name: "legacy", className: "LegacyBridge", completed: false },
      ]),
    ], "cmp");

    expect(await screen.findByText("CMP 파일")).toBeInTheDocument();
    expect(screen.getByText("NetworkManager.swift")).toBeInTheDocument();
    expect(screen.getByText("SharedManager.swift")).toBeInTheDocument();
    expect(screen.queryByText("HomeViewModel.swift")).not.toBeInTheDocument();
    expect(screen.queryByText("LegacyBridge.swift")).not.toBeInTheDocument();
  });
});

describe("MIGRATE-024: 태그별 뷰 빈 상태", () => {
  it("해당 태그 파일이 없으면 태그별 빈 상태 문구가 보인다", async () => {
    await renderWithDataAndView([
      makeFile("1", "LegacyBridge.swift", [
        { id: "f1", name: "legacy", className: "LegacyBridge", completed: false },
      ]),
    ], "tck");

    expect(await screen.findByText("TCK 태그 파일이 없습니다")).toBeInTheDocument();
    expect(screen.queryByText("LegacyBridge.swift")).not.toBeInTheDocument();
  });

  it("알 수 없는 view 값은 전체 보기로 폴백한다", async () => {
    await renderWithDataAndView([
      makeFile("1", "LegacyBridge.swift", [
        { id: "f1", name: "legacy", className: "LegacyBridge", completed: false },
      ]),
    ], "unknown");

    expect(await screen.findByText("전체 파일")).toBeInTheDocument();
    expect(screen.getByText("LegacyBridge.swift")).toBeInTheDocument();
  });
});

describe("MIGRATE-025: 로컬 개발 전용 Git 자동화 UI 노출", () => {
  it("테스트 환경에서는 Git 자동화 설정 입력과 버튼이 표시되지 않는다", async () => {
    await renderWithData([]);

    expect(screen.queryByLabelText("iOS repo 경로")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("기준 커밋")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Git diff로 갱신" })
    ).not.toBeInTheDocument();
  });

  it("프로덕션 환경에서는 Git 자동화 설정 입력과 버튼이 표시되지 않는다", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await renderWithData([]);

    expect(screen.queryByLabelText("iOS repo 경로")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("기준 커밋")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Git diff로 갱신" })
    ).not.toBeInTheDocument();
  });
});

describe("MIGRATE-026: 로컬 개발 환경 Git 자동화 설정 입력", () => {
  it("개발 환경에서는 repo 경로, 기준 커밋, 후보군 추가, Git diff 갱신 UI가 보인다", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await renderWithData([]);

    expect(await screen.findByLabelText("iOS repo 경로")).toBeInTheDocument();
    expect(screen.getByLabelText("기준 커밋")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "후보군 추가" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Git diff로 갱신" })).toBeInTheDocument();
  });

  it("repo 경로와 기준 커밋을 입력할 수 있다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await renderWithData([]);

    const user = userEvent.setup();
    const repoPathInput = await screen.findByLabelText("iOS repo 경로");
    const baselineInput = screen.getByLabelText("기준 커밋");

    await user.type(repoPathInput, "/Users/dev/ios-app");
    await user.type(baselineInput, "abc1234");

    expect(repoPathInput).toHaveValue("/Users/dev/ios-app");
    expect(baselineInput).toHaveValue("abc1234");
  });
});

describe("MIGRATE-027: 후보군 파일 경로 추가", () => {
  it("후보 파일 경로를 입력하고 후보군 추가를 누르면 후보군 요청이 전송되고 카드가 추가된다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "candidate-1",
        name: "HomeViewModel.swift",
        tags: "",
        createdAt: new Date().toISOString(),
        symbols: [
          {
            id: "f1",
            name: "loadData",
            className: "HomeViewModel",
            kind: "function",
            completed: false,
          },
        ],
      }),
    });

    await renderWithData([]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("iOS repo 경로"), "/Users/dev/ios-app");
    await user.type(screen.getByLabelText("기준 커밋"), "abc1234");
    await user.type(screen.getByLabelText("후보 파일 경로"), "Sources/HomeViewModel.swift");
    await user.click(screen.getByRole("button", { name: "후보군 추가" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/git/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoPath: "/Users/dev/ios-app",
        baselineCommit: "abc1234",
        candidatePath: "Sources/HomeViewModel.swift",
      }),
    });

    expect(await screen.findByText("HomeViewModel.swift")).toBeInTheDocument();
  });
});

describe("MIGRATE-028: Git diff 자동 갱신 실행", () => {
  it("Git diff로 갱신을 누르면 sync 요청이 전송되고 요약 배너가 표시된다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changedFilesCount: 1,
        matchedCandidatesCount: 1,
        newlyCompletedSymbolsCount: 1,
        completedSymbolIds: ["f2"],
      }),
    });

    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: false },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("iOS repo 경로"), "/Users/dev/ios-app");
    await user.type(screen.getByLabelText("기준 커밋"), "abc1234");
    await user.click(screen.getByRole("button", { name: "Git diff로 갱신" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/git/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoPath: "/Users/dev/ios-app",
        baselineCommit: "abc1234",
        candidatePaths: ["HomeViewModel.swift"],
      }),
    });

    expect(await screen.findByText("자동 갱신 결과")).toBeInTheDocument();
    expect(screen.getByText("변경 파일 1개")).toBeInTheDocument();
    expect(screen.getByText("후보군 매칭 1개")).toBeInTheDocument();
    expect(screen.getByText("새 완료 항목 1개")).toBeInTheDocument();
  });
});

describe("MIGRATE-029: 자동 갱신은 완료 상태를 누적만 반영", () => {
  it("기존 완료 상태는 유지되고 새로 매칭된 심볼만 추가 완료되어 진행률이 누적된다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changedFilesCount: 1,
        matchedCandidatesCount: 1,
        newlyCompletedSymbolsCount: 1,
        completedSymbolIds: ["f2"],
      }),
    });

    await renderWithData([
      makeFile("1", "HomeViewModel.swift", [
        { id: "f1", name: "loadData", className: "HomeViewModel", completed: true },
        { id: "f2", name: "refresh", className: "HomeViewModel", completed: false },
      ]),
    ]);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("iOS repo 경로"), "/Users/dev/ios-app");
    await user.type(screen.getByLabelText("기준 커밋"), "abc1234");
    await user.click(screen.getByRole("button", { name: "Git diff로 갱신" }));

    await user.click(screen.getByText("HomeViewModel.swift"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect((await screen.findAllByText("100%")).length).toBeGreaterThanOrEqual(1);
  });
});
