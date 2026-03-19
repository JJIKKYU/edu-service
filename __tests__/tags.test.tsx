import { describe, it, expect } from "vitest";
import { serializeTags, parseTags } from "@/lib/tags";

describe("serializeTags", () => {
  it("sorts and joins tags", () => {
    expect(serializeTags(["CMP", "TCK"])).toBe("CMP,TCK");
  });

  it("deduplicates tags", () => {
    expect(serializeTags(["TCK", "TCK"])).toBe("TCK");
  });

  it("returns empty string for empty array", () => {
    expect(serializeTags([])).toBe("");
  });

  it("filters out invalid tags", () => {
    expect(serializeTags(["TCK", "INVALID" as never])).toBe("TCK");
  });
});

describe("parseTags", () => {
  it("parses comma-separated tags", () => {
    expect(parseTags("CMP,TCK")).toEqual(["CMP", "TCK"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("filters out invalid tags", () => {
    expect(parseTags("TCK,INVALID")).toEqual(["TCK"]);
  });

  it("parses single tag", () => {
    expect(parseTags("CMP")).toEqual(["CMP"]);
  });
});
