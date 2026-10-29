import path from "node:path";

import type { FastifyStaticOptions } from "@fastify/static";

import { UPLOADS_PREFIX } from "./rate-limit-options.js";

// What /uploads/ may do once a file is opened directly (#671). Files are
// sniffed before storage (#617) and SVG is sanitized (#346), but /uploads/ is
// served same-origin and without authentication: whatever slipped past those
// checks, or predates them, must stay inert.

// Pixels only: a browser shows them, never runs them.
const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".ico"]);

// Office documents: no browser renders them, so a download is all they ever
// were. `attachment` keeps it that way whatever a browser learns to sniff.
const DOCUMENT_EXTENSIONS = new Set([".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);

const SVG_EXTENSION = ".svg";
const PDF_EXTENSION = ".pdf";

/** Every extension /uploads/ serves; anything else answers 404. */
export const SERVED_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  ...RASTER_EXTENSIONS,
  SVG_EXTENSION,
  PDF_EXTENSION,
  ...DOCUMENT_EXTENSIONS,
]);

// No script, no plugin, no form, no same-origin access: the document is
// dropped into an opaque origin.
const SANDBOX_CSP = "sandbox";
// An SVG still has to draw its own inline styles when opened in a tab.
const SVG_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'";

function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/** Is this file one /uploads/ serves at all? Judged on the extension alone. */
export function isServedUpload(filePath: string): boolean {
  return SERVED_UPLOAD_EXTENSIONS.has(extensionOf(filePath));
}

/**
 * Headers a served upload carries on top of the static plugin's own.
 *
 * - Raster images: `nosniff` only.
 * - SVG: sandboxed — served with its native type, it would run script in our
 *   origin (#346). Still renders inline (an `<img>` ignores the CSP anyway).
 * - Office documents: sandboxed and downloaded, never rendered.
 * - PDF: inline, without `sandbox`. The sponsor brochure is opened in a tab
 *   (the e-mail link of /api/brochure/:token redirects to it), and Chrome
 *   refuses to load its PDF viewer in a sandboxed document. A PDF cannot run
 *   script in our origin through the browsers' built-in viewers, so `nosniff`
 *   is what keeps a disguised file from being read as HTML.
 */
export function uploadHeaders(filePath: string): Record<string, string> {
  const ext = extensionOf(filePath);
  const headers: Record<string, string> = { "X-Content-Type-Options": "nosniff" };
  if (ext === SVG_EXTENSION) {
    headers["Content-Security-Policy"] = SVG_CSP;
  } else if (!RASTER_EXTENSIONS.has(ext) && ext !== PDF_EXTENSION) {
    // Sandboxed by default: a type added to the served list without a
    // decision here gets the strict treatment.
    headers["Content-Security-Policy"] = SANDBOX_CSP;
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) headers["Content-Disposition"] = "attachment";
  return headers;
}

/** `@fastify/static` options for /uploads/, shared with the tests. */
export function uploadsStaticOptions(root: string): FastifyStaticOptions {
  return {
    root,
    prefix: UPLOADS_PREFIX,
    decorateReply: false,
    // Uploaded files are content-addressed by name (`${Date.now()}-${random}.ext`,
    // see routes/admin/files.ts): a given URL never changes content, so it can be
    // cached hard and forever. Without this, a 3 MB hero image was re-downloaded
    // on every visit (#197).
    maxAge: "365d",
    immutable: true,
    allowedPath: (pathName) => isServedUpload(pathName),
    setHeaders: (reply, filePath) => {
      for (const [name, value] of Object.entries(uploadHeaders(filePath))) {
        reply.header(name, value);
      }
    },
  };
}
