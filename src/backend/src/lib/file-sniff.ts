// The type of a downloaded file, read from its bytes (#617). A remote server
// chooses its Content-Type header and the URL its extension: neither says what
// the file is. Only what the import accepts is recognised — the images of the
// media library and PDF. Office documents are left out: their signature (a zip
// or an OLE container) does not tell a deck from a spreadsheet, and the import
// is meant for logos and visuals.

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((b, i) => buffer[offset + i] === b);

export function sniffMime(buffer: Buffer): string | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (buffer.subarray(0, 6).toString("latin1") === "GIF87a" || buffer.subarray(0, 6).toString("latin1") === "GIF89a") {
    return "image/gif";
  }
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";

  // SVG is text: an optional BOM, XML declaration, comments or doctype, then
  // an <svg> root. Looking at the head only, as a browser would sniff it.
  const head = buffer.subarray(0, 4096).toString("utf8").replace(/^﻿/, "").trimStart();
  const withoutProlog = head.replace(/^(<\?xml[\s\S]*?\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[\s\S]*?>\s*)*/i, "");
  if (/^<svg[\s>]/i.test(withoutProlog)) return "image/svg+xml";

  return null;
}

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/x-icon": ".ico",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};
