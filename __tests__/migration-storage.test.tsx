import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureStoredFiles,
  loadStoredFiles,
  MIGRATION_STORAGE_KEY,
} from "@/lib/migration-storage";

describe("migration-storage", () => {
  beforeEach(() => {
    window.localStorage.removeItem(MIGRATION_STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.removeItem(MIGRATION_STORAGE_KEY);
  });

  it("seeds sample files when storage is empty in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const files = ensureStoredFiles();

    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => file.name)).toContain("HomeViewModel.swift");
    expect(loadStoredFiles()).toHaveLength(files.length);
  });

  it("does not seed sample files when running tests", () => {
    vi.stubEnv("NODE_ENV", "test");

    const files = ensureStoredFiles();

    expect(files).toEqual([]);
    expect(loadStoredFiles()).toEqual([]);
  });
});
