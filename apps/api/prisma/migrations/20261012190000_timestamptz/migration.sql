-- Ventanas horarias y marcas de tiempo con zona (SDD 7.2 y 12.1).
--
-- Con `timestamp without time zone`, PostgreSQL convierte `now()`/`CURRENT_TIMESTAMP`
-- según la zona de la sesión: si un cliente se conecta con otra zona (por ejemplo el
-- servidor de producción o psql desde otra máquina), el instante guardado cambia de
-- significado en silencio y las reglas de ventana horaria dejan de ser fiables.
-- Los valores existentes se guardaron con la sesión en UTC, por eso se reinterpretan
-- como UTC al convertir.

ALTER TABLE "checkpoints" ALTER COLUMN "starts_at" TYPE TIMESTAMPTZ(3) USING "starts_at" AT TIME ZONE 'UTC';
ALTER TABLE "checkpoints" ALTER COLUMN "ends_at" TYPE TIMESTAMPTZ(3) USING "ends_at" AT TIME ZONE 'UTC';
ALTER TABLE "scans" ALTER COLUMN "scanned_at" TYPE TIMESTAMPTZ(3) USING "scanned_at" AT TIME ZONE 'UTC';
ALTER TABLE "participants" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
ALTER TABLE "audit_log" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';
