# SDD — Sistema de Registro, Credencialización y Control ASMUN

| Campo | Detalle |
|---|---|
| **Proyecto** | ASMUN Control |
| **Cliente** | Colegio Americano de Oruro |
| **Evento** | ASMUN (Modelo de las Naciones Unidas) |
| **Versión del documento** | 1.1 (simplificado) |
| **Fecha** | 12 de octubre de 2026 |
| **Stack** | NestJS · PostgreSQL · Next.js · TypeScript |

---

## 0. Cómo usar este documento

Este SDD define **qué** debe hacer el sistema (funcionalidades, reglas de negocio, modelo de datos y API). **No impone versiones ni herramientas exactas.**

**Reglas para el agente de desarrollo:**
1. **Usar versiones estables y compatibles de Node.js, pnpm y PostgreSQL disponibles en el entorno. No actualizar ni forzar versiones sin necesidad; si una dependencia no es compatible, elegir una versión compatible de esa dependencia antes de cambiar el entorno.
2. **Los detalles no especificados los decide el agente** con criterio, priorizando que el sistema funcione y sea simple.
3. **Las reglas de negocio, el modelo de datos y la API son lo importante**; los nombres de carpetas, librerías concretas y detalles de estilo son sugerencias.
4. **Preferir lo simple.** Si algo se puede resolver de forma más sencilla sin perder funcionalidad, hacerlo así.
5. Gestor de paquetes para todo el monorepo: `pnpm` (si ya existe otro gestor configurado en el repositorio, conservarlo para evitar cambios innecesarios).

**Skills recomendadas (opcionales, solo si el agente las soporta y sin bloquear el desarrollo):**

```bash
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices
```

Para NestJS, Next.js y Prisma, priorizar las guías oficiales de sus respectivas documentaciones. 

Si alguna falla al instalarse, continuar sin ella. Ante una contradicción, prevalece este SDD en reglas de negocio, datos y API.

---

## 1. Introducción

### 1.1 Propósito
Sistema para **registrar participantes, generar credenciales y controlar** el ingreso, la entrega de credencial, la entrega de material, refrigerios y almuerzos durante el evento ASMUN.

### 1.2 Principio rector
> Todo lo que se controla es un **punto de control** y todo escaneo es un **evento registrado**.

Ingreso, refrigerio, almuerzo, entrega de credencial y entrega de material **no son módulos distintos**: son filas de una misma tabla (`checkpoints`) con día, horario y reglas propias. Agregar un nuevo control no requiere programar nada nuevo.

### 1.3 Datos del evento
- ~200 participantes, 4 días.
- Wifi confiable en todos los puntos, además de datos móviles. **El sistema funciona siempre en línea.**
- 2 dispositivos por punto de control.
- Credenciales impresas con anticipación; también se pueden imprimir de último momento (hay impresora).
- Los refrigerios y almuerzos pueden variar según el día (se configuran como puntos de control por día).
- Las listas de inscritos vienen en Excel.

### 1.4 Alcance
**Incluye:** registro de participantes (manual y carga masiva desde Excel), credenciales imprimibles con QR, escaneo y registro manual por código corto, reglas de un solo uso y dependencias, panel en tiempo real, reportes exportables.

**No incluye:** modo sin conexión, control de pagos, fotos en la credencial, cobros en línea, certificados, app nativa, pruebas automatizadas (por ahora).

### 1.5 Definiciones

| Término | Significado |
|---|---|
| **Participante** | Persona con credencial: delegado, docente asesor, mesa directiva, secretaría, staff, invitado. |
| **Punto de control** | Acción que se registra una vez por persona (y por día cuando aplica). |
| **Código corto** | Identificador de 6 caracteres impreso junto al QR, usado también para registro manual. |
| **Escaneo (scan)** | Evento: quién, qué punto, cuándo, quién lo registró. |

---

## 2. Usuarios y roles

| Rol | Descripción | Permisos principales |
|---|---|---|
| `admin` | Organizadores del evento | Todo: configuración, usuarios, excepciones, reportes. |
| `registrador` | Equipo de acreditación | Crear/editar participantes, imprimir credenciales, puntos de entrega de credencial y material. |
| `operador` | Personal en puertas y comedor | Solo pantalla de escaneo de los puntos que se le asignen. |
| `lector` | Dirección o coordinación | Solo panel y reportes (solo lectura). |

---

## 3. Requisitos funcionales

### 3.1 Registro
- **RF-01** Crear, editar y desactivar participantes con: nombres, apellidos, colegio, rol, cargo (opcional), comité, país asignado, documento de identidad (opcional), restricciones alimentarias, observaciones.
- **RF-02** Carga masiva desde Excel/CSV con plantilla descargable, vista previa y reporte de errores por fila. Debe tolerar variaciones razonables en los encabezados de las listas de los colegios.
- **RF-03** Gestión de colegios/delegaciones, comités y países.
- **RF-04** Registro rápido en sitio (mismo día) con impresión inmediata de credencial.

### 3.2 Credencialización
- **RF-05** Generar código corto único por participante al crearlo.
- **RF-06** Generar credenciales en PDF (individual, por colegio o todas), varias por hoja.
- **RF-07** Color por rol para identificación visual rápida (chips de la interfaz; la credencial usa la franja azul del diseño).
- **RF-08** Reimpresión de credencial por pérdida, con registro de la reimpresión.

### 3.3 Control
- **RF-09** Configurar puntos de control: nombre, tipo, día, hora de inicio y fin, dependencia de otro punto. Cada punto es de un solo uso por persona.
- **RF-10** Escanear QR con la cámara del celular y registrar el evento.
- **RF-11** Registro manual ingresando el código corto (o buscando por nombre) cuando el QR no se pueda leer.
- **RF-12** Respuesta visual inmediata: verde (OK), rojo (rechazado) o amarillo (advertencia), con el motivo y la hora de la acción previa.
- **RF-13** Mostrar alertas alimentarias del participante en puntos de comida.
- **RF-14** Excepciones autorizadas por `admin` con motivo obligatorio y registro de auditoría.
- **RF-15** Anular un escaneo registrado por error (solo `admin`, con motivo).

### 3.4 Panel y reportes
- **RF-16** Panel en tiempo real: ingresados vs. esperados, refrigerios y almuerzos entregados vs. esperados, credenciales y materiales pendientes, desglose por colegio.
- **RF-17** Listado de quienes aún no cumplen un punto de control (por ejemplo, "no han llegado").
- **RF-18** Exportación a Excel/CSV de participantes, escaneos y resúmenes por punto de control.

---

## 4. Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-01 | **Rendimiento:** respuesta de un escaneo en menos de 1 segundo. Carga esperada baja (~200 participantes, 2 dispositivos por punto). |
| RNF-02 | **Usabilidad:** una persona sin capacitación debe poder escanear con 5 minutos de explicación. Botones grandes, textos cortos, un solo flujo por pantalla. |
| RNF-03 | **Accesibilidad:** buen contraste; estados nunca indicados solo por color (siempre ícono y texto). |
| RNF-04 | **Privacidad:** el QR no contiene datos personales (muchos participantes son menores). |
| RNF-05 | **Auditoría:** todo escaneo, excepción y anulación queda registrado y no se borra. |
| RNF-06 | **Compatibilidad:** navegadores móviles modernos (Chrome en Android, Safari en iOS). |
| RNF-07 | **Idioma:** interfaz en español. |

---

## 5. Arquitectura

```
┌─────────────────────────────────────┐
│ Next.js + TypeScript                │
│ · Panel admin / registro            │
│ · Pantalla móvil de escaneo         │
└──────────────────┬──────────────────┘
                   │ HTTPS · JSON · JWT
                   ▼
┌────────────────────────────────────────────────┐
│ NestJS (/api/v1)                               │
│ módulos → controladores → servicios → Prisma  │
└──────────────────────┬─────────────────────────┘
                       ▼
                 ┌──────────────┐
                 │ PostgreSQL   │
                 └──────────────┘
```

### 5.1 Decisiones clave
1. **API primero.** Toda la lógica de negocio vive en NestJS; Next.js consume la API REST. No duplicar reglas de negocio en el frontend.
2. **Un solo mecanismo de control.** Una tabla `checkpoints` y una tabla `scans` cubren todos los casos.
3. **Siempre en línea.** Cada escaneo se valida y registra directamente en el servidor. No hay cola local ni sincronización.
4. **La base de datos garantiza el "un solo uso".** Un índice único evita duplicados aunque dos dispositivos escaneen al mismo tiempo.
5. **Una sola API de negocio.** NestJS es la única fuente de verdad para validaciones, permisos y escritura de datos; Next.js no replica esas reglas.
6. **Errores y concurrencia.** La API debe traducir conflictos de unicidad de PostgreSQL a `duplicado` de forma controlada, sin devolver errores 500 al operador.
7. **Sesión segura en navegador.** No guardar refresh tokens en `localStorage`; preferir cookies `HttpOnly`, `Secure` y `SameSite` si el flujo de autenticación elegido lo permite, sin añadir un proveedor externo.

---

## 6. Stack tecnológico

Usar versiones estables compatibles con el entorno; fijar las dependencias en el lockfile y evitar actualizaciones innecesarias.

| Capa | Tecnología | Notas |
|---|---|---|
| Backend | **NestJS + TypeScript** | API REST modular, controladores, servicios, validación y OpenAPI/Swagger. |
| ORM / migraciones | **Prisma** | Esquema tipado y migraciones; usar SQL explícito si hace falta para índices parciales de PostgreSQL. |
| Base de datos | **PostgreSQL** | Restricciones e índices únicos como garantía de concurrencia. |
| Autenticación | JWT (access + refresh), Passport/NestJS guards, contraseñas con hash seguro (`argon2` o `bcrypt`) | Autorización por rol y por punto asignado. |
| Frontend | **Next.js + TypeScript** (App Router) | Interfaz responsive, móvil primero. No crear una API paralela en Next.js: NestJS es la API de negocio. |
| Estilos | **Tailwind CSS** | Mantener la paleta y los componentes definidos en la sección 10. |
| Estado de servidor | Fetch nativo o **TanStack Query** | Elegir uno; para este MVP, preferir fetch nativo salvo que la invalidación/caché justifique TanStack Query. |
| Rutas | **Next.js App Router** | No usar React Router. |
| Escáner QR | `html5-qrcode` o `@zxing/browser` | Elegir uno tras probarlo en los celulares reales. |
| PDF de credenciales | `pdf-lib` + `qrcode` (backend NestJS) | Generación en servidor; conservar el formato y la impresión por lotes. |
| Excel | `exceljs` | Importación/exportación XLSX y CSV; validar filas antes de guardar. |
| Tiempo real del panel | Polling cada 5 s | Suficiente para este evento; no implementar WebSockets. |
| Despliegue | Docker + **Dokploy** en el VPS del desarrollador | Dokploy gestiona dominio y HTTPS (la cámara del navegador exige HTTPS). |

---

## 7. Modelo de datos

El sistema se usa para un solo evento, por lo que no hay tabla de eventos: el nombre y las fechas del evento van en la configuración.

### 7.1 Diagrama lógico (resumen)

```
schools ──< participants >── committees
                │
                ├──< scans >── checkpoints
                │                 │
users ──────────┘                 └── requires_checkpoint_id (autorreferencia)
audit_log
```

### 7.2 Tablas

El esquema es una guía; el agente puede ajustar tipos y nombres de forma razonable, manteniendo las reglas de integridad indicadas. Con Prisma, implementar el índice parcial `ux_scan_once` mediante una migración SQL explícita si la versión usada no lo representa directamente en `schema.prisma`.

```sql
CREATE TABLE schools (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  city  TEXT
);

CREATE TABLE committees (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,                 -- 'Consejo de Seguridad'
  short_name  TEXT                           -- 'CS'
);

CREATE TYPE participant_role AS ENUM
  ('delegado','docente','mesa','secretaria','staff','invitado');

CREATE TABLE participants (
  id              SERIAL PRIMARY KEY,
  code            CHAR(6) NOT NULL UNIQUE,   -- código corto (ver sección 8)
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  document_id     TEXT,
  role            participant_role NOT NULL,
  position        TEXT,                      -- cargo (solo quienes lo tienen)
  school_id       INT REFERENCES schools(id),
  committee_id    INT REFERENCES committees(id),
  country         TEXT,                      -- país que representa
  dietary_notes   TEXT,                      -- alergias / restricciones
  notes           TEXT,                      -- observaciones
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_participants_name ON participants (lower(last_name), lower(first_name));

CREATE TYPE checkpoint_type AS ENUM
  ('ingreso','credencial','material','refrigerio','almuerzo','otro');

CREATE TABLE checkpoints (
  id                      SERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,         -- 'Almuerzo día 1'
  type                    checkpoint_type NOT NULL,
  day                     DATE NOT NULL,
  starts_at               TIMESTAMPTZ,           -- ventana opcional
  ends_at                 TIMESTAMPTZ,
  requires_checkpoint_id  INT REFERENCES checkpoints(id),  -- dependencia
  applies_to_roles        participant_role[],    -- NULL = todos
  is_active               BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TYPE scan_result AS ENUM
  ('ok','duplicado','fuera_de_horario','falta_requisito',
   'no_habilitado','no_encontrado','excepcion','anulado');
CREATE TYPE scan_source AS ENUM ('qr','manual','busqueda');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','registrador','operador','lector')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE scans (
  id              UUID PRIMARY KEY,
  participant_id  INT REFERENCES participants(id),
  checkpoint_id   INT NOT NULL REFERENCES checkpoints(id),
  user_id         INT NOT NULL REFERENCES users(id),
  result          scan_result NOT NULL,
  source          scan_source NOT NULL,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT,
  voided_by       INT REFERENCES users(id),
  voided_reason   TEXT
);

-- Garantiza a nivel de base de datos: un solo registro válido por persona y punto
CREATE UNIQUE INDEX ux_scan_once
  ON scans (participant_id, checkpoint_id)
  WHERE result IN ('ok','excepcion');



-- Qué puntos puede operar cada usuario 'operador'
CREATE TABLE user_checkpoints (
  user_id       INT REFERENCES users(id),
  checkpoint_id INT REFERENCES checkpoints(id),
  PRIMARY KEY (user_id, checkpoint_id)
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id),
  action      TEXT NOT NULL,        -- 'excepcion','anular_scan','reimpresion',...
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Nota:** los puntos de un solo uso "por día" no necesitan lógica extra. Como cada punto tiene un `day`, "Almuerzo día 1" y "Almuerzo día 2" son puntos distintos y el índice único hace el resto. Como los refrigerios y almuerzos pueden variar por día, el `admin` crea los puntos que correspondan para cada día (por ejemplo, 2 refrigerios el día 1 y 1 el día 2).

> **Al anular un escaneo** (`void`), su `result` pasa a `anulado`, lo que libera el índice único y permite registrar de nuevo a esa persona en ese punto.

---

## 8. Código corto y QR

### 8.1 Requisito
Debe ser **corto, fácil de dictar y de teclear**, para poder hacer el registro manual cuando el QR no se pueda leer.

### 8.2 Diseño del código
- **Longitud:** 6 caracteres.
- **Alfabeto:** `23456789ABCDEFGHJKMNPQRSTVWXYZ` (30 símbolos). Se excluyen `0, O, 1, I, L, U` para evitar confusiones.
- **Insensible a mayúsculas**; el sistema normaliza (`k7p3q9` → `K7P3Q9`) y acepta con o sin guion.
- **Generación:** aleatoria con `secrets.choice`, verificando unicidad.
- **Presentación en la credencial:** `K7P-3Q9` (el guion es solo cosmético y no forma parte del código guardado).

### 8.3 Contenido del QR
El QR contiene **únicamente el código de 6 caracteres** (por ejemplo `K7P3Q9`): QR de baja densidad, fácil de leer, cero datos personales, y la misma entrada sirve para escaneo y teclado.

**Seguridad:** el código por sí solo no da acceso a nada. Solo un usuario autenticado puede consultarlo o registrar un escaneo con él. El riesgo de un QR compartido se controla con la regla de **un solo uso** por punto y el registro de cada evento.

### 8.4 Registro manual
Si el QR falla, el operador:
1. Toca **"Ingresar código"** y escribe los 6 caracteres, o
2. Toca **"Buscar por nombre"** y selecciona a la persona.

El evento queda marcado con `source = manual` o `busqueda`.

---

## 9. Reglas de negocio y flujo de validación

### 9.1 Orden de validación
Al recibir un código y un punto de control, el sistema evalúa en este orden y se detiene en el primer fallo:

1. ¿El código existe y el participante está activo? → si no: `no_encontrado`.
2. ¿El punto aplica al rol del participante? → si no: `no_habilitado`.
3. ¿Estamos dentro de la ventana horaria del punto? → si no: `fuera_de_horario`.
4. ¿Existe dependencia y no está cumplida? → `falta_requisito` (ejemplo: material sin credencial entregada).
5. ¿Ya existe un escaneo válido para ese punto? → `duplicado`, mostrando la hora y el operador previos.
6. Todo correcto → `ok`.

Si dos dispositivos escanean a la misma persona al mismo tiempo, el índice único de la base de datos deja pasar solo uno; el otro recibe `duplicado`.

### 9.2 Respuesta en pantalla

| Resultado | Color | Mensaje de ejemplo |
|---|---|---|
| `ok` | Verde | ✔ **Ana Quispe** · Delegada · Colegio X. Registrado. |
| `duplicado` | Rojo | ✖ Ya recibió **Almuerzo día 1** a las 12:40. |
| `falta_requisito` | Amarillo | ⚠ Falta recoger su **credencial**. |
| `fuera_de_horario` | Amarillo | ⚠ Este punto abre a las 12:00. |
| `no_habilitado` | Rojo | ✖ No habilitado para este punto. Consulte con acreditación. |
| `no_encontrado` | Rojo | ✖ Código no encontrado. Verifique o busque por nombre. |

En puntos de comida, si el participante tiene `dietary_notes`, se muestra un aviso destacado junto al resultado.

### 9.3 Excepciones
Solo un `admin` puede autorizar una excepción (por ejemplo, entregar almuerzo fuera de horario). Exige un motivo, genera un escaneo con `result = excepcion` y una fila en `audit_log`.

---

## 10. Diseño de interfaz (UX/UI)

### 10.1 Principios
- **Moderno, sencillo y directo.** Una tarea principal por pantalla.
- **Accesible para estudiantes y personal sin capacitación:** textos cortos, botones grandes, íconos.
- **Móvil primero**; el panel de administración se adapta a escritorio.
- Estados siempre con **color + ícono + texto**.

### 10.2 Paleta de colores

| Token | Uso | Valor sugerido |
|---|---|---|
| `primary-600` | Azul principal: botones, enlaces, encabezados | `#1D4ED8` |
| `primary-700` | Hover / activo | `#1E40AF` |
| `primary-50` | Fondos suaves azules | `#EFF6FF` |
| `gray-900` | Texto principal | `#1F2937` |
| `gray-600` | Texto secundario | `#4B5563` |
| `gray-200` | Bordes y divisores | `#E5E7EB` |
| `gray-100` | Fondo de tarjetas / secciones | `#F3F4F6` |
| `white` | Fondo base | `#FFFFFF` |

Se pueden usar degradados para mejorar el diseño.

**Colores de estado (solo para resultados de escaneo):** verde `#16A34A`, amarillo `#F59E0B`, rojo `#DC2626`.

**Colores por rol** (chips de la interfaz; la franja de la credencial es fija, azul del diseño):

| Rol | Color |
|---|---|
| Delegado | `#1D4ED8` (azul institucional) |
| Docente | `#0F766E` (verde-azulado) |
| Mesa | `#7C2D12` (marrón) |
| Secretaría | `#6D28D9` (violeta) |
| Staff | `#111827` (gris oscuro) |
| Invitado | `#B45309` (dorado) |

### 10.3 Tipografía y estilo
- Fuente: **Inter** (o la del sistema).
- Tamaño base 16 px; resultado de escaneo con texto de 24–32 px.
- Esquinas redondeadas, sombras suaves, mucho espacio en blanco.

### 10.4 Pantallas principales

| Pantalla | Usuario | Contenido |
|---|---|---|
| **Inicio de sesión** | Todos | Usuario y contraseña. Logo ASMUN. |
| **Elegir punto de control** | Operador | Tarjetas grandes con los puntos asignados y su horario. |
| **Escáner** | Operador | Cámara a pantalla completa, botones "Ingresar código" y "Buscar nombre". Resultado a pantalla completa 2 s con color y sonido/vibración. |
| **Panel** | Admin / lector | Tarjetas con cifras clave y barras de progreso por punto de control. |
| **Participantes** | Registrador / admin | Tabla con búsqueda, filtros por colegio/rol/comité, acciones de editar e imprimir. |
| **Registro rápido** | Registrador | Formulario corto y botón "Guardar e imprimir credencial". |
| **Importar** | Admin / registrador | Subir Excel, vista previa, corregir errores. |
| **Puntos de control** | Admin | Crear/editar puntos, horarios y dependencias. |
| **Reportes** | Admin / lector | Descargas en Excel. |
| **Auditoría** | Admin | Excepciones, anulaciones y reimpresiones. |

---

## 11. Credencial

- **Formato:** tarjeta de 7.5 × 10.5 cm (vertical); ajustable. En hoja A4: 4 por página con marcas de corte.
- **Sin foto.**
- **Fondo:** imagen única `apps/api/src/assets/fondo-credencial.png` (886 × 1240 px, 300 dpi) con franja superior "ASMUN 2026 / AMERICAN SCHOOL" + logo, marca de agua de mapa del mundo, escudo del colegio y franja inferior azul.
- **Contenido superpuesto al fondo:**
  - **Comité** (gris `#4B5563`).
  - **Nombre completo** (grande, azul institucional `#13134F`).
  - **País** (gris).
  - **Cargo** (blanco, centrado en la franja inferior a la derecha del escudo; solo quienes lo tienen).
  - **QR** (3.3 cm, código corto de 6 caracteres) sobre **placa blanca con esquinas redondeadas** para no confundirse con la marca de agua.
- **No se imprimen datos sensibles** (documento, alergias).
- **Reimpresión:** conserva el mismo código y queda registrada en `audit_log`.

---

## 12. API (REST, `/api/v1`)

### 12.1 Convenciones
- JSON, fechas en ISO 8601 con zona horaria (`America/La_Paz`, UTC-4).
- Errores con formato `{ "code": "...", "message": "..." }`.
- Autenticación: `Authorization: Bearer <token>`. NestJS publica el contrato OpenAPI/Swagger en `/docs`.
- Documentación OpenAPI/Swagger generada desde NestJS y disponible en `/docs`.

### 12.2 Endpoints

**Autenticación**
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Devuelve access y refresh token. |
| POST | `/auth/refresh` | Renueva el token. |
| GET | `/auth/me` | Datos del usuario actual. |

**Participantes**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/participants?search=&school=&role=&committee=` | Lista con filtros y paginación. |
| POST | `/participants` | Crea participante y genera código. |
| GET | `/participants/{id}` | Detalle e historial de escaneos. |
| PATCH | `/participants/{id}` | Edita. |
| GET | `/participants/by-code/{code}` | Busca por código corto. |
| POST | `/participants/import` | Carga masiva (Excel/CSV). |
| GET | `/participants/import/template` | Plantilla de Excel. |

**Credenciales**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/badges/{participant_id}.pdf` | Credencial individual. |
| POST | `/badges/pdf` | PDF masivo según filtros o lista de IDs. |

**Puntos de control**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/checkpoints` | Lista. |
| POST | `/checkpoints` | Crea (admin). |
| PATCH | `/checkpoints/{id}` | Edita (admin). |

**Escaneos**
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/scans` | Registra un escaneo. |
| POST | `/scans/{id}/void` | Anula con motivo (admin). |
| POST | `/scans/override` | Excepción autorizada (admin). |

**Panel y reportes**
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/dashboard/summary` | Cifras por punto de control. |
| GET | `/dashboard/pending?checkpoint_id=` | Quiénes faltan. |
| GET | `/reports/participants.xlsx` | Exportación de participantes. |
| GET | `/reports/scans.xlsx` | Exportación de escaneos. |

**Administración**
| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/users`, `/schools`, `/committees` | Mantenimiento. |
| GET | `/audit` | Registro de auditoría. |

### 12.3 Ejemplo de escaneo

**Petición**
```json
POST /api/v1/scans
{
  "code": "K7P3Q9",
  "checkpoint_id": 12,
  "source": "qr"
}
```

**Respuesta (OK)**
```json
{
  "id": "0b8d5a2e-6a3f-4f0e-9d0a-2f7e3b1c9a11",
  "result": "ok",
  "participant": {
    "name": "Ana Quispe",
    "role": "delegado",
    "school": "Colegio X",
    "dietary_notes": null
  }
}
```

**Respuesta (duplicado)**
```json
{
  "id": "7c1e9b34-1d2a-4c55-8f0b-3a6d2e4f5b90",
  "result": "duplicado",
  "message": "Ya recibió Almuerzo día 1",
  "previous": { "at": "2026-10-23T12:31:02-04:00", "by": "Luis M." }
}
```

El servidor genera el `id` del escaneo y usa la hora del servidor.

---

## 13. Seguridad

- HTTPS (lo provee Dokploy; necesario también para usar la cámara).
- Contraseñas con hash seguro (`argon2` o `bcrypt`).
- Access token de duración razonable y refresh token para no cerrar sesión durante el evento.
- Autorización por rol en cada endpoint.
- Un `operador` solo puede registrar en los puntos que tiene asignados.
- Validación de entradas con `class-validator`/`class-transformer` en DTOs de NestJS; acceso a datos con Prisma y consultas parametrizadas.
- **Privacidad de menores:** QR sin datos personales, acceso a datos solo con sesión y reportes restringidos por rol.
- Auditoría de excepciones, anulaciones y reimpresiones.
- Respaldo de PostgreSQL con la herramienta de backups de Dokploy (o `pg_dump`), idealmente una copia manual antes del evento.
- No se define política de retención: los datos se conservan tras el evento.

---

## 14. Estructura del repositorio (sugerida)

```
asmun/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── SDD.md
└── apps/
    ├── api/                         # NestJS
    │   ├── package.json
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── migrations/
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       ├── common/              # guards, filtros, DTOs compartidos
    │       ├── auth/
    │       ├── participants/
    │       ├── checkpoints/
    │       ├── scans/
    │       ├── dashboard/
    │       ├── reports/
    │       ├── users/
    │       └── audit/
    └── web/                         # Next.js App Router
        ├── package.json
        ├── next.config.ts
        └── src/
            ├── app/                 # rutas y layouts
            ├── components/
            ├── features/            # scanner, participants, dashboard...
            ├── lib/                 # cliente API, sesión y utilidades
            └── styles/
```

---

## 15. Despliegue

**Hosting:** VPS del desarrollador con **Dokploy**.

- Servicios: `db` (PostgreSQL), `api` (NestJS/Node.js) y `web` (Next.js ejecutado como servidor Node.js).
- Dokploy se encarga del dominio y del certificado HTTPS; no hace falta configurar Nginx ni certificados a mano. Configurar una URL de API configurable por entorno (`API_URL`) y exponer la API bajo `/api/v1` mediante el dominio/proxy de Dokploy. Mantener CORS restringido al dominio de la aplicación.
- Variables de entorno en `.env.example`: `DATABASE_URL`, secretos JWT, URL pública del frontend/API y credenciales necesarias para el usuario `admin` inicial. No incluir secretos reales en el repositorio.
- Al arrancar, el sistema debe crear el usuario `admin` inicial si no existe.

---

## 16. Plan de desarrollo

| Fase | Contenido | Resultado |
|---|---|---|
| **1. Base** | Monorepo, esquema Prisma y migraciones, autenticación, autorización por roles y diseño base. | Proyecto corriendo. |
| **2. Registro y credenciales** | CRUD de participantes, importación Excel, códigos cortos, PDF de credenciales. | Se pueden imprimir credenciales. |
| **3. Control** | Puntos de control, escáner, registro manual, reglas de validación, respuesta visual. | Ingreso y comidas funcionando. |
| **4. Panel y reportes** | Dashboard, listas de pendientes, exportaciones, auditoría. | Control para organizadores y catering. |
| **5. Despliegue** | Publicación en Dokploy y datos iniciales (usuarios, puntos de control, importación de listas). | Sistema listo para pruebas. |

Las pruebas (automatizadas y con dispositivos reales) quedan fuera de este documento por ahora y se harán en una etapa posterior.

---

## 17. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| QR ilegible | Código corto y búsqueda por nombre; QR de baja densidad. |
| Escáner del navegador poco fiable en algún celular | Probar en los celulares reales; plan B de ingreso manual. |
| Caída momentánea de internet | Wifi más datos móviles en cada punto; registro manual en papel como último recurso. |
| Baterías de celulares | Cargadores y un dispositivo de reserva. |
| Inscripciones de último minuto | Registro rápido con impresión inmediata. |
| Datos de menores expuestos | QR sin datos personales y acceso por rol. |
| Error humano (escaneo equivocado) | Anulación con motivo y auditoría. |

---

## 18. Decisiones confirmadas con el cliente

| # | Tema | Decisión |
|---|---|---|
| 1 | Tamaño y duración | 200 participantes, 4 días. |
| 2 | Conectividad | Wifi confiable en todos los puntos, más datos móviles. **No se requiere modo offline.** |
| 3 | Dispositivos | 2 por punto. |
| 4 | Impresión | Credenciales con anticipación; posible impresión de último momento. Hay impresora. |
| 5 | Pagos | **No se controla** el pago en el sistema. |
| 6 | Refrigerios y almuerzos | Pueden variar por día; se configuran como puntos de control por día. |
| 7 | Foto en credencial | **Sin foto.** |
| 8 | Datos de los colegios | Listas de inscritos en Excel; se cargan con la importación masiva. |
| 9 | Retención de datos | **Ninguna** política; no es necesaria. |
| 10 | Hosting | VPS del desarrollador con Dokploy. |

---

## 19. Criterios de aceptación del MVP

- [ ] Importar un Excel con ~200 participantes y generar sus credenciales en PDF.
- [ ] Escanear un QR y ver el resultado en menos de 1 segundo.
- [ ] Registrar manualmente por código corto en menos de 10 segundos.
- [ ] No es posible registrar dos veces el mismo punto para la misma persona.
- [ ] Panel con cifras correctas de ingreso, refrigerios y almuerzos.
- [ ] Un operador nuevo logra escanear tras una explicación de 5 minutos.
- [ ] Exportación final a Excel con todos los registros.
