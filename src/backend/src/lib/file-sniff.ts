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

// Office documents, for the upload only: a zip (OOXML) or an OLE container
// (legacy formats) says which family, the file name's extension which member.
// The extension is kept only when it belongs to the family the bytes show, so
// a client cannot store anything else under a name it chose.
const OOXML_MIME_BY_EXTENSION: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const OLE_MIME_BY_EXTENSION: Record<string, string> = {
  ".doc": "application/msword",
  ".ppt": "application/vnd.ms-powerpoint",
  ".xls": "application/vnd.ms-excel",
};

export function sniffOfficeDocument(buffer: Buffer, ext: string): { mimetype: string; ext: string } | null {
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && OOXML_MIME_BY_EXTENSION[ext]) {
    return { mimetype: OOXML_MIME_BY_EXTENSION[ext], ext };
  }
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && OLE_MIME_BY_EXTENSION[ext]) {
    return { mimetype: OLE_MIME_BY_EXTENSION[ext], ext };
  }
  return null;
}
