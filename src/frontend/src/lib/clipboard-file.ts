export type PastedFile = { kind: "file"; file: File } | { kind: "refused" } | null;

/**
 * The file a paste carries into a media picker, checked against what that
 * picker accepts (#372). Null when the clipboard holds no file — a text paste,
 * which the caller must let through, or pasting into the search and alt-text
 * fields would stop working. "refused" when it holds one of the wrong kind:
 * said at paste time, not after a failed upload.
 */
export function pastedFile(
  clipboard: DataTransfer,
  accept: { mimeTypes: string[]; extensions: string[] },
): PastedFile {
  const file = clipboard.files[0];
  if (!file) return null;
  const name = file.name.toLowerCase();
  const isAccepted = accept.mimeTypes.includes(file.type) || accept.extensions.some((ext) => name.endsWith(ext));
  return isAccepted ? { kind: "file", file } : { kind: "refused" };
}
