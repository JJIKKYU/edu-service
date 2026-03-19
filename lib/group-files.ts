import { parseTags } from "./tags";

interface FunctionItem {
  id: string;
  name: string;
  className: string;
  completed: boolean;
}

interface FileRecord {
  id: string;
  name: string;
  tags?: string;
  functions: FunctionItem[];
}

export interface FileGroup {
  key: string;
  displayName: string;
  files: Array<{ id: string; name: string }>;
  functions: FunctionItem[];
  tags: string[];
}

const OBJC_EXTENSIONS = [".h", ".m"];

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex);
}

function getBaseName(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? filename : filename.slice(0, dotIndex);
}

function deduplicateFunctions(functions: FunctionItem[]): FunctionItem[] {
  const seen = new Map<string, FunctionItem>();
  for (const fn of functions) {
    const key = `${fn.className}:${fn.name}`;
    // Later entries (from .m) overwrite earlier (.h) entries
    seen.set(key, fn);
  }
  return Array.from(seen.values());
}

export function groupFiles(files: FileRecord[]): FileGroup[] {
  // First pass: collect ObjC files by base name to detect pairs
  const objcByBase = new Map<string, FileRecord[]>();
  for (const file of files) {
    const ext = getExtension(file.name);
    if (OBJC_EXTENSIONS.includes(ext)) {
      const base = getBaseName(file.name);
      const list = objcByBase.get(base) || [];
      list.push(file);
      objcByBase.set(base, list);
    }
  }

  const groups = new Map<string, FileGroup>();

  // Sort so .h comes before .m — ensures .m overwrites .h in dedup
  const sorted = [...files].sort((a, b) => {
    const extA = getExtension(a.name);
    const extB = getExtension(b.name);
    if (extA === ".h" && extB === ".m") return -1;
    if (extA === ".m" && extB === ".h") return 1;
    return 0;
  });

  for (const file of sorted) {
    const ext = getExtension(file.name);
    const baseName = getBaseName(file.name);
    const isObjC = OBJC_EXTENSIONS.includes(ext);
    const hasPair = isObjC && (objcByBase.get(baseName)?.length ?? 0) > 1;

    // Only group if there's a matching .h/.m pair
    const key = hasPair ? baseName : file.name;
    const displayName = hasPair ? baseName : file.name;

    const existing = groups.get(key);
    const fileTags = parseTags(file.tags ?? "");

    if (existing) {
      existing.files.push({ id: file.id, name: file.name });
      existing.functions = deduplicateFunctions([
        ...existing.functions,
        ...file.functions,
      ]);
      existing.tags = [...new Set([...existing.tags, ...fileTags])];
    } else {
      groups.set(key, {
        key,
        displayName,
        files: [{ id: file.id, name: file.name }],
        functions: [...file.functions],
        tags: [...fileTags],
      });
    }
  }

  return Array.from(groups.values());
}
