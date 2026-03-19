import "server-only";

import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, posix, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type GitDiffSummary = {
  changedFiles: number;
  matchedCandidates: number;
  newlyCompletedSymbols: number;
  warnings: string[];
};

export type GitDiffRequest = {
  repoPath: string;
  baselineCommit: string;
  candidatePaths: string[];
};

export type GitDiffResponse = {
  changedPaths: string[];
  matchedCandidatePaths: string[];
  warnings: string[];
  summary: GitDiffSummary;
};

export type RepoPathRequest = {
  repoPath: string;
};

export type RepoFileRequest = {
  repoPath: string;
  relativePath: string;
};

class GitAutomationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "GitAutomationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniq<T>(values: T[]) {
  return [...new Set(values)];
}

function isInsideRoot(path: string, root: string) {
  return path === root || path.startsWith(`${root}/`);
}

export function isGitAutomationError(error: unknown): error is GitAutomationError {
  return error instanceof GitAutomationError;
}

export function isLocalGitAutomationEnabled() {
  return (
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    !process.env.VERCEL &&
    process.env.ENABLE_LOCAL_GIT_AUTOMATION !== "false"
  );
}

function assertLocalGitAutomationEnabled() {
  if (!isLocalGitAutomationEnabled()) {
    throw new GitAutomationError(
      "로컬 개발 환경에서만 Git 자동화를 사용할 수 있습니다",
      403
    );
  }
}

function normalizeRepoRelativePath(filePath: string) {
  const trimmedPath = filePath.trim().replace(/\\/g, "/");
  const normalizedPath = posix.normalize(trimmedPath).replace(/^\.\/+/, "");

  if (!trimmedPath || !normalizedPath || normalizedPath === ".") {
    throw new GitAutomationError("비어 있는 파일 경로는 허용되지 않습니다", 400);
  }

  if (
    isAbsolute(trimmedPath) ||
    /^[A-Za-z]:\//.test(trimmedPath) ||
    posix.isAbsolute(normalizedPath) ||
    normalizedPath.startsWith("../")
  ) {
    throw new GitAutomationError("repo 기준 상대 경로만 허용됩니다", 400);
  }

  return normalizedPath;
}

async function runGit(args: string[], cwd: string) {
  try {
    return await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4,
    });
  } catch (error) {
    const gitError = error as NodeJS.ErrnoException & { stderr?: string };
    throw new GitAutomationError(
      gitError.stderr?.trim() || gitError.message || "Git 명령 실행에 실패했습니다",
      400
    );
  }
}

async function resolveRepoRoot(repoPath: string) {
  if (!isAbsolute(repoPath)) {
    throw new GitAutomationError("repoPath는 절대 경로여야 합니다", 400);
  }

  const candidatePath = resolve(repoPath);
  const candidateStats = await stat(candidatePath).catch(() => null);
  if (!candidateStats?.isDirectory()) {
    throw new GitAutomationError("repoPath가 유효한 디렉터리가 아닙니다", 400);
  }

  const repoRealPath = await realpath(candidatePath).catch(() => candidatePath);
  const { stdout } = await runGit(["rev-parse", "--show-toplevel"], repoRealPath).catch(() => {
    throw new GitAutomationError("repoPath가 Git 저장소가 아닙니다", 400);
  });

  return realpath(stdout.trim()).catch(() => stdout.trim());
}

async function assertCommitExists(repoRoot: string, baselineCommit: string) {
  await runGit(["rev-parse", "--verify", `${baselineCommit}^{commit}`], repoRoot).catch(() => {
    throw new GitAutomationError("기준 커밋을 찾을 수 없습니다", 400);
  });
}

async function classifyCandidatePaths(repoRoot: string, candidatePaths: string[]) {
  const warnings: string[] = [];
  const validCandidatePaths: string[] = [];

  for (const candidatePath of uniq(candidatePaths.map(normalizeRepoRelativePath))) {
    const absolutePath = resolve(repoRoot, candidatePath);
    if (!isInsideRoot(absolutePath, repoRoot)) {
      throw new GitAutomationError("허용되지 않는 candidate path가 포함되어 있습니다", 400);
    }

    const fileStats = await stat(absolutePath).catch(() => null);
    if (!fileStats) {
      warnings.push(`후보 파일을 찾을 수 없습니다: ${candidatePath}`);
      continue;
    }

    if (!fileStats.isFile()) {
      warnings.push(`후보 경로가 파일이 아닙니다: ${candidatePath}`);
      continue;
    }

    const realFilePath = await realpath(absolutePath).catch(() => null);
    if (!realFilePath || !isInsideRoot(realFilePath, repoRoot)) {
      warnings.push(`후보 파일 경로가 repo 밖을 가리킵니다: ${candidatePath}`);
      continue;
    }

    const readable = await access(absolutePath, fsConstants.R_OK)
      .then(() => true)
      .catch(() => false);
    if (!readable) {
      warnings.push(`후보 파일을 읽을 수 없습니다: ${candidatePath}`);
      continue;
    }

    validCandidatePaths.push(candidatePath);
  }

  return { validCandidatePaths, warnings };
}

async function getChangedPathsFromRepoRoot(repoRoot: string, baselineCommit: string) {
  await assertCommitExists(repoRoot, baselineCommit);

  const { stdout } = await runGit(
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", `${baselineCommit}..HEAD`],
    repoRoot
  );

  return uniq(
    stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(normalizeRepoRelativePath)
  );
}

export function parseRepoPathRequestBody(body: unknown): RepoPathRequest {
  if (!isRecord(body)) {
    throw new GitAutomationError("요청 본문은 JSON object여야 합니다", 400);
  }

  const repoPath = typeof body.repoPath === "string" ? body.repoPath.trim() : "";
  if (!repoPath) {
    throw new GitAutomationError("repoPath는 필수 문자열입니다", 400);
  }

  return { repoPath };
}

export function parseRepoFileRequestBody(body: unknown): RepoFileRequest {
  if (!isRecord(body)) {
    throw new GitAutomationError("요청 본문은 JSON object여야 합니다", 400);
  }

  const repoPath = typeof body.repoPath === "string" ? body.repoPath.trim() : "";
  const relativePath =
    typeof body.relativePath === "string" ? body.relativePath.trim() : "";

  if (!repoPath) {
    throw new GitAutomationError("repoPath는 필수 문자열입니다", 400);
  }

  if (!relativePath) {
    throw new GitAutomationError("relativePath는 필수 문자열입니다", 400);
  }

  return {
    repoPath,
    relativePath: normalizeRepoRelativePath(relativePath),
  };
}

export function parseGitDiffRequestBody(body: unknown): GitDiffRequest {
  if (!isRecord(body)) {
    throw new GitAutomationError("요청 본문은 JSON object여야 합니다", 400);
  }

  const repoPath = typeof body.repoPath === "string" ? body.repoPath.trim() : "";
  const baselineCommit =
    typeof body.baselineCommit === "string" ? body.baselineCommit.trim() : "";
  const { candidatePaths } = body;

  if (!repoPath) {
    throw new GitAutomationError("repoPath는 필수 문자열입니다", 400);
  }

  if (!baselineCommit) {
    throw new GitAutomationError("baselineCommit은 필수 문자열입니다", 400);
  }

  if (!Array.isArray(candidatePaths) || !candidatePaths.every((path) => typeof path === "string")) {
    throw new GitAutomationError("candidatePaths는 문자열 배열이어야 합니다", 400);
  }

  return {
    repoPath,
    baselineCommit,
    candidatePaths: candidatePaths.map(normalizeRepoRelativePath),
  };
}

export async function getRepoHeadCommit(repoPath: string) {
  assertLocalGitAutomationEnabled();
  const repoRoot = await resolveRepoRoot(repoPath);
  const { stdout } = await runGit(["rev-parse", "HEAD"], repoRoot);
  return stdout.trim();
}

export async function readRepoFile(repoPath: string, relativePath: string) {
  assertLocalGitAutomationEnabled();
  const repoRoot = await resolveRepoRoot(repoPath);
  const normalizedPath = normalizeRepoRelativePath(relativePath);
  const absolutePath = resolve(repoRoot, normalizedPath);

  if (!isInsideRoot(absolutePath, repoRoot)) {
    throw new GitAutomationError("허용되지 않는 파일 경로입니다", 400);
  }

  await access(absolutePath, fsConstants.R_OK).catch(() => {
    throw new GitAutomationError("파일을 읽을 수 없습니다", 400);
  });

  return {
    name: normalizedPath.split("/").pop() ?? normalizedPath,
    relativePath: normalizedPath,
    content: await readFile(absolutePath, "utf8"),
  };
}

export async function getChangedPathsSinceCommit(repoPath: string, baselineCommit: string) {
  assertLocalGitAutomationEnabled();
  const repoRoot = await resolveRepoRoot(repoPath);
  return getChangedPathsFromRepoRoot(repoRoot, baselineCommit);
}

export async function getGitDiffResult({
  repoPath,
  baselineCommit,
  candidatePaths,
}: GitDiffRequest): Promise<GitDiffResponse> {
  assertLocalGitAutomationEnabled();

  const repoRoot = await resolveRepoRoot(repoPath);
  const changedPaths = await getChangedPathsFromRepoRoot(repoRoot, baselineCommit);
  const { validCandidatePaths, warnings } = await classifyCandidatePaths(
    repoRoot,
    candidatePaths
  );
  const changedPathSet = new Set(changedPaths);
  const matchedCandidatePaths = validCandidatePaths.filter((candidatePath) =>
    changedPathSet.has(candidatePath)
  );

  return {
    changedPaths,
    matchedCandidatePaths,
    warnings,
    summary: {
      changedFiles: changedPaths.length,
      matchedCandidates: matchedCandidatePaths.length,
      newlyCompletedSymbols: 0,
      warnings,
    },
  };
}
