-- CreateTable
CREATE TABLE "userWallet" (
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "userWallet_pkey" PRIMARY KEY ("walletId")
);

-- CreateIndex
CREATE UNIQUE INDEX "userWallet_walletAddress_key" ON "userWallet"("walletAddress");

-- AddForeignKey
ALTER TABLE "userWallet" ADD CONSTRAINT "userWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
