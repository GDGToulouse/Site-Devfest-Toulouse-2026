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

// Where a text search looks (#768): the name by default, the alt text and the
// tags' names only when asked.
export type FileSearchField = "name" | "alt" | "tags";

export interface ListedFile {
  filename: string;
  originalName: string | null;
  alt: string | null;
  ext: string;
  isImage: boolean;
  usages: unknown[];
  tags: { slug: string; name: string }[];
}

interface FileSearch {
  text: string;
  fields: FileSearchField[];
}

interface FilePageOptions {
  page: number;
  limit: number;
  type?: FileListType;
  // Lower-case extensions with their dot, e.g. [".pdf"].
  extensions?: string[];
  // A tag's slug, or "none" for the files without any (#373).
  tag?: string;
  search?: FileSearch;
}

// "Diagora" finds "photo-diagora.jpg", "securite" finds "Sécurité".
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matchesSearch(file: ListedFile, search: FileSearch | undefined): boolean {
  const needle = search && fold(search.text.trim());
  if (!needle) return true;
  const haystacks: string[] = [];
  // The stored name is a timestamp: the original one is what people remember,
  // and only files uploaded before #378 have none.
  if (search.fields.includes("name")) haystacks.push(file.originalName ?? file.filename);
  if (search.fields.includes("alt") && file.alt) haystacks.push(file.alt);
  if (search.fields.includes("tags")) haystacks.push(...file.tags.map((t) => t.name));
  return haystacks.some((h) => fold(h).includes(needle));
}

function matchesTag(file: ListedFile, tag: string | undefined): boolean {
  if (!tag) return true;
  if (tag === "none") return file.tags.length === 0;
  return file.tags.some((t) => t.slug === tag);
}

function matchesType(file: ListedFile, type: FileListType | undefined): boolean {
  if (type === "images") return file.isImage;
  if (type === "documents") return !file.isImage;
  if (type === "unused") return file.usages.length === 0;
  return true;
}

export function pageFiles<T extends ListedFile>(files: T[], options: FilePageOptions) {
  const allowed = options.extensions && new Set(options.extensions.map((e) => e.toLowerCase()));
  // The tab counts are over what the caller may see at all, before the tab: the
  // allowed extensions, the chosen tag and the search narrow the library itself.
  const visible = files.filter(
    (f) =>
      (!allowed || allowed.has(f.ext.toLowerCase())) &&
      matchesTag(f, options.tag) &&
      matchesSearch(f, options.search),
  );
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
