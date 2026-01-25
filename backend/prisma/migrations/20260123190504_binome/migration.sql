-- CreateTable
CREATE TABLE "binome_cycles" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binome_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binome_pairs" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "tranche_age_id" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "membre_a_id" TEXT NOT NULL,
    "membre_b_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binome_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "binome_cycles_section_id_idx" ON "binome_cycles"("section_id");

-- CreateIndex
CREATE INDEX "binome_cycles_is_active_idx" ON "binome_cycles"("is_active");

-- CreateIndex
CREATE INDEX "binome_pairs_cycle_id_idx" ON "binome_pairs"("cycle_id");

-- CreateIndex
CREATE INDEX "binome_pairs_tranche_age_id_idx" ON "binome_pairs"("tranche_age_id");

-- CreateIndex
CREATE INDEX "binome_pairs_genre_idx" ON "binome_pairs"("genre");

-- CreateIndex
CREATE UNIQUE INDEX "binome_pairs_cycle_id_tranche_age_id_genre_membre_a_id_key" ON "binome_pairs"("cycle_id", "tranche_age_id", "genre", "membre_a_id");

-- CreateIndex
CREATE UNIQUE INDEX "binome_pairs_cycle_id_tranche_age_id_genre_membre_b_id_key" ON "binome_pairs"("cycle_id", "tranche_age_id", "genre", "membre_b_id");

-- AddForeignKey
ALTER TABLE "binome_cycles" ADD CONSTRAINT "binome_cycles_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binome_pairs" ADD CONSTRAINT "binome_pairs_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "binome_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binome_pairs" ADD CONSTRAINT "binome_pairs_tranche_age_id_fkey" FOREIGN KEY ("tranche_age_id") REFERENCES "tranches_age"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binome_pairs" ADD CONSTRAINT "binome_pairs_membre_a_id_fkey" FOREIGN KEY ("membre_a_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binome_pairs" ADD CONSTRAINT "binome_pairs_membre_b_id_fkey" FOREIGN KEY ("membre_b_id") REFERENCES "membres"("id") ON DELETE CASCADE ON UPDATE CASCADE;
