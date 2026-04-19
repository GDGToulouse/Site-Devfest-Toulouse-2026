import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = "/app/uploads";
const ALLOWED_MIMES = [
  // Images
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "image/x-icon", "image/vnd.microsoft.icon",
  // Documents
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILE_SIZE = 20_000_000; // 20 MB

export default async function adminFileRoutes(app: FastifyInstance) {
  // POST /api/admin/files — upload a single file (image or document)
  app.post("/files", async (request, reply) => {
    const data = await request.file({
      limits: { fileSize: MAX_FILE_SIZE },
    });

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    // Some browsers send .ico with an empty or generic mimetype — accept it
    // when the extension is unambiguous.
    const ext = path.extname(data.filename).toLowerCase();
    const isIcoByExt = ext === ".ico";
    if (!ALLOWED_MIMES.includes(data.mimetype) && !isIcoByExt) {
      // Consume the stream to avoid hanging
      await data.toBuffer();
      return reply.code(400).send({
        error: `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_MIMES.join(", ")}`,
      });
    }

    // Generate unique filename: timestamp-random.ext
    const safeExt = ext || ".jpg";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
    const destPath = path.join(UPLOADS_DIR, uniqueName);

    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await pipeline(data.file, fs.createWriteStream(destPath));

    if (data.file.truncated) {
      await fs.promises.unlink(destPath);
      return reply.code(413).send({ error: "File too large (max 20 MB)" });
    }

    const stat = await fs.promises.stat(destPath);

    return {
      filename: uniqueName,
      originalName: data.filename,
      url: `/uploads/${uniqueName}`,
      size: stat.size,
      mimetype: data.mimetype,
    };
  });

  // GET /api/admin/files — list all uploaded files (images and documents)
  app.get("/files", async () => {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico"];

    const files = await fs.promises.readdir(UPLOADS_DIR);
    const items = await Promise.all(
      files
        .filter((f) => f !== ".gitkeep")
        .map(async (filename) => {
          const filePath = path.join(UPLOADS_DIR, filename);
          const stat = await fs.promises.stat(filePath);
          const ext = path.extname(filename).toLowerCase();
          return {
            filename,
            url: `/uploads/${filename}`,
            size: stat.size,
            uploadedAt: stat.mtime.toISOString(),
            isImage: IMAGE_EXTS.includes(ext),
            ext,
          };
        })
    );

    items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return items;
  });

  // DELETE /api/admin/files/:filename — delete a file
  app.delete<{ Params: { filename: string } }>(
    "/files/:filename",
    async (request, reply) => {
      const { filename } = request.params;

      // Prevent path traversal
      if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
        return reply.code(400).send({ error: "Invalid filename" });
      }

      const filePath = path.join(UPLOADS_DIR, filename);

      try {
        await fs.promises.unlink(filePath);
        return { success: true };
      } catch {
        return reply.code(404).send({ error: "File not found" });
      }
    }
  );
}
