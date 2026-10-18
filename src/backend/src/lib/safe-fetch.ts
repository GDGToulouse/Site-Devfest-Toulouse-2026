import http from "node:http";
import https from "node:https";
import net from "node:net";
import { promises as dns, type LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

import { isPrivateAddress } from "./webhook-url.js";

// Fetching a URL someone else chose (#617, #306): an admin pasting a logo's
// address, an AI agent importing sponsor logos, a Sessionize speaker photo.
// validateWebhookUrl alone leaves three holes, which this closes:
//
//  - redirects: fetch follows them silently, so a public URL could bounce the
//    request to 169.254.169.254 or db:5432. Each hop is followed by hand and
//    revalidated, and their number is capped;
//  - DNS rebinding: the address checked and the one connected to could differ
//    between two resolutions. The check runs inside the socket's own lookup, on
//    the very address it is about to connect to;
//  - size: reading the whole body and measuring it afterwards lets a hostile
//    server fill memory. The body is counted as it arrives and cut at the cap.

export const REMOTE_FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export type RemoteFetchErrorCode =
  | "invalid_url"
  | "invalid_protocol"
  | "internal_hostname"
  | "private_ip"
  | "too_many_redirects"
  | "http_error"
  | "too_large"
  | "timeout"
  | "empty"
  | "network";

export class RemoteFetchError extends Error {
  constructor(
    readonly code: RemoteFetchErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "RemoteFetchError";
  }
}

export interface RemoteFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  // Which resolved addresses may be contacted. Public ones only by default;
  // a test passes its own to reach a server on the loopback.
  isAllowedAddress?: (address: string, family: number) => boolean;
}

const isPublicAddress = (address: string, family: number) => !isPrivateAddress(address, family);

/** Fetch a URL into a buffer, refusing anything private, oversized or slow. */
export async function fetchRemoteFile(
  rawUrl: string,
  { maxBytes, timeoutMs = REMOTE_FETCH_TIMEOUT_MS, isAllowedAddress = isPublicAddress }: RemoteFetchOptions,
): Promise<{ buffer: Buffer; url: URL }> {
  const deadline = Date.now() + timeoutMs;
  let url = checkUrl(rawUrl, isAllowedAddress);

  for (let hop = 0; ; hop++) {
    const response = await request(url, deadline, isAllowedAddress);
    const status = response.statusCode ?? 0;

    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      if (hop >= MAX_REDIRECTS) throw new RemoteFetchError("too_many_redirects");
      url = checkUrl(new URL(response.headers.location, url).toString(), isAllowedAddress);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new RemoteFetchError("http_error", `HTTP ${status}`);
    }

    const declared = Number(response.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBytes) {
      response.destroy();
      throw new RemoteFetchError("too_large");
    }
    const buffer = await readCapped(response, maxBytes, deadline);
    if (buffer.length === 0) throw new RemoteFetchError("empty");
    return { buffer, url };
  }
}

// How much of a webhook's answer is kept: the back-office test button shows
// its start, nothing else reads it.
const POST_RESPONSE_MAX_BYTES = 4096;

export interface PostJsonOptions {
  timeoutMs?: number;
  isAllowedAddress?: (address: string, family: number) => boolean;
}

/**
 * POST a JSON payload to a URL someone else chose: the webhooks (#658). Same
 * guard as fetchRemoteFile, the address checked inside the socket's own
 * lookup, so a record cannot turn private between a check and the send. A
 * redirect is answered as is, never followed. Throws RemoteFetchError when the
 * request cannot be made; any HTTP status is a result.
 */
export async function postJson(
  rawUrl: string,
  payload: unknown,
  { timeoutMs = REMOTE_FETCH_TIMEOUT_MS, isAllowedAddress = isPublicAddress }: PostJsonOptions = {},
): Promise<{ status: number; statusText: string; body: string }> {
  const deadline = Date.now() + timeoutMs;
  const url = checkUrl(rawUrl, isAllowedAddress);
  const body = JSON.stringify(payload);

  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, {
      method: "POST",
      lookup: pinnedLookup(isAllowedAddress),
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "user-agent": "DevFestToulouse-site/1.0",
      },
      timeout: Math.max(1, deadline - Date.now()),
    });
    req.on("response", resolve);
    req.on("timeout", () => req.destroy(new RemoteFetchError("timeout")));
    req.on("error", (err) => reject(err instanceof RemoteFetchError ? err : new RemoteFetchError("network", err.message)));
    req.end(body);
  });

  const text = await readCapped(response, Number.MAX_SAFE_INTEGER, deadline, POST_RESPONSE_MAX_BYTES);
  return { status: response.statusCode ?? 0, statusText: response.statusMessage ?? "", body: text.toString("utf8") };
}

// Syntax and literal addresses. A hostname is resolved, and checked, by the
// socket itself (pinnedLookup) — a literal IP skips that lookup, so it is
// checked here.
function checkUrl(raw: string, isAllowedAddress: RemoteFetchOptions["isAllowedAddress"] & {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemoteFetchError("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new RemoteFetchError("invalid_protocol");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const family = net.isIP(host);
  if (family) {
    if (!isAllowedAddress(host, family)) throw new RemoteFetchError("private_ip");
    return url;
  }
  // Bare names are Docker service names on the shared network (db, backend).
  if (!host.includes(".") || host.toLowerCase() === "localhost") throw new RemoteFetchError("internal_hostname");
  return url;
}

function pinnedLookup(isAllowedAddress: RemoteFetchOptions["isAllowedAddress"] & {}): LookupFunction {
  return (hostname, options, callback) => {
    dns
      .lookup(hostname, { all: true })
      .then((addresses: LookupAddress[]) => {
        // Every address must be allowed: picking a public one among private
        // ones would still let the record point inside on the next try.
        if (addresses.length === 0) throw new RemoteFetchError("network", "no address");
        if (addresses.some(({ address, family }) => !isAllowedAddress(address, family))) {
          throw new RemoteFetchError("private_ip");
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      })
      .catch((err: Error) => callback(err as NodeJS.ErrnoException, "", 0));
  };
}

function request(url: URL, deadline: number, isAllowedAddress: RemoteFetchOptions["isAllowedAddress"] & {}) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, {
      lookup: pinnedLookup(isAllowedAddress),
      headers: { "user-agent": "DevFestToulouse-site/1.0", accept: "*/*" },
      timeout: Math.max(1, deadline - Date.now()),
    });
    req.on("response", resolve);
    req.on("timeout", () => req.destroy(new RemoteFetchError("timeout")));
    req.on("error", (err) => reject(err instanceof RemoteFetchError ? err : new RemoteFetchError("network", err.message)));
  });
}

// `keepBytes`: stop reading once that much is in hand and return it, rather
// than failing as `maxBytes` does — enough of an answer to show.
function readCapped(response: http.IncomingMessage, maxBytes: number, deadline: number, keepBytes?: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => response.destroy(new RemoteFetchError("timeout")), Math.max(1, deadline - Date.now()));
    response.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (keepBytes !== undefined && size >= keepBytes) {
        chunks.push(chunk);
        clearTimeout(timer);
        response.destroy();
        resolve(Buffer.concat(chunks).subarray(0, keepBytes));
        return;
      }
      if (size > maxBytes) {
        response.destroy(new RemoteFetchError("too_large"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    response.on("error", (err) => {
      clearTimeout(timer);
      reject(err instanceof RemoteFetchError ? err : new RemoteFetchError("network", err.message));
    });
  });
}
