# Migration Progress Board 구현 계획

## Architecture Decisions

| 결정 사항 | 선택 | 사유 |
|-----------|------|------|
| 파일 파싱 위치 | Server (Route Handler) | Prisma DB 저장이 필요하므로 서버에서 파싱 후 바로 저장 |
| 상태 관리 | React 기본 (fetch + router.refresh) | 단일 페이지 CRUD, SWR/TanStack Query 수준의 캐싱 불필요 |
| 토스트 | sonner | shadcn 공식 토스트 솔루션 |
| 파일 카드 토글 | Collapsible | shadcn Collapsible로 접기/펼치기 구현 |
| DB | Prisma + SQLite | spec 요구사항 그대로 |

## Required Skills

| 스킬 | 용도 |
|------|------|
| `vercel-react-best-practices` | React/Next.js 성능 최적화 규칙 |
| `web-design-guidelines` | Web Interface Guidelines 준수 |
| `shadcn` | UI 컴포넌트 사용 규칙 |

## UI Components

### 설치 필요

| 컴포넌트 | 설치 명령 |
|----------|-----------|
| Progress | `bunx --bun shadcn@latest add @shadcn/progress` |
| Collapsible | `bunx --bun shadcn@latest add @shadcn/collapsible` |
| Sonner | `bunx --bun shadcn@latest add @shadcn/sonner` |

### 기존 설치 (사용)

| 컴포넌트 | 용도 |
|----------|------|
| Card | 요약 카드, 파일 카드 |
| Button | 파일 업로드 버튼 |
| Checkbox | 함수 체크/언체크 |

### 커스텀 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| `DashboardSummary` | 파일 수·함수 수·완료율 요약 카드 3개 + 전체 진행률 Progress Bar |
| `FileCard` | Collapsible 파일 카드 (헤더 + Progress + chevron-right/down 토글 아이콘 + 함수 목록) |
| `FunctionList` | 클래스/프로토콜별 함수 그룹 + Checkbox |
| `FileUploadButton` | hidden input + Button 래퍼 |

## 실행 프로토콜

- 각 task 시작 전, **참조 규칙**에 나열된 파일을 반드시 읽고 규칙을 준수하며 구현한다

## Tasks

### Task 0: Prisma + SQLite 스키마 설정

- **시나리오**: 전체 (선행 작업 — DB가 없으면 Route Handler 구현 불가)
- **참조 규칙**: Prisma 공식 문서
- **구현 대상**:
  - `prisma/schema.prisma` — File, Function 모델
  - SQLite DB 파일 설정
  - `lib/prisma.ts` — Prisma client 싱글턴
- **수용 기준**:
  - [ ] `bunx prisma db push` 성공
  - [ ] File 모델: id, name, createdAt
  - [ ] Function 모델: id, name, className, fileId(FK), completed(boolean)
- **커밋**: `chore: Prisma + SQLite 스키마 초기 설정`

---

### Task 1: spec 테스트 생성

- **시나리오**: MIGRATE-001 ~ MIGRATE-011
- **참조 규칙**: `CLAUDE.md` (spec 테스트 작성 규칙), `artifacts/spec.yaml`
- **구현 대상**:
  - `__tests__/migration-board.spec.test.tsx` — 11개 시나리오의 수용 기준 테스트
- **수용 기준**:
  - [ ] 각 시나리오별 describe 블록 존재 (MIGRATE-001 ~ 011)
  - [ ] getByRole, getByLabelText 등 안정적 셀렉터 사용
  - [ ] `bun run test` 실행 시 테스트가 실패 상태 (Red)
- **커밋**: `test: Migration Board spec 테스트 생성 (MIGRATE-001~011)`

---

### Task 2: shadcn 컴포넌트 설치

- **시나리오**: 전체 (선행 작업 — UI 컴포넌트 의존성)
- **참조 규칙**: `.claude/skills/shadcn/SKILL.md`, `.claude/skills/shadcn/rules/composition.md`
- **구현 대상**:
  - `components/ui/progress.tsx`
  - `components/ui/collapsible.tsx`
  - `components/ui/sonner.tsx`
  - `app/layout.tsx`에 `<Toaster />` 추가
- **수용 기준**:
  - [ ] `bunx --bun shadcn@latest add @shadcn/progress @shadcn/collapsible @shadcn/sonner` 성공
  - [ ] `<Toaster />` 가 layout.tsx에 포함
- **커밋**: `chore: shadcn Progress, Collapsible, Sonner 설치`

---

### Task 3: 파일 파서 구현 (Swift + ObjC)

- **시나리오**: MIGRATE-002, 003, 010
- **참조 규칙**: `.claude/skills/vercel-react-best-practices/SKILL.md` (js-hoist-regexp)
- **구현 대상**:
  - `lib/parsers/swift-parser.ts` — Swift 파일에서 class/protocol/func 추출
  - `lib/parsers/objc-parser.ts` — ObjC .m/.h 파일에서 @interface/@protocol/메서드 추출
  - `lib/parsers/index.ts` — 확장자별 파서 라우팅
  - `__tests__/parsers.test.tsx` — 파서 단위 테스트
- **수용 기준**:
  - [ ] Swift 입력: `class HomeViewModel { func loadData() {} func refresh() {} }` → `{ className: "HomeViewModel", functions: ["loadData", "refresh"] }`
  - [ ] ObjC 입력: `@interface NetworkManager - (void)fetchData {} @end` → `{ className: "NetworkManager", functions: ["fetchData"] }`
  - [ ] .h 파일 메서드 선언(세미콜론 종료)도 파싱
  - [ ] 지원하지 않는 확장자 → 에러 throw
- **커밋**: `feat: Swift/ObjC 파일 파서 구현`

---

### Task 4: Route Handler (파일 업로드 + 함수 체크 API)

- **시나리오**: MIGRATE-002, 003, 005, 007, 008, 010
- **참조 규칙**: `.claude/skills/vercel-react-best-practices/SKILL.md` (async-parallel, server-auth-actions)
- **구현 대상**:
  - `app/api/files/route.ts` — GET(파일 목록), POST(업로드 + 파싱 + 저장)
  - `app/api/functions/[id]/route.ts` — PATCH(체크/언체크 토글)
- **수용 기준**:
  - [ ] POST `/api/files` + Swift 파일 → 201, 파일+함수 DB 저장
  - [ ] POST `/api/files` + 중복 파일명 → 409, `"이미 등록된 파일입니다"`
  - [ ] POST `/api/files` + .py 파일 → 400, `"지원하지 않는 파일 형식입니다"`
  - [ ] PATCH `/api/functions/:id` → completed 토글
  - [ ] GET `/api/files` → 파일 목록 + 함수 목록 + 완료 상태
- **커밋**: `feat: 파일 업로드 및 함수 체크 API Route Handler`

---

### Task 5: 대시보드 UI 구현

- **시나리오**: MIGRATE-001, 004, 005, 006, 009, 011
- **의존**: Task 0, 2, 4 (DB, UI 컴포넌트, API가 준비되어야 체크/갱신 동작 검증 가능)
- **참조 규칙**: `.claude/skills/shadcn/rules/styling.md`, `.claude/skills/shadcn/rules/composition.md`, `.claude/skills/shadcn/rules/icons.md`, `.claude/skills/vercel-react-best-practices/SKILL.md` (rerender-no-inline-components, bundle-barrel-imports)
- **구현 대상**:
  - `app/migration/page.tsx` — 대시보드 페이지 (Server Component, GET /api/files 호출)
  - `components/migration/dashboard-summary.tsx` — 요약 카드 3개 (Card) + 전체 진행률 Progress Bar ("N / M 완료" 레이블)
  - `components/migration/file-card.tsx` — Collapsible 파일 카드 + Progress + `file-code` 아이콘 + chevron-right(접힘)/chevron-down(확장) 토글 아이콘
  - `components/migration/function-list.tsx` — 클래스별 함수 그룹 + Checkbox (PATCH API 호출)
  - `components/migration/file-upload-button.tsx` — UI 껍데기만 (hidden input + Button + `upload` 아이콘, API 연동은 Task 6)
  - `components/migration/empty-state.tsx` — 빈 상태 안내 (`file-code` 아이콘)
- **수용 기준**:
  - [ ] 파일 0개 → "등록된 파일이 없습니다" + "파일 업로드" 버튼 표시
  - [ ] 요약 영역에 파일 수, 함수 수, 완료율 + 전체 진행률 바 ("N / M 완료") 표시
  - [ ] 파일 카드에 `file-code` 아이콘 표시
  - [ ] 접힌 카드: chevron-right 아이콘 → 클릭 시 확장 + chevron-down 전환
  - [ ] 확장 시 클래스별 함수 목록 + Checkbox 표시
  - [ ] Checkbox 클릭 → 함수 체크/언체크 + Progress + 완료율 갱신
  - [ ] 완료율 소수점 없이 반올림 표시
  - [ ] 반응형: 요약 카드 3칼럼 → 단일 칼럼
- **커밋**: `feat: Migration Board 대시보드 UI 구현`

---

### Task 6: 파일 업로드 + 에러 처리 통합

- **시나리오**: MIGRATE-002, 003, 007, 008, 010
- **의존**: Task 4, 5 (API + UI 껍데기가 준비되어야 연동 가능)
- **참조 규칙**: `.claude/skills/shadcn/rules/composition.md` (sonner toast), `.claude/skills/vercel-react-best-practices/SKILL.md` (rendering-usetransition-loading)
- **구현 대상**:
  - `components/migration/file-upload-button.tsx` — Task 5의 UI 껍데기에 POST /api/files 호출 + sonner toast 피드백 추가
  - 업로드 성공 시 파일 목록 갱신 (router.refresh)
  - 에러 시 sonner `toast.error()` 호출 (sonner 기본 닫기 버튼 포함)
- **수용 기준**:
  - [ ] .swift 파일 업로드 → 카드 추가 + 요약 갱신
  - [ ] .m 파일 업로드 → 카드 추가 + 요약 갱신
  - [ ] .h 파일 업로드 → 카드 추가 + 요약 갱신
  - [ ] 중복 파일 → "이미 등록된 파일입니다" toast (닫기 가능)
  - [ ] .py 파일 → "지원하지 않는 파일 형식입니다" toast (닫기 가능)
  - [ ] `bun run test` — 전체 spec 테스트 통과 (Green)
- **커밋**: `feat: 파일 업로드 통합 및 에러 토스트 처리`

---

## 미결정 사항

- 파싱 실패 시 처리 방식 (에러 표시 vs 부분 결과 표시)
- 파일 re-upload 시 기존 체크 상태 병합 여부
- 파일 크기 제한 (현재 미설정)
- 함수별 메모/코멘트 기능 추가 여부
