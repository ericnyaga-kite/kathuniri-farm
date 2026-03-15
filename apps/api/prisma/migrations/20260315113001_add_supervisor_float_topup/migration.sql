-- CreateTable
CREATE TABLE "supervisor_float_topups" (
    "id" TEXT NOT NULL,
    "topupDate" DATE NOT NULL,
    "amountKes" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervisor_float_topups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supervisor_float_topups_topupDate_idx" ON "supervisor_float_topups"("topupDate");
