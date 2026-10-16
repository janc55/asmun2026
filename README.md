# ASMUN Control

> **Sistema de Registro, Credencialización y Control ASMUN**  
> Cliente: **Colegio Americano de Oruro** · Modelo de Naciones Unidas (ASMUN)  
> Stack: **NestJS · PostgreSQL 16 · Prisma ORM · Next.js 15 (App Router) · Tailwind CSS · TypeScript · pnpm**  

---

## 📖 Descripción General

ASMUN Control es una plataforma integral diseñada para la gestión operativa en tiempo real del evento ASMUN (~200 participantes, 4 días de duración):
* **Acreditación & Participantes:** Registro manual en sitio, importación masiva resiliente desde Excel/CSV con tolerancia a encabezados y filtros avanzados.
* **Credenciales Imprimibles:** Generación en servidor de PDF (tarjetas de 7.5 × 10.5 cm, 4 por hoja A4 con marcas de corte) con fondo de marca de agua, QR de solo 6 caracteres sin datos sensibles sobre placa blanca y códigos cortos de alta legibilidad (`K7P-3Q9`).
* **Control de Acceso y Comidas:** Validación en 6 pasos en tiempo real (< 1 s) en puntos de ingreso, credencial, material, refrigerios y almuerzos.
* **Concurrencia ACID:** Garantía a nivel de base de datos (`ux_scan_once`) que imposibilita el doble registro ante escaneos simultáneos sin emitir errores al operador.
* **Panel en Tiempo Real:** Polling automático cada 5 s con métricas de esperados vs. registrados, ausentes por punto y exportación inmediata a XLSX.

---

## 🏗️ Arquitectura del Monorepo

```
asmun-control/
├── docker-compose.yml              # PostgreSQL para desarrollo local
├── docker-compose.dokploy.yml      # Despliegue de producción en VPS Dokploy
├── pnpm-workspace.yaml             # Configuración del workspace pnpm
├── package.json                    # Scripts globales del monorepo
├── .env.example                    # Plantilla de variables de entorno
├── apps/
│   ├── api/                        # Backend NestJS (/api/v1)
│   │   ├── Dockerfile              # Multi-stage alpine con migraciones automáticas
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Modelado de datos
│   │   │   ├── seed.ts             # Inicialización y catálogos base
│   │   │   └── migrations/         # Migraciones SQL e índice ux_scan_once
│   │   └── src/                    # Módulos: auth, participants, badges, scans, dashboard, reports, audit
│   └── web/                        # Frontend Next.js 15 (App Router)
│       ├── Dockerfile              # Multi-stage alpine standalone
│       ├── public/                 # Imágenes de marca: logo-asmun.png e icono-asmun.png
│       └── src/                    # Rutas, escáner móvil, componentes y vistas
```

---

## 🎨 Identidad visual (logo, icono y colores)

### Imágenes de marca

Deje los dos archivos en **`apps/web/public/`** (esa carpeta se publica tal cual en la raíz del sitio):

| Archivo | Uso | Formato recomendado |
|---|---|---|
| `apps/web/public/logo-asmun.png` | Logo del colegio en la barra superior y en la pantalla de acceso | PNG con fondo transparente, alto ≥ 200 px (se muestra a 28 px de alto en la barra y 56 px en el acceso) |
| `apps/web/public/icono-asmun.png` | Icono del sitio / favorito de la pestaña | PNG cuadrado de 512 × 512 px |

* Ambos se toman **sin cambiar código**: el logo se lee de `/logo-asmun.png` y el icono está declarado en `apps/web/src/app/layout.tsx`.
* Si un archivo todavía no existe, la interfaz **no se rompe**: el logo muestra un monograma con los colores institucionales y el navegador solo recibe un 404 en el icono.
* En la barra superior y en el acceso el logo se coloca sobre una placa blanca, así se lee igual si el logo es oscuro o claro.
* Alternativa para el icono: si prefiere el mecanismo automático de Next.js, coloque el archivo como `apps/web/src/app/icon.png` y quite el bloque `icons` del layout.

### Credencial impresa (imagen de fondo)

La credencial en PDF toma su diseño de una imagen de fondo que **ya viene en el repositorio**:

| Archivo | Uso | Formato |
|---|---|---|
| `apps/api/src/assets/fondo-credencial.png` | Fondo de cada credencial (tarjeta de 7,5 × 10,5 cm) | PNG vertical de 886 × 1240 px (300 dpi). También se aceptan `.jpg`/`.jpeg` **baseline** |

* Para cambiar el diseño, sobrescriba ese archivo: `apps/api/nest-cli.json` lo copia a `dist/assets/` al compilar, y la imagen Docker de la API copia `dist/`, así que el fondo también viaja a producción.
* Si el archivo no existe, la credencial se genera igual con las franjas de color de respaldo y el log lo avisa: **la impresión nunca falla**.
* No use JPEG progresivo: los visores de PDF no lo decodifican y el servicio lo descarta con un aviso.

> Nota: las credenciales impresas y los reportes mantienen los colores por rol definidos en el SDD (10.2) para que cada rol siga siendo distinguible.

### Paleta

Definida en `apps/web/tailwind.config.ts`:

| Token | Valor | Uso |
|---|---|---|
| `primary-600` | `#13193B` | Azul institucional: barra superior, botones, enlaces y encabezados |
| `primary-700` | `#0E1330` | Estados hover/activos |
| `primary-50` | `#F2F3F8` | Fondos suaves azules |
| `plomo-600` / `gray-600` | `#676767` | Plomo institucional: textos secundarios y bordes |
| `plomo-100` / `gray-100` | `#F0F0F0` | Fondo general de la aplicación |
| `gray-900` | `#212121` | Texto principal |
| `status.ok` / `warning` / `error` | `#16A34A` / `#F59E0B` / `#DC2626` | Solo resultados de escaneo (siempre con ícono y texto, nunca solo color) |

---

## 🚀 Inicio Rápido en Desarrollo Local

### 1. Requisitos Previos
* Node.js v20+ o v22+
* pnpm v11+
* Docker Desktop o Docker Engine

### 2. Instalación de Dependencias
```bash
pnpm install
```

### 3. Levantar Base de Datos PostgreSQL
```bash
pnpm db:up
```

### 4. Ejecutar Migraciones y Generar Prisma Client
```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

### 5. Iniciar Aplicaciones en Paralelo
```bash
pnpm dev
```
* **Frontend Web & Móvil:** [http://localhost:3000](http://localhost:3000)
* **Backend API REST:** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
* **Documentación OpenAPI / Swagger:** [http://localhost:4000/docs](http://localhost:4000/docs)

---

## 🔐 Usuarios y Credenciales Iniciales

El sistema inicializa automáticamente las siguientes cuentas al arrancar o mediante `pnpm prisma:seed`:

| Rol | Usuario | Contraseña | Propósito |
|---|---|---|---|
| `admin` | `admin` | `AdminAsmun2026!` | Control total, configuración, excepciones y auditoría |
| `registrador` | `registrador` | `Registrador2026!` | Registro en sitio, importación Excel e impresión |
| `operador` | `operador` | `Operador2026!` | Pantalla táctil de escaneo de puntos asignados |

*(Las contraseñas de producción se configuran mediante las variables de entorno `INITIAL_ADMIN_PASSWORD`, etc.)*

---

## 🚢 Despliegue en Dokploy (VPS)

El proyecto incluye soporte nativo para **Dokploy** mediante `docker-compose.dokploy.yml`. Dokploy automatiza la asignación de dominio y la emisión de certificados SSL/HTTPS (obligatorios para habilitar el uso de la cámara en navegadores móviles).

### Pasos para Despliegue en Dokploy:
1. En el panel de **Dokploy**, crear un nuevo servicio de tipo **Compose**.
2. Conectar el repositorio Git del proyecto.
3. Configurar la ruta del archivo Compose: `docker-compose.dokploy.yml`.
4. Cargar las Variables de Entorno en el panel de Dokploy basándose en `.env.example`:
   * `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   * `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   * `CORS_ORIGIN`: dominio público asignado al frontend (ej. `https://asmun.tu-dominio.com`)
   * `NEXT_PUBLIC_API_URL`: URL pública del backend o ruta `/api/v1`
   * `INITIAL_ADMIN_PASSWORD`: contraseña segura para el administrador de producción
   * `EVENT_TIMEZONE`: `America/La_Paz` (o la zona horaria del evento)
5. Dokploy se encarga del build multi-stage de `api` y `web`, levantando:
   * Contenedor PostgreSQL (`asmun_dokploy_db`) con volumen persistente `asmun_postgres_data`.
   * Contenedor API NestJS (`asmun_dokploy_api`) aplicando migraciones automáticamente con `prisma migrate deploy`.
   * Contenedor Web Next.js (`asmun_dokploy_web`) en modo standalone ultraligero.
6. Asignar los dominios en Dokploy y verificar la conexión HTTPS.

---

## 📊 Endpoints de la API (`/api/v1`)

* **Autenticación:**
  * `POST /api/v1/auth/login` — Inicio de sesión y entrega de JWT (access y refresh).
  * `POST /api/v1/auth/refresh` — Renovación de token de acceso.
  * `GET /api/v1/auth/me` — Perfil y puntos de control asignados al usuario.
* **Participantes & Credenciales:**
  * `GET /api/v1/participants` — Listado con filtros de colegio, comité, rol y búsqueda.
  * `POST /api/v1/participants` — Alta manual con generación automática de código corto.
  * `GET /api/v1/participants/{id}` — Detalle e historial de escaneos.
  * `PATCH /api/v1/participants/{id}` — Edición y baja lógica.
  * `GET /api/v1/participants/by-code/{code}` — Búsqueda por código de 6 caracteres.
  * `POST /api/v1/participants/import` — Carga masiva tolerante de Excel/CSV con vista previa.
  * `GET /api/v1/participants/import/template` — Descarga de plantilla modelo.
  * `GET /api/v1/badges/{id}.pdf` — Credencial individual (formato tarjeta o A4).
  * `POST /api/v1/badges/pdf` — PDF masivo paginado en hojas A4 (4 por página con marcas de corte).
  * `POST /api/v1/badges/reprint` — Reimpresión con registro en auditoría.
* **Puntos de Control & Escaneos:**
  * `GET /api/v1/checkpoints` — Catálogo de puntos de control con horarios y dependencias.
  * `GET /api/v1/checkpoints/available` — Puntos habilitados para el usuario actual.
  * `POST /api/v1/scans` — Registro de escaneo (QR o código manual) con validación en 6 pasos.
  * `POST /api/v1/scans/{id}/void` — Anulación auditada de escaneo previo (admin).
  * `POST /api/v1/scans/override` — Excepción auditada para casos especiales (admin).
  * `GET /api/v1/scans` — Historial detallado de escaneos.
* **Métricas & Reportes:**
  * `GET /api/v1/dashboard/summary` — Cifras de esperados vs. registrados en tiempo real.
  * `GET /api/v1/dashboard/pending` — Lista de participantes que aún no cumplen un punto.
  * `GET /api/v1/reports/participants.xlsx` — Exportación de participantes a Excel.
  * `GET /api/v1/reports/scans.xlsx` — Exportación de historial de escaneos a Excel.
  * `GET /api/v1/reports/pending.xlsx` — Exportación de participantes pendientes para catering.
  * `GET /api/v1/audit` — Registro inmutable de eventos auditados.
