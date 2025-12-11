-- Créer la table localites
CREATE TABLE "localites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "localites_pkey" PRIMARY KEY ("id")
);

-- Créer l'index unique sur le nom
CREATE UNIQUE INDEX "localites_name_key" ON "localites"("name");

-- Insérer la localité de Mbour
INSERT INTO "localites" ("id", "name", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'La Localité de Mbour', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Ajouter la colonne localite_id à sous_localites (nullable temporairement)
ALTER TABLE "sous_localites" ADD COLUMN "localite_id" TEXT;

-- Lier toutes les sous-localités existantes à la localité de Mbour
UPDATE "sous_localites" 
SET "localite_id" = (SELECT "id" FROM "localites" WHERE "name" = 'La Localité de Mbour');

-- Rendre la colonne NOT NULL
ALTER TABLE "sous_localites" ALTER COLUMN "localite_id" SET NOT NULL;

-- Ajouter la contrainte de clé étrangère
ALTER TABLE "sous_localites" 
ADD CONSTRAINT "sous_localites_localite_id_fkey" 
FOREIGN KEY ("localite_id") REFERENCES "localites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
