-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "share_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_share_token_key" ON "clients"("share_token");
