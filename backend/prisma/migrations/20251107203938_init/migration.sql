-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LOCALITE', 'SOUS_LOCALITE_ADMIN', 'SECTION_USER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "sous_localite_id" TEXT,
    "section_id" TEXT,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sous_localites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sous_localites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sous_localite_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rencontre_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_reunion" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rencontre_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rencontres" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heure_debut" TEXT NOT NULL,
    "heure_fin" TEXT NOT NULL,
    "moderateur" TEXT NOT NULL,
    "moniteur" TEXT NOT NULL,
    "theme" TEXT,
    "ordre_du_jour" JSONB,
    "presence_homme" INTEGER NOT NULL DEFAULT 0,
    "presence_femme" INTEGER NOT NULL DEFAULT 0,
    "presence_totale" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "attachments" JSONB,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rencontres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rencontre_types_name_key" ON "rencontre_types"("name");

-- CreateIndex
CREATE INDEX "rencontres_section_id_idx" ON "rencontres"("section_id");

-- CreateIndex
CREATE INDEX "rencontres_type_id_idx" ON "rencontres"("type_id");

-- CreateIndex
CREATE INDEX "rencontres_date_idx" ON "rencontres"("date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_sous_localite_id_fkey" FOREIGN KEY ("sous_localite_id") REFERENCES "sous_localites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sous_localites" ADD CONSTRAINT "sous_localites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_sous_localite_id_fkey" FOREIGN KEY ("sous_localite_id") REFERENCES "sous_localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "rencontre_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
