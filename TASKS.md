# Checklist de Tareas — ASMUN Control

> **Referencia:** [SDD.md](file:///d:/DESARROLLO/NESTJS/asmun-control/SDD.md) y [PLAN_DE_ACCION.md](file:///d:/DESARROLLO/NESTJS/asmun-control/PLAN_DE_ACCION.md)  
> **Gestor de paquetes:** `pnpm`  
> **Estado:** 🟢 Fases 1 a 5 completadas — MVP verificado y entregado  

---

## 📋 Resumen de Progreso
- **Fase 1: Base & Infraestructura** [ 6 / 6 ]
- **Fase 2: Registro & Credenciales** [ 7 / 7 ]
- **Fase 3: Control & Escaneo Móvil** [ 6 / 6 ]
- **Fase 4: Panel & Reportes** [ 5 / 5 ]
- **Fase 5: Despliegue Dokploy & MVP** [ 4 / 4 ] ✅

---

## Fase 1: Base, Infraestructura y Autenticación

- [x] **TASK-1.1: Inicialización del Monorepo pnpm y configuración global**
  - **Archivos:** `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `docker-compose.yml`
  - **Detalle:** Configurar workspace para `apps/api` y `apps/web`. Crear `docker-compose.yml` con servicio PostgreSQL 16 para desarrollo local.

- [x] **TASK-1.2: Inicialización y estructura base de NestJS (`apps/api`)**
  - **Archivos:** `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
  - **Detalle:** Configurar prefijo global `/api/v1`, CORS restrictivo/configurable, `ValidationPipe` global con `whitelist` y `transform`, y documentación Swagger/OpenAPI en `/docs`.

- [x] **TASK-1.3: Modelado de datos en Prisma y migración inicial**
  - **Archivos:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`
  - **Detalle:**
    - Crear modelos: `User`, `School`, `Committee`, `Participant`, `Checkpoint`, `UserCheckpoint`, `Scan`, `AuditLog`.
    - Enums: `ParticipantRole`, `CheckpointType`, `ScanResult`, `ScanSource`.
    - Crear migración SQL explícita para el índice único parcial:
      ```sql
      CREATE UNIQUE INDEX ux_scan_once ON scans (participant_id, checkpoint_id) WHERE result IN ('ok','excepcion');
      ```
    - Índice compuesto para búsqueda de nombres: `lower(last_name), lower(first_name)`.

- [x] **TASK-1.4: Módulo de Autenticación, RBAC y Seed de Admin inicial**
  - **Archivos:** `apps/api/src/auth/*`, `apps/api/src/users/*`, `apps/api/src/common/guards/*`
  - **Detalle:**
    - Hasheo de contraseñas con `bcrypt` o `argon2`.
    - Estrategia JWT (access token y refresh token).
    - Endpoints: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`.
    - Guards: `JwtAuthGuard`, `RolesGuard` (`admin`, `registrador`, `operador`, `lector`).
    - Seed inicial que cree automáticamente el usuario `admin` si no existe al arrancar.

- [x] **TASK-1.5: Inicialización y configuración base de Next.js (`apps/web`)**
  - **Archivos:** `apps/web/package.json`, `apps/web/src/app/layout.tsx`, `apps/web/tailwind.config.ts`, `apps/web/src/styles/globals.css`
  - **Detalle:**
    - Next.js 15 App Router con TypeScript y Tailwind CSS.
    - Configurar paleta de colores institucional del SDD (`primary-600 #1D4ED8`, `primary-700 #1E40AF`, estados `#16A34A`, `#F59E0B`, `#DC2626`).
    - Fuente tipográfica Inter y tokens visuales.

- [x] **TASK-1.6: Sistema de Sesión y Layout Principal en Next.js**
  - **Archivos:** `apps/web/src/lib/api.ts`, `apps/web/src/features/auth/*`, `apps/web/src/components/layout/*`
  - **Detalle:**
    - Pantalla de Login con feedback de error y logo ASMUN.
    - Manejo seguro de tokens/cookies y redirección según rol.
    - Layout con barra de navegación responsive y menú condicional por rol.

---

## Fase 2: Registro de Participantes y Credenciales

- [x] **TASK-2.1: Módulos CRUD de Colegios y Comités**
  - **Archivos:** `apps/api/src/schools/*`, `apps/api/src/committees/*`
  - **Detalle:** Endpoints `GET`, `POST`, `PATCH`, `DELETE` para administración de delegaciones y comités/foros.
  - **Entregado:** `GET/POST/PATCH/DELETE /api/v1/schools` y `/api/v1/committees` con paginación, búsqueda insensible a mayúsculas, `409` por nombre duplicado y `409` al intentar borrar un catálogo con participantes asociados (informa el conteo en lugar de perder el vínculo en silencio). Lectura para `admin`/`registrador`/`lector`, escritura para `admin`/`registrador` y borrado solo `admin`, según la matriz de roles del Plan de Acción.

- [x] **TASK-2.2: Generador Criptográfico de Códigos Cortos**
  - **Archivos:** `apps/api/src/common/utils/code-generator.util.ts`
  - **Detalle:**
    - Generador de 6 caracteres con alfabeto de 30 símbolos (`23456789ABCDEFGHJKMNPQRSTVWXYZ`).
    - Exclusión estricta de `0, O, 1, I, L, U`.
    - Función de normalización (mayúsculas, remoción de guiones/espacios).
    - Verificación y reintento en caso improbable de colisión en base de datos.
  - **Entregado:** `generateShortCode()` usa `crypto.randomInt` (uniforme, sin sesgo de módulo); `normalizeShortCode()` tolera minúsculas, guiones, espacios y puntos; `formatShortCode()` produce `K7P-3Q9` para la credencial; `isValidShortCode()` valida y `generateUniqueShortCode()` verifica contra la base con reintentos. La creación de participantes reintenta además ante la carrera de dos registros simultáneos.

- [x] **TASK-2.3: Módulo de Participantes en NestJS**
  - **Archivos:** `apps/api/src/participants/*`
  - **Detalle:**
    - `POST /api/v1/participants`: creación con asignación automática de código corto.
    - `GET /api/v1/participants`: paginado con filtros (`search`, `school_id`, `role`, `committee_id`).
    - `GET /api/v1/participants/{id}`: detalle e historial de escaneos.
    - `PATCH /api/v1/participants/{id}`: edición de datos y desactivación (`is_active`).
    - `GET /api/v1/participants/by-code/{code}`: resolución rápida de código corto.
  - **Entregado:** los cinco endpoints responden `{ data, meta }`; filtros por colegio/comité (acepta `school`/`schoolId`), rol, estado y búsqueda que cruza nombre, apellido, documento y código; el detalle incluye los últimos 50 escaneos con punto, operador y resultado. Código manual opcional validado (`409 CODE_EXISTS`, `400 INVALID_CODE`), código corto no editable por `PATCH` (ya está impreso en la credencial), `404 PARTICIPANT_NOT_FOUND` y verificación de las referencias a colegio/comité.

- [x] **TASK-2.4: Módulo de Importación Masiva Excel con exceljs**
  - **Archivos:** `apps/api/src/participants/import/*`
  - **Detalle:**
    - `GET /api/v1/participants/import/template`: descarga de archivo XLSX modelo.
    - `POST /api/v1/participants/import`: carga de archivo Excel/CSV.
    - Lógica tolerante a nombres de cabeceras comunes (ej. "Nombre/Nombres", "Colegio/Delegación").
    - Validación fila por fila con respuesta estructurada: filas válidas, filas con errores y mensajes descriptivos antes de confirmar la persistencia.
  - **Entregado:** plantilla XLSX con encabezados, filas de ejemplo, lista desplegable de roles y hoja de instrucciones con todas las variantes aceptadas; importador que detecta la fila de encabezados (tolera títulos previos), reconoce alias, acepta una sola columna de nombre completo y la separa, admite `.xlsx` y `.csv` (rechaza `.xls` con mensaje claro), limita a 2000 filas, informa columnas ignoradas/duplicadas, detecta duplicados dentro del archivo y contra la base, crea colegios y comités faltantes y devuelve vista previa (`confirm=false`) o confirmación (`confirm=true`) con el resultado por fila.

- [x] **TASK-2.5: Generador de Credenciales PDF en Backend**
  - **Archivos:** `apps/api/src/badges/*`
  - **Detalle:**
    - Uso de `pdf-lib` y `qrcode`.
    - Formato de tarjeta vertical 9 × 13 cm: Logo, Nombre/Apellido destacado, Comité, Cargo (si aplica), franja inferior con color por rol.
    - QR nítido con código corto sin datos sensibles + texto monoespaciado con guion cosmético (`K7P-3Q9`).
    - Layout de impresión para hoja A4 (4 credenciales por página con marcas de corte).
    - Endpoints: `GET /api/v1/badges/{id}.pdf` y `POST /api/v1/badges/pdf` (por lote de IDs o filtros).
  - **Entregado:** tarjeta de 255.12 × 368.5 pt con franja superior del color del rol (logo + nombre del evento desde `EVENT_NAME`) y franja inferior con el rol; el QR contiene **solo** el código de 6 caracteres y se imprime a 320 px (~240 dpi) sobre 96 pt. Ajuste automático del tamaño de fuente para nombres largos, limpieza a WinAnsi para que un carácter no imprimible no rompa el lote y exclusión de datos sensibles (documento, alergias). `GET /badges/{id}.pdf` acepta `?format=card|a4` y `POST /badges/pdf` pagina de 4 en 4 en A4 con marcas de corte.

- [x] **TASK-2.6: Reimpresión de Credenciales con Auditoría**
  - **Archivos:** `apps/api/src/badges/*`, `apps/api/src/audit/*`
  - **Detalle:** Permite reimprimir manteniendo el mismo código corto y generando registro en `audit_log` con acción `reimpresion` y usuario responsable.
  - **Entregado:** `POST /api/v1/badges/reprint` (y `reprint=true` en `POST /badges/pdf` y `GET /badges/{id}.pdf`) mantiene el código corto —que es inmutable— y registra en `audit_log` una entrada por participante con `action='reimpresion'`, usuario y motivo. `AuditService` (`apps/api/src/audit/`) es un módulo global reutilizable por las fases 3 y 4; la consulta `GET /audit` corresponde a TASK-4.3.

- [x] **TASK-2.7: Interfaz de Participantes y Registro Rápido en Next.js**
  - **Archivos:** `apps/web/src/app/participants/*`, `apps/web/src/features/participants/*`
  - **Detalle:**
    - Tabla con filtros combinados, buscador instantáneo y badges con colores de rol.
    - Modal de "Registro Rápido" en sitio con opción de "Guardar e imprimir credencial".
    - Interfaz para importar Excel con carga de archivo, vista previa de filas y confirmación.
    - Botones de descarga de PDF individual y masivo.
  - **Entregado:** `/participants` con tabla (código `K7P-3Q9`, rol con color, colegio, comité, alerta de restricción alimentaria, estado), filtros por colegio/comité/rol/estado, búsqueda con retardo de 350 ms y paginación; modal único de alta/edición que en modo *registro rápido* muestra pocos campos y guarda e imprime la credencial, muestra el código asignado y el historial de escaneos del participante; asistente de importación en tres pasos (archivo y opciones → vista previa con resumen, columnas detectadas y errores por fila → confirmación); gestión de colegios y comités con alta, edición y borrado; y descarga/impresión de credenciales individuales, por filtro y con reimpresión auditada. El rol `lector` ve la ficha en modo consulta.

---

### 📝 Notas de la Fase 2

- **Verificación ejecutada contra la API y PostgreSQL en vivo:** 37 comprobaciones funcionales (catálogos, códigos cortos, participantes, importación, credenciales, reimpresión auditada y limpieza) y 7 de escala (~200 participantes), todas correctas. Los datos de prueba se eliminaron al terminar y la base quedó en el mismo estado que antes de verificar.
- **Rendimiento medido (PostgreSQL local):** importación de 200 filas en ~1.9 s; PDF de 200 credenciales (50 hojas A4) en ~3.7 s; credencial individual en ~34 ms; búsqueda por nombre en ~16 ms.
- **Corrección sobre código de la Fase 1:** se retiró `enableImplicitConversion` del `ValidationPipe` global (`apps/api/src/main.ts`), porque `class-transformer` convertía el texto `'false'` a `true` (`Boolean('false')`) antes de ejecutar los `@Transform`, rompiendo los filtros booleanos (`isActive`, `reprint`, `confirm`). La conversión numérica quedó explícita con `@Type(() => Number)` en los DTO de query.
- **Variables de entorno nuevas:** `EVENT_NAME` y `EVENT_SUBTITLE` (en `.env.example` y `apps/api/.env`) definen el nombre del evento impreso en la credencial.
- **Archivo nuevo en Next.js:** `apps/web/src/app/dashboard/page.tsx` es un marcador de posición para que el inicio de sesión de `admin`/`lector` no termine en 404; lo reemplaza TASK-4.4.
- **Sin dependencias nuevas:** `exceljs`, `pdf-lib` y `qrcode` ya estaban declarados en `apps/api/package.json`; el QR contiene únicamente el código de 6 caracteres (RNF-04).

---

## Fase 3: Motor de Control y Escaneo Móvil

- [x] **TASK-3.1: Módulo de Puntos de Control en NestJS**
  - **Archivos:** `apps/api/src/checkpoints/*`
  - **Detalle:**
    - Endpoints CRUD: `GET /api/v1/checkpoints`, `POST /api/v1/checkpoints`, `PATCH /api/v1/checkpoints/{id}`.
    - Configuración de: nombre, tipo (`ingreso`, `credencial`, `material`, `refrigerio`, `almuerzo`, `otro`), día (`date`), ventana horaria opcional (`starts_at`, `ends_at`), dependencia (`requires_checkpoint_id`), roles habilitados (`applies_to_roles`).
    - Gestión de asignaciones de operador (`user_checkpoints`).
  - **Entregado:** CRUD de puntos (`GET/POST/PATCH/DELETE /checkpoints`) con filtros de día, tipo, estado y `onlyOpen`; validaciones que rechazan ventana invertida, dependencia de sí mismo, dependencia inexistente, dependencia de un día posterior y ciclos de dependencia. Cada punto devuelve su estado calculado (`abierto`, `programado`, `finalizado`, `desactivado`) reutilizando el mismo motor que los escaneos. `GET /checkpoints/available` entrega los puntos que el usuario puede operar y `PUT /users/{id}/checkpoints` reemplaza la asignación, con el CRUD de usuarios (`GET/POST/PATCH/DELETE /users`) restringido a `admin` y protegido contra quedarse sin administrador activo.

- [x] **TASK-3.2: Motor de Validación y Registro de Escaneos (`POST /scans`)**
  - **Archivos:** `apps/api/src/scans/*`
  - **Detalle:**
    - Implementar flujo estricto de validación:
      1. Verificar código y participante activo (`no_encontrado`).
      2. Verificar si el punto aplica al rol (`no_habilitado`).
      3. Verificar ventana horaria si está configurada (`fuera_de_horario`).
      4. Verificar dependencia previa cumplida con escaneo `ok`/`excepcion` (`falta_requisito`).
      5. Verificar unicidad: consulta previa y captura de error de unicidad Postgres `ux_scan_once` (`duplicado` con fecha y operador previo).
      6. Inserción exitosa (`ok`).
    - Retornar datos clave: nombre, rol, colegio y alertas alimentarias (`dietary_notes`).
  - **Entregado:** `POST /scans` ejecuta el flujo de 6 pasos en ese orden y se detiene en el primer fallo, devolviendo `result`, el `color` del semáforo, un mensaje listo para mostrar, los datos del participante, el punto con su estado y la hora con desplazamiento `-04:00`. El paso 5 traduce el error de unicidad de PostgreSQL (`P2002` sobre `ux_scan_once`) a `duplicado` con la hora y el operador previos, por lo que dos dispositivos simultáneos nunca reciben un error 500. **Todo intento queda registrado** en `scans` (incluidos los rechazados y el intento sin identificar con `participant_id` nulo), que es la base de la auditoría del evento.

- [x] **TASK-3.3: Módulo de Excepciones y Anulaciones de Escaneos**
  - **Archivos:** `apps/api/src/scans/*`, `apps/api/src/audit/*`
  - **Detalle:**
    - `POST /api/v1/scans/{id}/void`: anular escaneo previo por error (`admin`, motivo obligatorio, cambia resultado a `anulado` liberando el índice único).
    - `POST /api/v1/scans/override`: autorizar excepción (`admin`, motivo obligatorio, genera escaneo con `excepcion` y auditoría).
  - **Entregado:** `POST /scans/{id}/void` (solo `admin`, motivo obligatorio) pasa el resultado a `anulado`, guarda `voided_by` y `voided_reason`, registra la acción en `audit_log` y libera el índice único para que la persona pueda registrarse otra vez. `POST /scans/override` (solo `admin`, motivo obligatorio) salta rol, horario y dependencia —dejando escrito en la auditoría qué reglas se autorizaron— pero **no** la regla de un solo uso ni la existencia del participante; genera un escaneo `excepcion` y su fila de auditoría.

- [x] **TASK-3.4: Pantalla Móvil de Selección de Punto de Control en Next.js**
  - **Archivos:** `apps/web/src/app/scan/page.tsx`, `apps/web/src/features/scan/CheckpointSelector.tsx`
  - **Detalle:**
    - Tarjetas táctiles grandes para operadores mostrando únicamente los puntos asignados (o todos para `admin`).
    - Indicador de estado del punto (abierto, cerrado, horario).
  - **Entregado:** `/scan` muestra los puntos operables como tarjetas táctiles grandes (mínimo 92 px de alto) agrupadas en «abiertos ahora», «programados para hoy», «otros días», «finalizados» y «desactivados», cada una con tipo, ventana horaria y estado calculado en el servidor. El operador ve únicamente sus puntos asignados; los desactivados aparecen como no accesibles.

- [x] **TASK-3.5: Pantalla de Escáner Móvil Ultrarrápido en Next.js**
  - **Archivos:** `apps/web/src/app/scan/[checkpointId]/page.tsx`, `apps/web/src/features/scan/*`
  - **Detalle:**
    - Integración de lector de cámara con `html5-qrcode` o `@zxing/browser`.
    - Pestaña/botón modal para "Ingresar código manual" y "Buscar por nombre".
    - Envío automático inmediato al detectar código.
    - Manejo de cámara con permisos HTTPS y selector de cámara trasera.
  - **Entregado:** `/scan/{checkpointId}` con tres modos conmutables: **cámara** (`html5-qrcode`, cámara trasera, `qrbox` de 260 px y envío automático al detectar el QR, con filtro de 3 s para no repetir la misma lectura), **código corto** (teclado monoespaciado grande que normaliza minúsculas y guiones) y **búsqueda por nombre** (`GET /scans/search` con retardo de 350 ms y datos mínimos para identificar a la persona). La cámara se detiene mientras se muestra el resultado y se reanuda al cerrarlo, y el punto se resuelve contra los puntos que el usuario puede operar, de modo que no se puede abrir otro por URL.

- [x] **TASK-3.6: Feedback Visual y Sensorial de Escaneo (< 1 segundo)**
  - **Archivos:** `apps/web/src/features/scan/ScanResultModal.tsx`
  - **Detalle:**
    - Pantalla completa de 2 segundos:
      - **Verde (`ok`):** Ícono ✔, nombre completo, rol, colegio.
      - **Rojo (`duplicado`):** Ícono ✖, hora y operador que ya lo atendió.
      - **Amarillo (`falta_requisito` / `fuera_de_horario`):** Ícono ⚠ con explicación clara.
      - **Rojo (`no_habilitado` / `no_encontrado`):** Ícono ✖ con indicación de acudir a acreditación.
    - Banner destacado de **Alergias / Restricciones Alimentarias** si el punto es refrigerio o almuerzo.
    - Vibración móvil (`navigator.vibrate`) y pitido sintetizado (Web Audio API) diferenciado por éxito/error.
  - **Entregado:** pantalla completa con el color del semáforo, ícono distinto por resultado, título, nombre, rol, colegio y código; el mensaje del motivo y, cuando corresponde, la hora y el operador previos o el requisito pendiente. Se cierra sola (1.8 s en verde, 2.6 s en amarillo/rojo) o al tocar la pantalla. Incluye el banner destacado de **restricciones alimentarias** en refrigerio y almuerzo (RF-13), vibración con `navigator.vibrate` y pitido sintetizado con Web Audio API distinto por color. Un administrador puede autorizar la excepción o anular el registro desde la misma pantalla.

---

### 📝 Notas de la Fase 3

- **Verificación ejecutada contra la API y PostgreSQL en vivo:** 55 comprobaciones, todas correctas. Cubren los seis resultados del SDD 9.1, el día y la ventana horaria, las dependencias, la regla de un solo uso, excepciones y anulaciones auditadas, los permisos por rol y por punto asignado, los códigos de error de la API y la limpieza final de los datos de prueba (la base quedó como estaba).
- **Concurrencia comprobada:** 8 escaneos simultáneos del mismo participante en el mismo punto devuelven exactamente 1 `ok` y 7 `duplicado`, con una sola fila válida en la base gracias al índice parcial `ux_scan_once`. También se comprobó que una excepción no rompe la regla de un solo uso.
- **Todos los intentos quedan registrados (RNF-05):** además de `ok` y `excepcion`, se guardan `duplicado`, `fuera_de_horario`, `falta_requisito`, `no_habilitado`, `no_encontrado` y `anulado`, con el operador que los realizó.
- **Migración `20261012190000_timestamptz`:** `checkpoints.starts_at/ends_at`, `scans.scanned_at`, `participants.created_at` y `audit_log.created_at` pasan a `TIMESTAMPTZ` como indica el SDD. Con `timestamp` sin zona, un cambio en la zona de la sesión de PostgreSQL alteraba en silencio el significado de las ventanas horarias.
- **Zona del evento centralizada:** `apps/api/src/common/utils/datetime.util.ts` y `apps/web/src/lib/datetime.ts` resuelven día, hora y desplazamiento contra `America/La_Paz` (configurable con `EVENT_TIMEZONE`); las respuestas de escaneo usan ISO con `-04:00` (SDD 12.1).
- **Interpretación de la matriz de roles:** `operador` solo registra en los puntos que tiene asignados (SDD 13); `admin` y `registrador` operan cualquier punto vigente; `lector` no registra. Eliminar un usuario o un punto con historial se rechaza con `409` para no perder trazabilidad.
- **Endpoints añadidos no listados en el SDD 12.2:** `GET /checkpoints/available` (puntos operables por el usuario, con su estado) y `GET /scans/search` (búsqueda por nombre para el registro manual, con datos mínimos y limitada a un punto que el usuario pueda operar).
- **Pendiente para la Fase 4:** la pantalla de auditoría con anulación desde el listado histórico (anular ya es posible desde el escáner para un administrador) y la compilación de producción de Next.js, que no se ejecutó porque el servidor de desarrollo del usuario está en marcha y comparte la carpeta `.next`.

---

## Fase 4: Panel en Tiempo Real, Reportes y Auditoría

- [x] **TASK-4.1: Endpoints de Métricas y Dashboard en NestJS**
  - **Archivos:** `apps/api/src/dashboard/*`
  - **Detalle:**
    - `GET /api/v1/dashboard/summary`: métricas por punto de control (esperados, registrados, porcentaje de avance, desglose por colegio).
    - `GET /api/v1/dashboard/pending?checkpoint_id={id}`: lista detallada de participantes pendientes de cumplir el punto.
  - **Entregado:** `GET /dashboard/summary?day=&checkpointId=` agrega en tres consultas (participantes activos, puntos y sus escaneos) y devuelve los totales del evento, el avance por punto de control con desglose por rol y por colegio, el avance por tipo de control (ingreso, credencial, material, refrigerio, almuerzo) y el conteo por resultado. «Esperado» son los participantes activos cuyo rol aplica al punto, así que un almuerzo limitado a delegados no cuenta docentes, y un escaneo anulado deja de contar como registrado. `GET /dashboard/pending?checkpoint_id=&schoolId=&search=&page=` lista quiénes faltan, con paginación y las restricciones alimentarias marcadas.

- [x] **TASK-4.2: Módulo de Exportación a Excel con exceljs**
  - **Archivos:** `apps/api/src/reports/*`
  - **Detalle:**
    - `GET /api/v1/reports/participants.xlsx`: exportación completa con filtros aplicados.
    - `GET /api/v1/reports/scans.xlsx`: historial cronológico de escaneos (participante, colegio, punto, resultado, operador, hora).
  - **Entregado:** `participants.xlsx` y `scans.xlsx` con los filtros aplicados, más `pending.xlsx?checkpoint_id=` (añadido para catering: quiénes no han recibido su refrigerio o almuerzo, con hoja de resumen). Los archivos llevan encabezados fijos con autofiltro, panel congelado y columnas dimensionadas; el resultado de cada escaneo va coloreado (verde válido, rojo rechazado, gris anulado) y las restricciones alimentarias destacadas. Las fechas se exportan como texto en la hora del evento, con fecha y hora en columnas separadas, para que Excel no las reconvierta según la zona del equipo. El servidor informa las filas exportadas en la cabecera `X-Row-Count`.

- [x] **TASK-4.3: Módulo y Endpoint de Auditoría**
  - **Archivos:** `apps/api/src/audit/*`
  - **Detalle:**
    - `GET /api/v1/audit`: consulta de eventos auditados (`excepcion`, `anular_scan`, `reimpresion`), usuario autorizador, fecha y motivo.
  - **Entregado:** `GET /audit?action=&userId=&entity=&entityId=&search=&from=&to=` con paginación y filtros, más `meta.filters` con las acciones presentes (y su conteo) y los usuarios que aparecen en la auditoría, para que la pantalla no necesite una segunda llamada. Cada evento devuelve la acción etiquetada, la entidad, el motivo, la fecha y hora del evento y el usuario responsable. Se añadió `GET /scans` (historial de escaneos con filtros de día, punto, resultado, origen, operador y participante) porque es lo que permite anular un escaneo equivocado desde la interfaz (RF-15).

- [x] **TASK-4.4: Dashboard en Tiempo Real en Next.js**
  - **Archivos:** `apps/web/src/app/dashboard/*`, `apps/web/src/features/dashboard/*`
  - **Detalle:**
    - Polling suave automático cada 5 segundos.
    - Tarjetas de KPIs principales (Total ingresados, comidas entregadas vs. previstas, credenciales pendientes).
    - Gráficos de barras de progreso por punto de control.
    - Tabla interactiva de ausentes/pendientes con opción de búsqueda por colegio.
  - **Entregado:** `/dashboard` con refresco automático cada 5 s (que se pausa cuando la pestaña no está visible y se puede desactivar), filtro por día del evento, tarjetas de cifras clave (participantes activos, con ingreso registrado, registros válidos e intentos rechazados), tarjetas de avance por tipo de control, lista de puntos con barra de progreso y contadores de excepciones, duplicados y anulaciones, desglose por punto y por colegio con barras, y la tabla de pendientes del punto seleccionado con búsqueda, filtro por colegio, paginación y exportación a Excel.

- [x] **TASK-4.5: Pantalla de Reportes y Auditoría en Next.js**
  - **Archivos:** `apps/web/src/app/reports/*`, `apps/web/src/app/audit/*`
  - **Detalle:**
    - Botones de descarga directa de reportes Excel.
    - Tabla visual de auditoría con filtros por tipo de acción y usuario.
  - **Entregado:** `/reports` con tres tarjetas de descarga (participantes, escaneos y pendientes) y sus filtros; al terminar informa cuántas filas se exportaron. `/audit` con dos pestañas: «Eventos auditados» (filtros por acción, usuario y motivo, con los conteos en los selectores) y «Historial de escaneos» (filtros por día, punto, resultado y participante, con la acción «Anular» para un administrador, que pide el motivo y lo deja en la auditoría).

---

### 📝 Notas de la Fase 4

- **Verificación ejecutada contra la API y PostgreSQL en vivo:** 51 comprobaciones, todas correctas. Las cifras del panel se comparan contra consultas independientes a la base (esperados por rol y por colegio); los archivos XLSX se leen con `exceljs` para comprobar filas, encabezados y la hoja de resumen; y se validan los filtros de auditoría e historial, incluidos los permisos por rol (el `lector` consulta y descarga, el `operador` recibe 403).
- **Definición de «esperado»:** participantes activos cuyo rol aplica al punto (SDD 4 y 7.2). Un escaneo anulado libera el punto y deja de contar como registrado; los intentos rechazados se contabilizan aparte para que el organizador los vea.
- **Rendimiento:** la agregación del panel se resuelve en memoria con tres consultas (el evento maneja ~200 participantes y decenas de puntos), lo que mantiene el refresco de 5 s sin SQL crudo. La exportación de escaneos tiene un tope de 20 000 filas.
- **Fechas en Excel:** se exportan como texto en la hora del evento, con fecha y hora en columnas separadas, en lugar de como fecha nativa: `exceljs` escribe los `Date` en UTC y el archivo mostraría otra hora según el equipo que lo abra.
- **Endpoints añadidos no listados en el SDD 12.2:** `GET /scans` (historial con filtros, base de la anulación desde la interfaz) y `GET /reports/pending.xlsx` (pendientes de un punto para catering).
- **Cambios de apoyo:** el listado de participantes, la búsqueda del escáner y los pendientes comparten ahora un único filtro de búsqueda (`apps/api/src/common/utils/participant-search.util.ts`), y CORS expone `Content-Disposition` y `X-Row-Count`.
- **Pendiente para la Fase 5:** la compilación de producción de Next.js sigue sin ejecutarse porque el servidor de desarrollo del usuario comparte la carpeta `.next`; el empaquetado con Docker de la Fase 5 hará ese build.

---

## Fase 5: Empaquetado Docker, Dokploy y Verificación MVP

- [x] **TASK-5.1: Dockerfiles multi-stage optimizados**
  - **Archivos:** `apps/api/Dockerfile`, `apps/web/Dockerfile`, `.dockerignore`
  - **Detalle:** Construccion ligera basada en `node:20-alpine` con pnpm cacheando capas de dependencias y podando devDependencies.
  - **Entregado:** `apps/api/Dockerfile` multi-stage con etapas `base/builder/runner`; genera el cliente Prisma en build, copia solo `dist/`, `prisma/` y `node_modules` en la imagen de ejecucion. Usuario no-root `nestjs:1001`. `apps/web/Dockerfile` multi-stage con salida `standalone` de Next.js; imagen final con solo `server.js`, `public/` y `.next/static`. Ambas imagenes desde `node:20-alpine` con `pnpm@11.16.0` via corepack.

- [x] **TASK-5.2: Configuracion para Dokploy y Variables de Entorno**
  - **Archivos:** `docker-compose.dokploy.yml`, `.env.example`, `README.md`
  - **Detalle:** Definicion de servicios `db`, `api` y `web`. Exposicion de puertos, red interna y documentacion para despliegue directo en Dokploy.
  - **Entregado:** `docker-compose.dokploy.yml` con servicio `db` (PostgreSQL 16, healthcheck, volumen `asmun_postgres_data`), `api` (depends_on db healthy, todas las variables de entorno, puerto 4000) y `web` (depends_on api, `API_URL` interna y `NEXT_PUBLIC_API_URL` publica, puerto 3000). Red `asmun_network` bridge. `README.md` con instrucciones de despliegue Dokploy paso a paso, incluyendo la lista de variables de entorno criticas.

- [x] **TASK-5.3: Script de Inicializacion y Seed de Produccion**
  - **Archivos:** `apps/api/prisma/seed.ts`, `apps/api/docker-entrypoint.sh`
  - **Detalle:** Script que aplica migraciones pendientes y garantiza la existencia del usuario `admin` inicial y checkpoints de prueba/base.
  - **Entregado:** `seed.ts` crea idempotentemente: usuario `admin` (y `registrador`/`operador` de base), 6 colegios, 6 comites y 14 checkpoints de ejemplo para 4 dias (credencial, material, ingresos, refrigerios y almuerzos con dependencias encadenadas). `docker-entrypoint.sh` ejecuta `prisma migrate deploy` antes de iniciar el servidor NestJS, garantizando que la base este migrada al arrancar el contenedor.

- [x] **TASK-5.4: Verificacion Integral de Criterios de Aceptacion del MVP**
  - **Script:** `scripts/verify-mvp.ps1`
  - **Resultado: 29/29 verificaciones OK — 0 fallos**
  - **Criterios verificados:**
    - [x] Servidores activos: Frontend :3000 y Backend :4000
    - [x] Login admin OK, GET /auth/me, rechazo de token invalido (401)
    - [x] Catalogos: GET/POST/DELETE colegios y comites (11 colegios, 10 comites)
    - [x] Participante creado con codigo corto de 6 caracteres (`T47B62`)
    - [x] Resolucion por codigo: GET /participants/by-code OK
    - [x] Busqueda por nombre y PATCH de participante
    - [x] Credencial PDF individual: 6 KB en 51 ms (SDD exige menos de 3 s)
    - [x] PDF masivo A4 por lote (POST /badges/pdf) OK
    - [x] Escaneo QR/manual: result=ok en **18 ms** (SDD exige menos de 1000 ms)
    - [x] Doble escaneo bloqueado: result=duplicado (garantia ACID)
    - [x] Dashboard: activos=402, pendientes=399
    - [x] Exportacion XLSX: participants (403 filas), scans (13 filas), pending
    - [x] Auditoria e historial de escaneos accesibles
