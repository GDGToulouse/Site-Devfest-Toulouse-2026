-- The organisers' team (#110): a member shared across editions, ticked for
-- the years they organised.

CREATE TABLE "TeamMember" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "websiteUrl" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "blueskyUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamMember_deletedAt_idx" ON "TeamMember"("deletedAt");

CREATE TABLE "TeamMemberEdition" (
    "teamMemberId" INTEGER NOT NULL,
    "editionId" INTEGER NOT NULL,

    CONSTRAINT "TeamMemberEdition_pkey" PRIMARY KEY ("teamMemberId","editionId")
);

CREATE INDEX "TeamMemberEdition_editionId_idx" ON "TeamMemberEdition"("editionId");

ALTER TABLE "TeamMemberEdition" ADD CONSTRAINT "TeamMemberEdition_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamMemberEdition" ADD CONSTRAINT "TeamMemberEdition_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
