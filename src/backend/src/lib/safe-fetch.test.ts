import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { fetchRemoteFile, RemoteFetchError } from "./safe-fetch.js";

// #617 — fetching a URL someone else chose. A real server on the loopback plays
// the remote site; the tests allow 127.0.0.1 explicitly (isAllowedAddress), and
// check separately that the default refuses it. What must hold: every redirect
// hop is revalidated, the body is cut at the cap while it is read, and a slow
// server is dropped.

const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
let server: http.Server;
let base: string;
let hugeBytesSent = 0;

const loopbackOnly = (address: string) => address === "127.0.0.1";

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case "/logo.png":
        res.writeHead(200, { "content-type": "text/plain" }).end(PNG_HEAD);
        return;
      case "/redirect":
        res.writeHead(302, { location: "/logo.png" }).end();
        return;
      case "/redirect-private":
        res.writeHead(302, { location: "http://10.0.0.1/secret" }).end();
        return;
      case "/redirect-internal":
        res.writeHead(302, { location: "http://db:5432/" }).end();
        return;
      case "/loop":
        res.writeHead(302, { location: "/loop" }).end();
        return;
      case "/huge": {
        // No Content-Length: the cap has to hold while the body streams.
        res.writeHead(200);
        const chunk = Buffer.alloc(64 * 1024);
        const pump = () => {
          while (hugeBytesSent < 50 * 1024 * 1024) {
            hugeBytesSent += chunk.length;
            if (!res.write(chunk)) return res.once("drain", pump);
          }
          res.end();
        };
        res.on("close", () => res.removeAllListeners("drain"));
        pump();
        return;
      }
      case "/slow":
        return; // never answers
      default:
        res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const err = await promise.then(() => null, (e: unknown) => e);
  return err instanceof RemoteFetchError ? err.code : String(err);
}

describe("fetchRemoteFile (#617)", () => {
  it("should download a file, following a redirect it revalidated", async () => {
    const { buffer, url } = await fetchRemoteFile(`${base}/redirect`, { maxBytes: 1000, isAllowedAddress: loopbackOnly });

    expect(buffer.equals(PNG_HEAD)).toBe(true);
    expect(url.pathname).toBe("/logo.png");
  });

  it("should refuse the loopback, a private range and a bare service name by default", async () => {
    expect(await codeOf(fetchRemoteFile(`${base}/logo.png`, { maxBytes: 1000 }))).toBe("private_ip");
    expect(await codeOf(fetchRemoteFile("http://169.254.169.254/latest/meta-data", { maxBytes: 1000 }))).toBe("private_ip");
    expect(await codeOf(fetchRemoteFile("http://db:5432/", { maxBytes: 1000 }))).toBe("internal_hostname");
    expect(await codeOf(fetchRemoteFile("http://localhost/", { maxBytes: 1000 }))).toBe("internal_hostname");
    expect(await codeOf(fetchRemoteFile("file:///etc/passwd", { maxBytes: 1000 }))).toBe("invalid_protocol");
  });

  it("should refuse a redirect into a private address or an internal name", async () => {
    expect(await codeOf(fetchRemoteFile(`${base}/redirect-private`, { maxBytes: 1000, isAllowedAddress: loopbackOnly }))).toBe("private_ip");
    expect(await codeOf(fetchRemoteFile(`${base}/redirect-internal`, { maxBytes: 1000, isAllowedAddress: loopbackOnly }))).toBe(
      "internal_hostname",
    );
  });

  it("should stop following an endless redirect", async () => {
    expect(await codeOf(fetchRemoteFile(`${base}/loop`, { maxBytes: 1000, isAllowedAddress: loopbackOnly }))).toBe("too_many_redirects");
  });

  it("should cut an oversized body while it streams, not after", async () => {
    const code = await codeOf(fetchRemoteFile(`${base}/huge`, { maxBytes: 1024 * 1024, isAllowedAddress: loopbackOnly }));

    expect(code).toBe("too_large");
    // The server was stopped well before its 50 MB.
    expect(hugeBytesSent).toBeLessThan(20 * 1024 * 1024);
  });

  it("should give up on a server that does not answer", async () => {
    expect(await codeOf(fetchRemoteFile(`${base}/slow`, { maxBytes: 1000, timeoutMs: 300, isAllowedAddress: loopbackOnly }))).toBe("timeout");
  });

  it("should report a missing file as an HTTP error", async () => {
    expect(await codeOf(fetchRemoteFile(`${base}/nope`, { maxBytes: 1000, isAllowedAddress: loopbackOnly }))).toBe("http_error");
  });
});
