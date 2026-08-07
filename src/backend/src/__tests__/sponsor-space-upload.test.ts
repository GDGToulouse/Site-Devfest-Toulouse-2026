process.env.BASE_URL = process.env.BASE_URL || "http://localhost:4000";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

import sponsorSpaceRoutes from "../routes/sponsor-space.js";
import { prisma } from "../lib/prisma.js";
import { generateApiKey, resolveApiKeyEnv } from "../lib/api-key.js";
import { getSeededEdition } from "./edition-test-helpers.js";
import { createSponsorFixture, tierIdByKey } from "./sponsor-test-helpers.js";

// Uploading from the account-based space (#362). The logo and the com-kit files
// could only be sent through the anonymous edit link until now; they have to
// work here before that link is cut.
//
// Unlike the edit link, this endpoint is authenticated — but what lands on disk
// is served same-origin from /uploads/, so an SVG still has to be neutered.

// A 1x1 transparent PNG — smallest valid raster image sharp will accept.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

function multipartBody(filename: string, contentType: string, content: Buffer) {
  const boundary = "----spacetest";
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

let app: FastifyInstance;
let editionId: number;
let sponsorId: number;
let editorAuth: string;
let standAuth: string;

const created = { userIds: [] as string[], sponsorIds: [] as number[] };

async function createAccount(email: string) {
  const user = await prisma.user.create({
    data: { email, name: email, role: "SPONSOR", emailVerified: true },
  });
  created.userIds.push(user.id);
  const key = await generateApiKey(resolveApiKeyEnv());
  await prisma.apiKey.create({
    data: { name: `test-${email}`, prefix: key.prefix, hashedKey: key.hashedKey, userId: user.id },
  });
  return { user, bearer: key.raw };
}

beforeAll(async () => {
  const edition = await getSeededEdition();
  editionId = edition.id;

  const suffix = `${Date.now()}`;
  const sponsor = await createSponsorFixture({
    name: `Space Upload Co ${suffix}`,
    slug: `space-upload-co-${suffix}`,
    editionId,
    tierId: await tierIdByKey("gold"),
  });
  sponsorId = sponsor.id;
  created.sponsorIds.push(sponsor.id);

  const editor = await createAccount(`space-upload-editor-${suffix}@example.org`);
  await prisma.sponsorContact.create({
    data: { sponsorId, email: editor.user.email, userId: editor.user.id, accessRole: "EDITEUR" },
  });
  editorAuth = `Bearer ${editor.bearer}`;

  const stand = await createAccount(`space-upload-stand-${suffix}@example.org`);
  await prisma.sponsorContact.create({
    data: { sponsorId, email: stand.user.email, userId: stand.user.id, accessRole: "STAND" },
  });
  standAuth = `Bearer ${stand.bearer}`;

  app = Fastify({ logger: false });
  app.decorateRequest("authContext");
  app.decorateRequest("sponsorAccess");
  await app.register(multipart);
  await app.register(sponsorSpaceRoutes, { prefix: "/api" });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  if (created.userIds.length) {
    await prisma.apiKey.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  }
  if (created.sponsorIds.length) {
    await prisma.sponsor.deleteMany({ where: { id: { in: created.sponsorIds } } });
  }
});

describe("POST /api/sponsor-space/:sponsorId/upload (#362)", () => {
  it("stores an uploaded image and returns its /uploads URL", async () => {
    const { payload, headers } = multipartBody("logo.png", "image/png", PNG_1x1);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsorId}/upload`,
      payload,
      headers: { ...headers, authorization: editorAuth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/^\/uploads\/.+\.(png|jpg|webp|gif)$/);
  });

  it("stores an SVG logo with its script stripped (#346)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0h24v24H0z"/></svg>',
    );
    const { payload, headers } = multipartBody("logo.svg", "image/svg+xml", svg);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsorId}/upload`,
      payload,
      headers: { ...headers, authorization: editorAuth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/\.svg$/);
  });

  it("stores a com-kit charter as a PDF (#374)", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    const { payload, headers } = multipartBody("charte.pdf", "application/pdf", pdf);

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsorId}/upload`,
      payload,
      headers: { ...headers, authorization: editorAuth },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().url).toMatch(/\.pdf$/);
  });

  it("rejects a file type that is neither an image nor a PDF", async () => {
    const { payload, headers } = multipartBody("note.txt", "text/plain", Buffer.from("not an image"));

    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsorId}/upload`,
      payload,
      headers: { ...headers, authorization: editorAuth },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_file_type");
  });

  it("refuses an upload from a STAND member", async () => {
    const { payload, headers } = multipartBody("logo.png", "image/png", PNG_1x1);

    // Read-only by design: a booth host must not be able to repaint the logo.
    const res = await app.inject({
      method: "POST",
      url: `/api/sponsor-space/${sponsorId}/upload`,
      payload,
      headers: { ...headers, authorization: standAuth },
    });

    expect(res.statusCode).toBe(403);
  });
});
