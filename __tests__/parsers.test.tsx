import { describe, it, expect } from "vitest";
import { parseFile } from "@/lib/parsers";
import type { ParseResult } from "@/lib/parsers";

describe("parseFile", () => {
  describe("Swift parser", () => {
    it("extracts class symbols from a Swift class", () => {
      const input = `
        class HomeViewModel {
          let title = ""
          var count = 0
          enum State { case idle }
          func loadData() {}
          func refresh() {}
        }
      `;
      const result = parseFile("HomeViewModel.swift", input);

      expect(result).toEqual<ParseResult>({
        groups: [
          {
            className: "HomeViewModel",
            symbols: [
              { name: "loadData", kind: "function" },
              { name: "refresh", kind: "function" },
              { name: "title", kind: "variable" },
              { name: "count", kind: "variable" },
              { name: "State", kind: "variable" },
            ],
          },
        ],
      });
    });

    it("extracts protocol functions", () => {
      const input = `protocol DataSource { func numberOfItems() -> Int func itemAt(index: Int) -> String }`;
      const result = parseFile("DataSource.swift", input);

      expect(result.groups[0].className).toBe("DataSource");
      expect(result.groups[0].symbols).toEqual([
        { name: "numberOfItems", kind: "function" },
        { name: "itemAt", kind: "function" },
      ]);
    });

    it("handles multiple classes in one file", () => {
      const input = `class Foo { func a() {} } class Bar { let value = 1 func b() {} }`;
      const result = parseFile("multi.swift", input);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]).toEqual({
        className: "Foo",
        symbols: [{ name: "a", kind: "function" }],
      });
      expect(result.groups[1]).toEqual({
        className: "Bar",
        symbols: [
          { name: "b", kind: "function" },
          { name: "value", kind: "variable" },
        ],
      });
    });

    it("groups global symbols under Global", () => {
      const input = `let apiKey = ""\nfunc helperA() {}\nclass Foo { func a() {} }\nenum AppMode { case prod }\nfunc helperB() {}`;
      const result = parseFile("file.swift", input);

      const globalGroup = result.groups.find((g) => g.className === "Global");
      expect(globalGroup).toBeDefined();
      expect(globalGroup!.symbols).toEqual([
        { name: "helperA", kind: "function" },
        { name: "helperB", kind: "function" },
        { name: "apiKey", kind: "variable" },
        { name: "AppMode", kind: "variable" },
      ]);
    });

    it("returns empty groups for empty Swift file", () => {
      const result = parseFile("empty.swift", "");
      expect(result.groups).toEqual([]);
    });
  });

  describe("ObjC parser", () => {
    it("extracts interface symbols from .m file", () => {
      const input = `
        @interface NetworkManager
        @property (nonatomic, strong) NSString *token;
        - (void)fetchData {}
        - (void)cancelRequest {}
        @end
      `;
      const result = parseFile("NetworkManager.m", input);

      expect(result).toEqual<ParseResult>({
        groups: [
          {
            className: "NetworkManager",
            symbols: [
              { name: "fetchData", kind: "function" },
              { name: "cancelRequest", kind: "function" },
              { name: "token", kind: "variable" },
            ],
          },
        ],
      });
    });

    it("extracts ObjC protocol functions", () => {
      const input = `@protocol MyDelegate\n- (void)didFinish;\n+ (void)create;\n@end`;
      const result = parseFile("MyDelegate.h", input);

      expect(result.groups[0].className).toBe("MyDelegate");
      expect(result.groups[0].symbols).toEqual([
        { name: "didFinish", kind: "function" },
        { name: "create", kind: "function" },
      ]);
    });

    it("handles multiple interfaces in one file", () => {
      const input = `@interface A\n- (void)foo;\n@end\n@interface B\n@property (nonatomic) NSInteger count;\n- (void)bar;\n@end`;
      const result = parseFile("multi.m", input);

      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]).toEqual({
        className: "A",
        symbols: [{ name: "foo", kind: "function" }],
      });
      expect(result.groups[1]).toEqual({
        className: "B",
        symbols: [
          { name: "bar", kind: "function" },
          { name: "count", kind: "variable" },
        ],
      });
    });

    it("groups global ObjC symbols under Global", () => {
      const input = `
        typedef NS_ENUM(NSInteger, AppMode) { AppModeA };
        - (void)globalMethod {}
        @interface Foo
        - (void)bar;
        @end
      `;
      const result = parseFile("file.m", input);

      const globalGroup = result.groups.find((g) => g.className === "Global");
      expect(globalGroup).toBeDefined();
      expect(globalGroup!.symbols).toEqual([
        { name: "globalMethod", kind: "function" },
        { name: "AppMode", kind: "variable" },
      ]);
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
