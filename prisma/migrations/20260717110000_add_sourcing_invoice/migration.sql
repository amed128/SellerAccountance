-- CreateTable
CREATE TABLE "SourcingInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountExclVat" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountInclVat" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "vatTreatment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingInvoice_userId_idx" ON "SourcingInvoice"("userId");

-- CreateIndex
CREATE INDEX "SourcingInvoice_sku_idx" ON "SourcingInvoice"("sku");

-- AddForeignKey
ALTER TABLE "SourcingInvoice" ADD CONSTRAINT "SourcingInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
