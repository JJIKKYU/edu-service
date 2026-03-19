import { describe, it, expect } from "vitest";
import { parseFile } from "@/lib/parsers";
import type { ParseResult } from "@/lib/parsers";

describe("parseFile", () => {
  describe("Swift parser", () => {
    it("extracts class name and functions from a Swift class", () => {
      const input = `class HomeViewModel { func loadData() {} func refresh() {} }`;
      const result = parseFile("HomeViewModel.swift", input);

      expect(result).toEqual<ParseResult>({
        groups: [
          {
            className: "HomeViewModel",
            functions: ["loadData", "refresh"],
          },
        ],
      });
    });

    it("extracts protocol name and functions", () => {
      const input = `protocol DataSource { func numberOfItems() -> Int func itemAt(index: Int) -> String }`;
      const result = parseFile("DataSource.swift", input);

      expect(result.groups[0].className).toBe("DataSource");
      expect(result.groups[0].functions).toEqual([
        "numberOfItems",
        "itemAt",
      ]);
    });

    it("handles multiple classes in one file", () => {
      const input = `class Foo { func a() {} } class Bar { func b() {} }`;
      const result = parseFile("multi.swift", input);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]).toEqual({
        className: "Foo",
        functions: ["a"],
      });
      expect(result.groups[1]).toEqual({
        className: "Bar",
        functions: ["b"],
      });
    });

    it("groups global functions under Global", () => {
      const input = `func helperA() {} class Foo { func a() {} } func helperB() {}`;
      const result = parseFile("file.swift", input);

      const globalGroup = result.groups.find((g) => g.className === "Global");
      expect(globalGroup).toBeDefined();
      expect(globalGroup!.functions).toEqual(["helperA", "helperB"]);
    });

    it("returns empty groups for empty Swift file", () => {
      const result = parseFile("empty.swift", "");
      expect(result.groups).toEqual([]);
    });
  });

  describe("ObjC parser", () => {
    it("extracts interface name and methods from .m file", () => {
      const input = `@interface NetworkManager\n- (void)fetchData {}\n- (void)cancelRequest {}\n@end`;
      const result = parseFile("NetworkManager.m", input);

      expect(result).toEqual<ParseResult>({
        groups: [
          {
            className: "NetworkManager",
            functions: ["fetchData", "cancelRequest"],
          },
        ],
      });
    });

    it("extracts interface name and methods from .h file with semicolons", () => {
      const input = `@interface NetworkManager\n- (void)fetchData;\n- (void)cancelRequest;\n@end`;
      const result = parseFile("NetworkManager.h", input);

      expect(result).toEqual<ParseResult>({
        groups: [
          {
            className: "NetworkManager",
            functions: ["fetchData", "cancelRequest"],
          },
        ],
      });
    });

    it("extracts ObjC protocol", () => {
      const input = `@protocol MyDelegate\n- (void)didFinish;\n+ (void)create;\n@end`;
      const result = parseFile("MyDelegate.h", input);

      expect(result.groups[0].className).toBe("MyDelegate");
      expect(result.groups[0].functions).toEqual(["didFinish", "create"]);
    });

    it("handles multiple interfaces in one file", () => {
      const input = `@interface A\n- (void)foo;\n@end\n@interface B\n- (void)bar;\n@end`;
      const result = parseFile("multi.m", input);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]).toEqual({
        className: "A",
        functions: ["foo"],
      });
      expect(result.groups[1]).toEqual({
        className: "B",
        functions: ["bar"],
      });
    });

    it("groups global ObjC methods under Global", () => {
      const input = `- (void)globalMethod {}\n@interface Foo\n- (void)bar;\n@end`;
      const result = parseFile("file.m", input);

      const globalGroup = result.groups.find((g) => g.className === "Global");
      expect(globalGroup).toBeDefined();
      expect(globalGroup!.functions).toEqual(["globalMethod"]);
    });
  });

  describe("Unsupported extensions", () => {
    it("throws for .py files", () => {
      expect(() => parseFile("main.py", "def foo(): pass")).toThrow(
        "지원하지 않는 파일 형식입니다"
      );
    });

    it("throws for .java files", () => {
      expect(() => parseFile("Main.java", "class Main {}")).toThrow(
        "지원하지 않는 파일 형식입니다"
      );
    });

    it("throws for files with no extension", () => {
      expect(() => parseFile("Makefile", "all:")).toThrow(
        "지원하지 않는 파일 형식입니다"
      );
    });
  });
});
