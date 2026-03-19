import { describe, it, expect } from "vitest";
import { groupFiles } from "@/lib/group-files";
import type { SymbolKind } from "@/lib/symbols";

function makeSymbol(
  id: string,
  name: string,
  className: string,
  kind: SymbolKind = "function",
  completed = false
) {
  return { id, name, className, kind, completed };
}

describe("groupFiles", () => {
  it("groups .h and .m files with same base name into one group", () => {
    const files = [
      {
        id: "1",
        name: "NetworkManager.h",
        symbols: [
          makeSymbol("f1", "fetchData", "NetworkManager"),
          makeSymbol("f2", "cancelRequest", "NetworkManager"),
        ],
      },
      {
        id: "2",
        name: "NetworkManager.m",
        symbols: [
          makeSymbol("f3", "fetchData", "NetworkManager"),
          makeSymbol("f4", "cancelRequest", "NetworkManager"),
        ],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("NetworkManager");
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].symbols).toHaveLength(2);
    expect(groups[0].symbols.map((symbol) => symbol.id).sort()).toEqual(["f3", "f4"]);
  });

  it("keeps .swift files as individual groups", () => {
    const files = [
      {
        id: "1",
        name: "HomeViewModel.swift",
        symbols: [makeSymbol("f1", "loadData", "HomeViewModel")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("HomeViewModel.swift");
    expect(groups[0].files).toHaveLength(1);
  });

  it("handles solo .h file", () => {
    const files = [
      {
        id: "1",
        name: "Utils.h",
        symbols: [makeSymbol("f1", "helper", "Utils")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Utils.h");
  });

  it("deduplicates symbols keeping .m version", () => {
    const files = [
      {
        id: "1",
        name: "Foo.h",
        symbols: [
          makeSymbol("h1", "bar", "Foo"),
          makeSymbol("h2", "status", "Foo", "variable"),
        ],
      },
      {
        id: "2",
        name: "Foo.m",
        symbols: [
          makeSymbol("m1", "bar", "Foo"),
          makeSymbol("m2", "status", "Foo", "variable"),
        ],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].symbols).toHaveLength(2);
    expect(groups[0].symbols.map((symbol) => symbol.id).sort()).toEqual(["m1", "m2"]);
  });

  it("keeps function and variable with same name as separate symbols", () => {
    const files = [
      {
        id: "1",
        name: "Foo.swift",
        symbols: [
          makeSymbol("f1", "status", "Foo", "function"),
          makeSymbol("v1", "status", "Foo", "variable"),
        ],
      },
    ];

    const groups = groupFiles(files);

    expect(groups[0].symbols).toHaveLength(2);
    expect(groups[0].symbols.map((symbol) => symbol.kind).sort()).toEqual([
      "function",
      "variable",
    ]);
  });

  it("propagates tags as union across grouped files", () => {
    const files = [
      {
        id: "1",
        name: "NetworkManager.h",
        tags: "TCK",
        symbols: [makeSymbol("f1", "fetch", "NetworkManager")],
      },
      {
        id: "2",
        name: "NetworkManager.m",
        tags: "CMP",
        symbols: [makeSymbol("f2", "fetch", "NetworkManager")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].tags.sort()).toEqual(["CMP", "TCK"]);
  });

  it("preserves completed state through deduplication", () => {
    const files = [
      {
        id: "1",
        name: "A.h",
        symbols: [makeSymbol("h1", "foo", "A", "function", false)],
      },
      {
        id: "2",
        name: "A.m",
        symbols: [makeSymbol("m1", "foo", "A", "function", true)],
      },
    ];

    const groups = groupFiles(files);
    expect(groups[0].symbols[0].completed).toBe(true);
    expect(groups[0].symbols[0].id).toBe("m1");
  });
});
