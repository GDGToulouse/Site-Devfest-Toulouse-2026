import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";

// #866 — the speakers' addresses come from the Excel export of Sessionize's
// organizer app: empty ones are filled, an address already on the site wins,
// a speaker is found by Sessionize id then by name, and nothing is created.
const authContext = vi.hoisted(() => ({
  current: { user: { id: "test-admin", email: "admin@test.local", name: "Ad", role: "ADMIN" } } as { user: { id: string; email: string; name: string; role: string } },
}));
vi.mock("../lib/auth-context.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/auth-context.js")>()),
  getAuthContext: async () => authContext.current,
}));

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import adminImportRoutes from "../routes/admin/import.js";
import { prisma } from "../lib/prisma.js";
import { importSessionize } from "../lib/sessionize-import.js";
import { buildXlsx } from "./support/xlsx.js";

const YEAR = 1543;
const tag = randomUUID().slice(0, 8);
// Unique, fictitious names: the match is by slug across all speakers.
const ADA = { first: "Ada", last: `Testmail${tag}` };
const BOB = { first: "Bob", last: `Testmail${tag}` };
const CARL = { first: "Carl", last: `Testmail${tag}` };
const slug = (p: { first: string; last: string }) => `${p.first}-${p.last}`.toLowerCase();
const HEADER = ["Session Id", "Title", "Speaker Id", "FirstName", "LastName", "Email", "TagLine"];

let app: FastifyInstance;
let editionId: number | undefined;

function upload(file: Buffer, filename = "export.xlsx") {
  const boundary = `----test${tag}`;
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: "POST",
    url: "/api/admin/import/sessionize/emails",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
}

const speaker = (p: { first: string; last: string }) => prisma.speaker.findUnique({ where: { slug: slug(p) } });

beforeAll(async () => {
  await prisma.edition.deleteMany({ where: { year: YEAR } });
  editionId = (await prisma.edition.create({ data: { year: YEAR } })).id;
  await prisma.speaker.create({ data: { slug: slug(ADA), name: `${ADA.first} ${ADA.last}` } });
  await prisma.speaker.create({ data: { slug: slug(BOB), name: `${BOB.first} ${BOB.last}`, contactEmail: `bob-site-${tag}@example.com` } });
  app = Fastify({ logger: false });
  await app.register(multipart);
  await app.register(adminImportRoutes, { prefix: "/api/admin" });
});

afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { slug: { endsWith: tag.toLowerCase() } } });
  if (editionId !== undefined) await prisma.edition.deleteMany({ where: { id: editionId } });
  await app?.close();
});

describe("import of the speakers' addresses from Sessionize's Excel export (#866)", () => {
  it("should fill an empty address, keep and report a different one, and list who is not on the site", async () => {
    const file = buildXlsx([
      HEADER,
      ["1", "Talk A", `sz-ada-${tag}`, ADA.first, ADA.last, `ADA-${tag}@example.com`, ""],
      // A second session of Ada's: one speaker, counted once.
      ["2", "Talk A2", `sz-ada-${tag}`, ADA.first, ADA.last, `ada-${tag}@example.com`, ""],
      ["3", "Talk B", `sz-bob-${tag}`, BOB.first, BOB.last, `bob-file-${tag}@example.com`, ""],
      ["4", "Talk C", `sz-carl-${tag}`, CARL.first, CARL.last, `carl-${tag}@example.com`, ""],
      ["5", "Talk D", `sz-dan-${tag}`, "Dan", `Testmail${tag}`, "not an address", ""],
    ]);

    const res = await upload(file);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      added: [`${ADA.first} ${ADA.last}`],
      unchanged: [],
      different: [{ name: `${BOB.first} ${BOB.last}`, current: `bob-site-${tag}@example.com`, file: `bob-file-${tag}@example.com` }],
      notFound: [`${CARL.first} ${CARL.last}`],
      invalid: [`Dan Testmail${tag}`],
    });
    expect(await speaker(ADA)).toMatchObject({ contactEmail: `ada-${tag}@example.com`, sessionizeId: `sz-ada-${tag}` });
    expect(await speaker(BOB)).toMatchObject({ contactEmail: `bob-site-${tag}@example.com`, sessionizeId: `sz-bob-${tag}` });
    expect(await speaker(CARL)).toBeNull();
  });

  it("should change nothing the second time, and say so", async () => {
    const file = buildXlsx([HEADER, ["1", "Talk A", `sz-ada-${tag}`, ADA.first, ADA.last, `ada-${tag}@example.com`, ""]]);

    const res = await upload(file);

    expect(res.json()).toMatchObject({ added: [], unchanged: [`${ADA.first} ${ADA.last}`] });
  });

  it("should find a speaker by Sessionize id even after a change of name", async () => {
    await prisma.speaker.update({ where: { slug: slug(ADA) }, data: { contactEmail: null } });
    const file = buildXlsx([HEADER, ["1", "Talk A", `sz-ada-${tag}`, "Augusta", ADA.last, `ada-${tag}@example.com`, ""]]);

    const res = await upload(file);

    expect(res.json().added).toEqual([`${ADA.first} ${ADA.last}`]);
  });

  it("should refuse a file that is not an Excel export, or one without the expected columns", async () => {
    const notXlsx = await upload(Buffer.from("Speaker Id;Email\n1;a@b.c"), "export.csv");
    const wrongColumns = await upload(buildXlsx([["Title", "Room"], ["Talk", "A"]]));

    expect(notXlsx.statusCode).toBe(400);
    expect(wrongColumns.statusCode).toBe(422);
    expect(wrongColumns.json().message).toContain("Speaker Id");
  });

  it("should refuse an editor", async () => {
    authContext.current = { user: { ...authContext.current.user, role: "EDITOR" } };
    const res = await upload(buildXlsx([HEADER]));
    authContext.current = { user: { ...authContext.current.user, role: "ADMIN" } };

    expect(res.statusCode).toBe(403);
  });

  it("should keep the Sessionize id on the speakers the API import writes", async () => {
    await importSessionize(editionId!, {
      speakers: [{ id: `sz-erin-${tag}`, fullName: `Erin Testmail${tag}` }],
      sessions: [],
      categories: [],
      rooms: [],
    });

    expect((await prisma.speaker.findUnique({ where: { slug: `erin-testmail${tag}`.toLowerCase() } }))?.sessionizeId).toBe(`sz-erin-${tag}`);
  });
});
