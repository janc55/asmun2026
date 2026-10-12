-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('delegado', 'docente', 'mesa', 'secretaria', 'staff', 'invitado');

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('ingreso', 'credencial', 'material', 'refrigerio', 'almuerzo', 'otro');

-- CreateEnum
CREATE TYPE "ScanResult" AS ENUM ('ok', 'duplicado', 'fuera_de_horario', 'falta_requisito', 'no_habilitado', 'no_encontrado', 'excepcion', 'anulado');

-- CreateEnum
CREATE TYPE "ScanSource" AS ENUM ('qr', 'manual', 'busqueda');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'registrador', 'operador', 'lector');

-- CreateTable
CREATE TABLE "schools" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" SERIAL NOT NULL,
    "code" CHAR(6) NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "document_id" TEXT,
    "role" "ParticipantRole" NOT NULL,
    "position" TEXT,
    "school_id" INTEGER,
    "committee_id" INTEGER,
    "country" TEXT,
    "dietary_notes" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CheckpointType" NOT NULL,
    "day" DATE NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "requires_checkpoint_id" INTEGER,
    "applies_to_roles" "ParticipantRole"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "participant_id" INTEGER,
    "checkpoint_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "result" "ScanResult" NOT NULL,
    "source" "ScanSource" NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "voided_by" INTEGER,
    "voided_reason" TEXT,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_checkpoints" (
    "user_id" INTEGER NOT NULL,
    "checkpoint_id" INTEGER NOT NULL,

    CONSTRAINT "user_checkpoints_pkey" PRIMARY KEY ("user_id","checkpoint_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participants_code_key" ON "participants"("code");

-- CreateIndex
CREATE INDEX "ix_participants_name" ON "participants"("last_name", "first_name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "committees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_requires_checkpoint_id_fkey" FOREIGN KEY ("requires_checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_checkpoints" ADD CONSTRAINT "user_checkpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_checkpoints" ADD CONSTRAINT "user_checkpoints_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Garantiza a nivel de base de datos: un solo registro válido por persona y punto (SDD sec 7.2)
CREATE UNIQUE INDEX "ux_scan_once"
  ON "scans" ("participant_id", "checkpoint_id")
  WHERE "result" IN ('ok', 'excepcion');

