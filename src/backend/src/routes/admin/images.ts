import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = "/app/uploads";
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5_000_000; // 5 MB

export default async function adminImageRoutes(app: FastifyInstance) {
  // POST /api/admin/images — upload a single image
  app.post("/images", async (request, reply) => {
    const data = await request.file({
      limits: { fileSize: MAX_FILE_SIZE },
    });

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    if (!ALLOWED_MIMES.includes(data.mimetype)) {
      // Consume the stream to avoid hanging
      await data.toBuffer();
      return reply.code(400).send({
        error: `Invalid file type: ${data.mimetype}. Allowed: ${ALLOWED_MIMES.join(", ")}`,
      });
    }

    // Generate unique filename: timestamp-random.ext
    const ext = path.extname(data.filename).toLowerCase() || ".jpg";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
    const destPath = path.join(UPLOADS_DIR, uniqueName);

    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await pipeline(data.file, fs.createWriteStream(destPath));

    if (data.file.truncated) {
      await fs.promises.unlink(destPath);
      return reply.code(413).send({ error: "File too large (max 5 MB)" });
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

  // GET /api/admin/images — list all uploaded images
  app.get("/images", async () => {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

    const files = await fs.promises.readdir(UPLOADS_DIR);
    const images = await Promise.all(
      files
        .filter((f) => f !== ".gitkeep")
        .map(async (filename) => {
          const filePath = path.join(UPLOADS_DIR, filename);
          const stat = await fs.promises.stat(filePath);
          return {
            filename,
            url: `/uploads/${filename}`,
            size: stat.size,
            uploadedAt: stat.mtime.toISOString(),
          };
        })
    );

    // Sort by date descending
    images.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return images;
  });

  // DELETE /api/admin/images/:filename — delete an image
  app.delete<{ Params: { filename: string } }>(
    "/images/:filename",
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
