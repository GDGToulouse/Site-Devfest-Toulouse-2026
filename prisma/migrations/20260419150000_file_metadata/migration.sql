-- Per-file editor metadata for /uploads assets. Kept independent from
-- the filesystem so admins can edit alt text, etc., without touching
-- the file itself. Rows are only created when an admin sets at least
-- one field — files without metadata simply have no row.
CREATE TABLE "FileMetadata" (
    "filename" TEXT NOT NULL,
    "alt" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileMetadata_pkey" PRIMARY KEY ("filename")
);
