-- Media library tags (#373): a taxonomy of its own, linked to FileMetadata.

-- CreateTable
CREATE TABLE "FileTag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FileMetadataToFileTag" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_FileMetadataToFileTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileTag_name_key" ON "FileTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FileTag_slug_key" ON "FileTag"("slug");

-- CreateIndex
CREATE INDEX "_FileMetadataToFileTag_B_index" ON "_FileMetadataToFileTag"("B");

-- AddForeignKey
ALTER TABLE "_FileMetadataToFileTag" ADD CONSTRAINT "_FileMetadataToFileTag_A_fkey" FOREIGN KEY ("A") REFERENCES "FileMetadata"("filename") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FileMetadataToFileTag" ADD CONSTRAINT "_FileMetadataToFileTag_B_fkey" FOREIGN KEY ("B") REFERENCES "FileTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
