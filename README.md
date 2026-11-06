# DLC Billing Portal

Esqueleto de `dlc-billing-portal`, basado en la estructura Angular 21 + Native Federation usada por los portales de dominio del proyecto Di Lucca.

## Estado

Este repositorio contiene únicamente la fundación del portal de Billing. Los archivos funcionales de `src/app/billing/`, `src/main.ts`, `src/bootstrap.ts`, `src/index.html`, `federation.config.js` y `deploy/` se mantienen vacíos intencionalmente para reservar la estructura sin implementar todavía historias de usuario.

Las configuraciones de Angular, TypeScript, npm y CI están presentes como base. El proyecto no compila todavía porque los archivos fuente están vacíos; el pipeline comenzará a pasar cuando se implemente el arranque mínimo.

## Responsabilidades futuras

- `src/app/billing/components/`: componentes reutilizables del dominio de facturación.
- `src/app/billing/data/`: acceso al Billing API utilizando el cliente HTTP provisto por el contenedor.
- `src/app/billing/model/`: tipos y modelos derivados del contrato OpenAPI de Billing.
- `src/app/billing/pages/`: páginas del dominio Billing.
- `src/app/billing/billing.routes.ts`: rutas expuestas mediante Native Federation.
- `src/app/shell-contract.ts`: contrato de integración con el contenedor transversal `dlc-front`.

## Alcance reservado para Billing

En etapas posteriores el portal podrá cubrir funcionalidades documentadas del dominio, como consulta y gestión de facturas, detalle de factura, registro/visualización de pagos y estados de saldo. Este scaffold no implementa esas capacidades todavía.

## Integración

El contenedor transversal continúa siendo dueño de la sesión, navegación global, cliente HTTP y URL del API Gateway. `dlc-billing-portal` no debe crear una sesión paralela ni acceder directamente a la base de datos.

Puerto de desarrollo reservado en este scaffold: `4204`.

Para previsualizar el catálogo de forma independiente, ejecuta `npm start`. Para servir el remote Native Federation que consume el contenedor, ejecuta `npm run start:federation`; el remote debe abrirse desde el contenedor, que proporciona el mapa de módulos compartidos.

## HU-BIL-001 — Mock pricing catalog

This portal currently includes a mock implementation for the Billing pricing catalog.

### Implemented

- Procedure price catalog with fictional fixture data.
- Search by procedure name or code.
- Procedure price versioning simulation.
- Historical and active price states.
- Positive amount validation.
- COP currency representation.
- Additional charge rules catalog.
- Additional charge rule versioning simulation.
- Search by rule name or code.
- Empty state.
- Error state.
- Success state.
- Disabled submit actions while a simulated request is running.

### Mock behavior

The current implementation uses local fixture data only.

No real Billing API, API Gateway, database, JWT, or authentication integration is included in this stage.

Data is reset when the application is reloaded.

### Available routes

- `/prices`
- `/prices/rules`

### Run locally

```bash
npm install
npm start
```

## Composition v1 release

Build with `npm run build:portal` and preview locally with `npm run serve:portal`.
The Node preview server is for development only; production packaging uses
[Nginx](deploy/nginx.conf) through the [Dockerfile](deploy/Dockerfile).
Each build requires a new release directory; set `BILLING_RELEASE` when rebuilding.
See [release instructions and evidence](docs/composition-release.md).

## Composed additional rule creation

When mounted by the shell, `/procedures/rules` reads and creates additional price
rules through the shell HTTP client at `/api/v1/additional-price-rules`.
Administrators can create a rule version using an exact decimal COP string, one
of the four contracted item types, and a local effective date converted to UTC.
The form sends `requiresApproval: false`. Secretary assistants have read access.
The standalone preview still uses its existing fixture catalog.

A pending write blocks duplicate submissions and navigation. An uncertain write
can be retried with the same in-memory idempotency key for the same actor and
payload; changed data or another actor gets a new key. The key is not persisted
across reloads. Confirmed writes close the form and reload the catalog; a failed
reload does not turn a confirmed write into a failed creation. Responses arriving
after loss of access, actor changes, or unmount are ignored.

The shell owns authentication, session validation, and HTTP transport. This portal
does not create or store tokens. Live end-to-end verification requires the Billing
schema migrations, an operational gateway, and the authorized IAM service
credential provider. HTTP boundary tests and local builds do not establish that
those deployed dependencies are available.
