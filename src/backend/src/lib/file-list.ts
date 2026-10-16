// One page of the media library (#416). The library lives on disk, not in a
// table, so the listing still reads every file: what paging saves is the
// payload and, above all, the browser rendering one thumbnail per file. Kept
// apart from the route so the filtering and counting are testable without a
// filesystem.

export const FILE_PAGE_SIZE = 48;
// A guard well above any page a screen asks for, so a client cannot ask for the
// whole library one page at a time pretending it is a page.
const FILE_PAGE_SIZE_MAX = 200;

export type FileListType = "images" | "documents" | "unused";

export interface ListedFile {
  ext: string;
  isImage: boolean;
  usages: unknown[];
}

interface FilePageOptions {
  page: number;
  limit: number;
  type?: FileListType;
  // Lower-case extensions with their dot, e.g. [".pdf"].
  extensions?: string[];
}

function matchesType(file: ListedFile, type: FileListType | undefined): boolean {
  if (type === "images") return file.isImage;
  if (type === "documents") return !file.isImage;
  if (type === "unused") return file.usages.length === 0;
  return true;
}

export function pageFiles<T extends ListedFile>(files: T[], options: FilePageOptions) {
  const allowed = options.extensions && new Set(options.extensions.map((e) => e.toLowerCase()));
  // The tab counts are over what the caller may see at all, before the tab.
  const visible = allowed ? files.filter((f) => allowed.has(f.ext.toLowerCase())) : files;
  const matching = visible.filter((f) => matchesType(f, options.type));

  const page = Math.max(1, options.page);
  const limit = Math.min(FILE_PAGE_SIZE_MAX, Math.max(1, options.limit));
  return {
    page,
    limit,
    total: matching.length,
    counts: {
      all: visible.length,
      images: visible.filter((f) => f.isImage).length,
      documents: visible.filter((f) => !f.isImage).length,
      unused: visible.filter((f) => f.usages.length === 0).length,
    },
    items: matching.slice((page - 1) * limit, page * limit),
  };
}
