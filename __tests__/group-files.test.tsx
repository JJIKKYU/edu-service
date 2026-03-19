import { describe, it, expect } from "vitest";
import { groupFiles } from "@/lib/group-files";

function makeFn(id: string, name: string, className: string, completed = false) {
  return { id, name, className, completed };
}

describe("groupFiles", () => {
  it("groups .h and .m files with same base name into one group", () => {
    const files = [
      {
        id: "1",
        name: "NetworkManager.h",
        functions: [
          makeFn("f1", "fetchData", "NetworkManager"),
          makeFn("f2", "cancelRequest", "NetworkManager"),
        ],
      },
      {
        id: "2",
        name: "NetworkManager.m",
        functions: [
          makeFn("f3", "fetchData", "NetworkManager"),
          makeFn("f4", "cancelRequest", "NetworkManager"),
        ],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("NetworkManager");
    expect(groups[0].files).toHaveLength(2);
    expect(groups[0].functions).toHaveLength(2);
    // .m functions should win over .h
    expect(groups[0].functions.map((f) => f.id).sort()).toEqual(["f3", "f4"]);
  });

  it("keeps .swift files as individual groups", () => {
    const files = [
      {
        id: "1",
        name: "HomeViewModel.swift",
        functions: [makeFn("f1", "loadData", "HomeViewModel")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("HomeViewModel.swift");
    expect(groups[0].files).toHaveLength(1);
  });

  it("handles solo .h file — keeps full filename", () => {
    const files = [
      {
        id: "1",
        name: "Utils.h",
        functions: [makeFn("f1", "helper", "Utils")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Utils.h");
    expect(groups[0].files).toHaveLength(1);
  });

  it("handles solo .m file — keeps full filename", () => {
    const files = [
      {
        id: "1",
        name: "Utils.m",
        functions: [makeFn("f1", "helper", "Utils")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Utils.m");
  });

  it("deduplicates functions keeping .m version", () => {
    const files = [
      {
        id: "1",
        name: "Foo.h",
        functions: [
          makeFn("h1", "bar", "Foo"),
          makeFn("h2", "onlyInHeader", "Foo"),
        ],
      },
      {
        id: "2",
        name: "Foo.m",
        functions: [makeFn("m1", "bar", "Foo")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].functions).toHaveLength(2);
    // "bar" should be from .m (m1), "onlyInHeader" from .h (h2)
    const ids = groups[0].functions.map((f) => f.id).sort();
    expect(ids).toEqual(["h2", "m1"]);
  });

  it("mixes .swift and .h/.m groups correctly", () => {
    const files = [
      {
        id: "1",
        name: "HomeViewModel.swift",
        functions: [makeFn("f1", "load", "HomeViewModel")],
      },
      {
        id: "2",
        name: "NetworkManager.h",
        functions: [makeFn("f2", "fetch", "NetworkManager")],
      },
      {
        id: "3",
        name: "NetworkManager.m",
        functions: [makeFn("f3", "fetch", "NetworkManager")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.displayName).sort()).toEqual([
      "HomeViewModel.swift",
      "NetworkManager",
    ]);
  });

  it("propagates tags as union across grouped files", () => {
    const files = [
      {
        id: "1",
        name: "NetworkManager.h",
        tags: "TCK",
        functions: [makeFn("f1", "fetch", "NetworkManager")],
      },
      {
        id: "2",
        name: "NetworkManager.m",
        tags: "CMP",
        functions: [makeFn("f2", "fetch", "NetworkManager")],
      },
    ];

    const groups = groupFiles(files);

    expect(groups).toHaveLength(1);
    expect(groups[0].tags.sort()).toEqual(["CMP", "TCK"]);
  });

  it("returns empty tags when files have no tags", () => {
    const files = [
      {
        id: "1",
        name: "HomeViewModel.swift",
        functions: [makeFn("f1", "load", "HomeViewModel")],
      },
    ];

    const groups = groupFiles(files);
    expect(groups[0].tags).toEqual([]);
  });

  it("preserves completed state through deduplication", () => {
    const files = [
      {
        id: "1",
        name: "A.h",
        functions: [makeFn("h1", "foo", "A", false)],
      },
      {
        id: "2",
        name: "A.m",
        functions: [makeFn("m1", "foo", "A", true)],
      },
    ];

    const groups = groupFiles(files);
    expect(groups[0].functions[0].completed).toBe(true);
    expect(groups[0].functions[0].id).toBe("m1");
  });
});
