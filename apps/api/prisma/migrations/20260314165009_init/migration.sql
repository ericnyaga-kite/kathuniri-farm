-- CreateTable
CREATE TABLE "collection_centres" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "alternateSpellings" TEXT[],
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pickingCycleDays" INTEGER NOT NULL DEFAULT 14,
    "lastPickingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_centres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ktda_accounts" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderNationalId" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bushesRegistered" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ktda_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_centre_mapping" (
    "id" TEXT NOT NULL,
    "centreId" TEXT NOT NULL,
    "accountLetter" CHAR(1) NOT NULL,
    "ktdaAccountId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,

    CONSTRAINT "account_centre_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picking_sessions" (
    "id" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "centreId" TEXT NOT NULL,
    "pickerTotalKg" DECIMAL(8,2),
    "smsReportedKg" DECIMAL(8,2),
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'pending',
    "discrepancyKg" DECIMAL(8,2),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "picking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picker_records" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kgPicked" DECIMAL(8,2) NOT NULL,
    "ratePerKg" DECIMAL(6,2) NOT NULL,
    "grossPay" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "picker_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tea_sms_records" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "rawSms" TEXT NOT NULL,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "parseError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tea_sms_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tea_sms_deliveries" (
    "id" TEXT NOT NULL,
    "smsRecordId" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "centreId" TEXT,
    "centreRawName" TEXT,
    "cumulativeKg" DECIMAL(8,2),
    "todayKg" DECIMAL(8,2),
    "casualKg" DECIMAL(8,2),
    "casualPayKes" DECIMAL(10,2),
    "supervisorFloat" DECIMAL(10,2),
    "parseConfidence" DECIMAL(4,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tea_sms_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tea_sms_allocations" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "accountLetter" CHAR(1) NOT NULL,
    "ktdaAccountId" TEXT,
    "kgAllocated" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "tea_sms_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ktda_monthly_records" (
    "id" TEXT NOT NULL,
    "ktdaAccountId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "greenLeafKg" DECIMAL(8,2),
    "ratePerKg" DECIMAL(6,2),
    "grossEarnings" DECIMAL(10,2),
    "fertiliserSuspenseDeduction" DECIMAL(10,2),
    "totalOtherDeductions" DECIMAL(10,2),
    "totalDeductions" DECIMAL(10,2),
    "netPay" DECIMAL(10,2),
    "paymentReceivedDate" DATE,
    "fertiliserSuspenseBalance" DECIMAL(10,2),
    "accumulatedWeightYtd" DECIMAL(10,2),
    "yieldPerBush" DECIMAL(6,3),
    "ytdYield" DECIMAL(8,3),
    "adviceSlipImageId" TEXT,
    "reconciliationStatus" TEXT NOT NULL DEFAULT 'pending',
    "smsToTalKg" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ktda_monthly_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagNumber" TEXT,
    "breed" TEXT,
    "dateOfBirth" DATE,
    "damId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'milking',
    "currentLactationNumber" INTEGER,
    "dateLastCalved" DATE,
    "expectedDryOffDate" DATE,
    "expectedCalvingDate" DATE,
    "lastHeatObserved" DATE,
    "lastInseminationDate" DATE,
    "pregnancyConfirmedDate" DATE,
    "photoId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_production" (
    "id" TEXT NOT NULL,
    "productionDate" DATE NOT NULL,
    "cowId" TEXT,
    "session" TEXT NOT NULL,
    "litres" DECIMAL(6,2) NOT NULL,
    "withdrawalActive" BOOLEAN NOT NULL DEFAULT false,
    "saleable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_buyers" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "pricePerLitre" DECIMAL(6,2),
    "currentBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "milk_buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_deliveries" (
    "id" TEXT NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "buyerId" TEXT NOT NULL,
    "litres" DECIMAL(6,2) NOT NULL,
    "pricePerLitre" DECIMAL(6,2) NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "paymentDate" DATE,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milk_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_events" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventType" TEXT NOT NULL,
    "conditionName" TEXT,
    "symptoms" TEXT,
    "vetId" TEXT,
    "sourceImageId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatments" (
    "id" TEXT NOT NULL,
    "healthEventId" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "dosageRoute" TEXT,
    "durationDays" INTEGER,
    "withdrawalPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "withdrawalEndsDate" DATE,
    "costKes" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reproduction_events" (
    "id" TEXT NOT NULL,
    "cowId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventType" TEXT NOT NULL,
    "heatIntensity" TEXT,
    "semenCode" TEXT,
    "technician" TEXT,
    "confirmationMethod" TEXT,
    "expectedCalvingDate" DATE,
    "complications" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reproduction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calves" (
    "id" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "calvingEventId" TEXT,
    "dateOfBirth" DATE NOT NULL,
    "sex" TEXT NOT NULL,
    "birthWeightKg" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'active',
    "dateWeaned" DATE,
    "saleDate" DATE,
    "saleBuyer" TEXT,
    "salePriceKes" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "plotType" TEXT NOT NULL,
    "areaHa" DECIMAL(8,4),
    "boundaryGeojson" JSONB,
    "currentCrop" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_activities" (
    "id" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "plotId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "crop" TEXT,
    "completionStatus" TEXT NOT NULL DEFAULT 'pending',
    "labourDays" DECIMAL(4,1),
    "workPlanEventId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crop_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_plans" (
    "id" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsed" BOOLEAN NOT NULL DEFAULT false,
    "parseErrorsCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_plan_events" (
    "id" TEXT NOT NULL,
    "workPlanId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "activityType" TEXT NOT NULL,
    "plotId" TEXT,
    "centreId" TEXT,
    "locationRaw" TEXT,
    "locationMatched" BOOLEAN NOT NULL DEFAULT false,
    "crop" TEXT,
    "assignedToStaffId" TEXT,
    "notes" TEXT,
    "parseConfidence" DECIMAL(4,3),
    "parseWarning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_plan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "employmentType" TEXT NOT NULL,
    "startDate" DATE,
    "monthlySalary" DECIMAL(10,2),
    "dailyRate" DECIMAL(8,2),
    "pickerRatePerKg" DECIMAL(6,2),
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "mpesaNumber" TEXT,
    "nhifNumber" TEXT,
    "nssfNumber" TEXT,
    "statutoryDeductionsActive" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advances" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "advanceDate" DATE NOT NULL,
    "amountKes" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "amountRecovered" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fullyRecovered" BOOLEAN NOT NULL DEFAULT false,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_deductions" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollType" TEXT NOT NULL,
    "deductionDate" DATE NOT NULL,
    "amountDeducted" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payroll_runs" (
    "id" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payroll_records" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "grossSalary" DECIMAL(10,2) NOT NULL,
    "advanceDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nhifDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nssfDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paymentDate" DATE,
    "mpesaRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_rooms" (
    "id" TEXT NOT NULL,
    "roomNumber" INTEGER NOT NULL,
    "tenantName" TEXT,
    "tenantPhone" TEXT,
    "monthlyRentKes" DECIMAL(10,2),
    "electricityRatePerUnit" DECIMAL(6,2) NOT NULL DEFAULT 30,
    "occupancyStatus" TEXT NOT NULL DEFAULT 'occupied',
    "rentDueDay" INTEGER NOT NULL DEFAULT 5,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electricity_readings" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "readingDate" DATE NOT NULL,
    "meterReading" DECIMAL(10,2) NOT NULL,
    "previousReading" DECIMAL(10,2),
    "unitsConsumed" DECIMAL(10,2),
    "amountKes" DECIMAL(10,2),
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "rawMessage" TEXT,
    "parseConfidence" DECIMAL(4,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "electricity_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_payments" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "rentAmountKes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "electricityAmountKes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmountKes" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'mpesa',
    "mpesaRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_records" (
    "id" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "enterprise" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amountKes" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "receiptImageId" TEXT,
    "paymentMethod" TEXT,
    "mpesaRef" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mpesa_transactions" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountKes" DECIMAL(10,2) NOT NULL,
    "feeKes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "counterpartyName" TEXT,
    "counterpartyPhone" TEXT,
    "transactionAt" TIMESTAMP(3) NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'mpesa',
    "rawSms" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedEntityType" TEXT,
    "matchedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mpesa_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "reorderLevel" DECIMAL(10,2),
    "currentStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lastPurchaseDate" DATE,
    "lastPurchasePricePerUnit" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementDate" DATE NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(8,2),
    "totalCost" DECIMAL(10,2),
    "referenceId" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "alertCode" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "snoozedUntil" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "capturedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_records" (
    "id" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "rainfallMm" DECIMAL(6,2),
    "tempMinC" DECIMAL(5,2),
    "tempMaxC" DECIMAL(5,2),
    "humidityPct" DECIMAL(5,2),
    "et0Mm" DECIMAL(6,2),
    "windSpeedKmh" DECIMAL(6,2),
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weather_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "generatedDate" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "supportingData" JSONB,
    "confidence" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_queue" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "fileUploadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawExtracted" JSONB,
    "parseConfidence" DECIMAL(4,3),
    "parseError" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "savedRecordIds" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'historical_ingest',
    "periodHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingest_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "small_stock" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "species" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "tagNumber" TEXT,
    "dateOfBirth" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "small_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "small_stock_health_events" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventType" TEXT NOT NULL,
    "conditionName" TEXT,
    "symptoms" TEXT,
    "drugName" TEXT,
    "costKes" DECIMAL(10,2),
    "vetId" TEXT,
    "sourceImageId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "small_stock_health_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_centres_canonicalName_key" ON "collection_centres"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "ktda_accounts_accountCode_key" ON "ktda_accounts"("accountCode");

-- CreateIndex
CREATE UNIQUE INDEX "account_centre_mapping_centreId_accountLetter_effectiveFrom_key" ON "account_centre_mapping"("centreId", "accountLetter", "effectiveFrom");

-- CreateIndex
CREATE INDEX "picking_sessions_sessionDate_idx" ON "picking_sessions"("sessionDate");

-- CreateIndex
CREATE INDEX "picking_sessions_centreId_idx" ON "picking_sessions"("centreId");

-- CreateIndex
CREATE UNIQUE INDEX "picking_sessions_sessionDate_centreId_key" ON "picking_sessions"("sessionDate", "centreId");

-- CreateIndex
CREATE UNIQUE INDEX "ktda_monthly_records_ktdaAccountId_periodMonth_periodYear_key" ON "ktda_monthly_records"("ktdaAccountId", "periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "milk_production_productionDate_idx" ON "milk_production"("productionDate");

-- CreateIndex
CREATE INDEX "milk_production_cowId_idx" ON "milk_production"("cowId");

-- CreateIndex
CREATE UNIQUE INDEX "milk_production_productionDate_cowId_session_key" ON "milk_production"("productionDate", "cowId", "session");

-- CreateIndex
CREATE UNIQUE INDEX "milk_buyers_canonicalName_key" ON "milk_buyers"("canonicalName");

-- CreateIndex
CREATE INDEX "health_events_cowId_idx" ON "health_events"("cowId");

-- CreateIndex
CREATE INDEX "health_events_eventDate_idx" ON "health_events"("eventDate");

-- CreateIndex
CREATE INDEX "treatments_withdrawalEndsDate_idx" ON "treatments"("withdrawalEndsDate");

-- CreateIndex
CREATE UNIQUE INDEX "plots_canonicalName_key" ON "plots"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "work_plans_periodMonth_periodYear_key" ON "work_plans"("periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "work_plan_events_startDate_idx" ON "work_plan_events"("startDate");

-- CreateIndex
CREATE INDEX "advances_staffId_idx" ON "advances"("staffId");

-- CreateIndex
CREATE INDEX "advances_fullyRecovered_idx" ON "advances"("fullyRecovered");

-- CreateIndex
CREATE INDEX "advance_deductions_advanceId_idx" ON "advance_deductions"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_payroll_runs_periodMonth_periodYear_key" ON "monthly_payroll_runs"("periodMonth", "periodYear");

-- CreateIndex
CREATE INDEX "monthly_payroll_records_payrollRunId_idx" ON "monthly_payroll_records"("payrollRunId");

-- CreateIndex
CREATE INDEX "monthly_payroll_records_staffId_idx" ON "monthly_payroll_records"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_payroll_records_payrollRunId_staffId_key" ON "monthly_payroll_records"("payrollRunId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_rooms_roomNumber_key" ON "rental_rooms"("roomNumber");

-- CreateIndex
CREATE INDEX "electricity_readings_roomId_idx" ON "electricity_readings"("roomId");

-- CreateIndex
CREATE INDEX "electricity_readings_readingDate_idx" ON "electricity_readings"("readingDate");

-- CreateIndex
CREATE UNIQUE INDEX "electricity_readings_roomId_readingDate_key" ON "electricity_readings"("roomId", "readingDate");

-- CreateIndex
CREATE INDEX "rent_payments_roomId_idx" ON "rent_payments"("roomId");

-- CreateIndex
CREATE INDEX "rent_payments_periodYear_periodMonth_idx" ON "rent_payments"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "expense_records_expenseDate_idx" ON "expense_records"("expenseDate");

-- CreateIndex
CREATE INDEX "expense_records_enterprise_idx" ON "expense_records"("enterprise");

-- CreateIndex
CREATE UNIQUE INDEX "mpesa_transactions_transactionRef_key" ON "mpesa_transactions"("transactionRef");

-- CreateIndex
CREATE INDEX "mpesa_transactions_counterpartyPhone_idx" ON "mpesa_transactions"("counterpartyPhone");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_canonicalName_key" ON "inventory_items"("canonicalName");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_idx" ON "stock_movements"("itemId");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_alertCode_idx" ON "alerts"("alertCode");

-- CreateIndex
CREATE UNIQUE INDEX "file_uploads_r2Key_key" ON "file_uploads"("r2Key");

-- CreateIndex
CREATE UNIQUE INDEX "weather_records_recordDate_key" ON "weather_records"("recordDate");

-- CreateIndex
CREATE INDEX "ai_insights_generatedDate_idx" ON "ai_insights"("generatedDate");

-- CreateIndex
CREATE INDEX "ai_insights_status_idx" ON "ai_insights"("status");

-- CreateIndex
CREATE INDEX "ingest_queue_status_idx" ON "ingest_queue"("status");

-- CreateIndex
CREATE INDEX "small_stock_health_events_animalId_idx" ON "small_stock_health_events"("animalId");

-- CreateIndex
CREATE INDEX "small_stock_health_events_eventDate_idx" ON "small_stock_health_events"("eventDate");

-- AddForeignKey
ALTER TABLE "account_centre_mapping" ADD CONSTRAINT "account_centre_mapping_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "collection_centres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_centre_mapping" ADD CONSTRAINT "account_centre_mapping_ktdaAccountId_fkey" FOREIGN KEY ("ktdaAccountId") REFERENCES "ktda_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picking_sessions" ADD CONSTRAINT "picking_sessions_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "collection_centres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picker_records" ADD CONSTRAINT "picker_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "picking_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "picker_records" ADD CONSTRAINT "picker_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_sms_deliveries" ADD CONSTRAINT "tea_sms_deliveries_smsRecordId_fkey" FOREIGN KEY ("smsRecordId") REFERENCES "tea_sms_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_sms_deliveries" ADD CONSTRAINT "tea_sms_deliveries_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "collection_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_sms_allocations" ADD CONSTRAINT "tea_sms_allocations_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "tea_sms_deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_sms_allocations" ADD CONSTRAINT "tea_sms_allocations_ktdaAccountId_fkey" FOREIGN KEY ("ktdaAccountId") REFERENCES "ktda_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ktda_monthly_records" ADD CONSTRAINT "ktda_monthly_records_ktdaAccountId_fkey" FOREIGN KEY ("ktdaAccountId") REFERENCES "ktda_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cows" ADD CONSTRAINT "cows_damId_fkey" FOREIGN KEY ("damId") REFERENCES "cows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_production" ADD CONSTRAINT "milk_production_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "cows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_deliveries" ADD CONSTRAINT "milk_deliveries_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "milk_buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_events" ADD CONSTRAINT "health_events_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "cows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_healthEventId_fkey" FOREIGN KEY ("healthEventId") REFERENCES "health_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reproduction_events" ADD CONSTRAINT "reproduction_events_cowId_fkey" FOREIGN KEY ("cowId") REFERENCES "cows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calves" ADD CONSTRAINT "calves_damId_fkey" FOREIGN KEY ("damId") REFERENCES "cows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calves" ADD CONSTRAINT "calves_calvingEventId_fkey" FOREIGN KEY ("calvingEventId") REFERENCES "reproduction_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_activities" ADD CONSTRAINT "crop_activities_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_activities" ADD CONSTRAINT "crop_activities_workPlanEventId_fkey" FOREIGN KEY ("workPlanEventId") REFERENCES "work_plan_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_events" ADD CONSTRAINT "work_plan_events_workPlanId_fkey" FOREIGN KEY ("workPlanId") REFERENCES "work_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_events" ADD CONSTRAINT "work_plan_events_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_events" ADD CONSTRAINT "work_plan_events_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "collection_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_deductions" ADD CONSTRAINT "advance_deductions_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_payroll_records" ADD CONSTRAINT "monthly_payroll_records_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "monthly_payroll_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_payroll_records" ADD CONSTRAINT "monthly_payroll_records_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rental_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rental_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "small_stock_health_events" ADD CONSTRAINT "small_stock_health_events_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "small_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
