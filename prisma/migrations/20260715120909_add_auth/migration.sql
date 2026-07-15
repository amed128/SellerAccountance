/*
  Warnings:

  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

  This migration introduces real accounts, replacing the pre-auth MVP's
  single implicit "local@selleraccountance.dev" user. Any data created
  under that placeholder user (and only that data) is cleared first,
  since it has no password and can never be signed into.
*/
-- Clear pre-auth placeholder data (see comment above)
DELETE FROM "Transaction" WHERE "reportId" IN (SELECT "id" FROM "Report" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'local@selleraccountance.dev'));
DELETE FROM "Report" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'local@selleraccountance.dev');
DELETE FROM "User" WHERE "email" = 'local@selleraccountance.dev';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
