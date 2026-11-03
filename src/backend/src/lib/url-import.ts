import type { FastifyBaseLogger, FastifyReply } from "fastify";

import { fetchRemoteFile, RemoteFetchError, type RemoteFetchErrorCode } from "./safe-fetch.js";
import { EXTENSION_BY_MIME, sniffMime } from "./file-sniff.js";
import { UnsafeSvgError } from "./image-store.js";
import { storeUpload, type StoredUpload } from "./upload-store.js";
import { rememberOriginalName } from "./file-metadata.js";
import { isLocalUpload } from "./speaker-photo.js";

// Importing a file someone gave by its address (#617): the media library's
// import by URL, and since #687 the photo or logo pasted in the speaker edit
// link and the sponsor space. One path for all of them: the download through
// fetchRemoteFile (SSRF guarded hop by hop, capped while it reads), the type
// read from the bytes, and the upload's own store (SVG sanitising included).

export type UrlImportErrorCode = RemoteFetchErrorCode | "unsupported_type" | "unsafe_svg";

// Why an import was refused, in the editor's words: what happened and what to
// do, not the code (#394). `too_large` and `unsupported_type` depend on the
// caller's limits, so they are built from its options.
const FETCH_REFUSALS: Record<RemoteFetchErrorCode, { status: number; message: string }> = {
  invalid_url: { status: 400, message: "Cette adresse n'est pas une URL valide." },
  invalid_protocol: { status: 400, message: "Seules les adresses http:// et https:// sont acceptées." },
  internal_hostname: { status: 400, message: "Cette adresse pointe vers le réseau interne : elle est refusée." },
  private_ip: { status: 400, message: "Cette adresse pointe vers un réseau privé : elle est refusée." },
  too_many_redirects: { status: 400, message: "Cette adresse redirige trop de fois. Donnez l'adresse finale du fichier." },
  http_error: { status: 502, message: "Le site distant n'a pas fourni le fichier. Vérifiez l'adresse." },
  too_large: { status: 413, message: "" },
  timeout: { status: 504, message: "Le site distant n'a pas répondu à temps. Réessayez plus tard." },
  empty: { status: 502, message: "Le site distant a renvoyé un fichier vide." },
  network: { status: 502, message: "Le site distant est injoignable. Vérifiez l'adresse." },
};

export class UrlImportError extends Error {
  constructor(
    readonly code: UrlImportErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "UrlImportError";
  }
}

export interface UrlImportOptions {
  maxBytes: number;
  allowedMimes: ReadonlySet<string> | readonly string[];
  // Names what the caller accepts, e.g. "Ce fichier n'est pas une image (JPEG, PNG…)."
  unsupportedMessage: string;
  log: FastifyBaseLogger;
}

export interface UrlImport {
  url: string;
  filename: string;
  originalName: string | null;
  mimetype: string;
  stored: StoredUpload;
}

/** Download a file and store it under /uploads/. Throws UrlImportError with a readable message. */
export async function importFromUrl(rawUrl: string, options: UrlImportOptions): Promise<UrlImport> {
  const { maxBytes, unsupportedMessage, log } = options;
  const allowed = new Set(options.allowedMimes);

  let downloaded: { buffer: Buffer; url: URL };
  try {
    downloaded = await fetchRemoteFile(rawUrl.trim(), { maxBytes });
  } catch (err) {
    if (err instanceof RemoteFetchError) {
      const { status, message } = FETCH_REFUSALS[err.code];
      const text = err.code === "too_large" ? `Le fichier dépasse ${Math.round(maxBytes / 1_000_000)} Mo.` : message;
      throw new UrlImportError(err.code, status, text);
    }
    throw err;
  }

  // The bytes say what the file is, not the server's header nor the URL.
  const mimetype = sniffMime(downloaded.buffer);
  if (!mimetype || !allowed.has(mimetype)) {
    throw new UrlImportError("unsupported_type", 400, unsupportedMessage);
  }

  let stored: StoredUpload;
  try {
    stored = await storeUpload(downloaded.buffer, mimetype, EXTENSION_BY_MIME[mimetype], log);
  } catch (err) {
    if (err instanceof UnsafeSvgError) {
      throw new UrlImportError("unsafe_svg", 400, "Ce SVG ne contient rien d'affichable une fois les scripts retirés.");
    }
    throw err;
  }

  const url = `/uploads/${stored.filename}`;
  // The name the file had at its source (#378): the last segment of the path
  // it was finally served from.
  const originalName = decodeURIComponent(downloaded.url.pathname.split("/").filter(Boolean).pop() ?? "") || null;
  await rememberOriginalName(url, originalName ?? undefined);

  return { url, filename: stored.filename, originalName, mimetype, stored };
}

/**
 * The value to save for an image field given as a URL (#687): an address
 * elsewhere is imported and replaced by its /uploads/ path. Left as is: an
 * empty value (clearing), a path already under /uploads/, and the value already
 * stored — a form sends every field on each save, and fixing a bio must not
 * hinge on a third-party host still serving an old picture.
 */
export async function importImageField(
  value: string,
  current: string | null,
  options: UrlImportOptions,
): Promise<string> {
  const trimmed = value.trim();
  if (!trimmed || isLocalUpload(trimmed) || trimmed === current) return value;
  return (await importFromUrl(trimmed, options)).url;
}

/**
 * Refuse a profile save whose image could not be imported (#687). One status
 * for every cause: the form shows the message next to the field and keeps
 * what the person typed, whatever the remote site did.
 */
export function sendImportRefusal(reply: FastifyReply, err: UrlImportError, field: string) {
  return reply.code(422).send({ error: "image_import_failed", reason: err.code, field, message: err.message });
}
