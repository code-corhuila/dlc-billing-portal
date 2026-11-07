# DLC Billing Portal

Portal Angular 21 de facturación de Di Lucca. Versión candidata: **2.1.0**. El shell `dlc-front` aporta sesión, navegación y cliente HTTP. El navegador no crea tokens ni accede a bases de datos.

## Capacidades actuales

| Función | Portal compuesto HTTP | Vista independiente |
|---|---|---|
| Facturas y detalle | API; paginación del servidor | Datos ficticios |
| Crear borrador | Selección de cargos UNBILLED por paciente; Billing valida totales y finalización administrativa | No disponible |
| Corregir cargo pendiente | Administrador, motivo y versión; antes de emitir | Demostración antigua |
| Emitir factura | Administrador / Secretaría-Asistente | Demostración antigua |
| Pagos e historia | Importe exacto, versión, idempotencia y saldo autoritativo | Estado temporal |
| PDF actual | ISSUED, PARTIALLY_PAID y PAID; personal autorizado | Sin PDF real |
| Precios | Consultar, crear y versionar; paginación remota | Fixtures y versiones en memoria |
| Reglas adicionales | Consulta y creación de versiones; requiresApproval=false | Fixtures |
| Cargos manuales | Administrador / Odontólogo; fuente contextual, concepto, cantidad, precio y justificación | No disponible |

El primer pago cubre al menos el **50 % del total, incluidos extras**, redondeado hacia arriba al centavo. Los posteriores pueden empezar en COP 0,01 sin superar el saldo. La política se alinea con los cambios locales de `dlc-docs` y `dlc-billing-api`; no se reescribe historia.

Los filtros de texto/estado son locales a la página recibida. Anterior/Siguiente consulta otras páginas del servidor. Las métricas ficticias están ocultas en HTTP. El detalle usa los identificadores administrativos disponibles en el contrato, sin leer narrativas clínicas.

## Rutas compuestas

- `/app/billing`: facturas.
- `/app/billing/invoices/new`: cargos pendientes y borrador.
- `/app/billing/invoices/:invoiceId`: detalle, corrección, emisión, pagos y PDF según permisos/estado.
- `/app/billing/invoices/:invoiceId/payment`: registrar pago.
- `/app/billing/procedures`: precios y versiones.
- `/app/billing/procedures/rules`: reglas adicionales.
- `/app/billing/manual-charges/new?patientId=…&appointmentId=…&procedureId=…&sourceRecordId=…`: entrada contextual. Solo esos cuatro UUID; no se reciben precio, actor ni texto clínico por URL.

Las rutas independientes `/prices`, `/prices/rules` e `/invoices/:id/payments/new` son de demostración.

## Ejecución y validación

Requiere Node 22 o posterior. En PowerShell puede utilizarse `npm.cmd` si la política local bloquea `npm.ps1`.

```sh
npm ci
npm start
npm run contract:check
npm run test:coverage
npm run build
npm run build:portal
npm run serve:portal
```

`npm start` abre la demostración en 4204. `serve:portal` sirve artefactos para el shell; no aporta autenticación ni sustituye API. `start:federation` mantiene la entrada Native Federation antigua.

El build compuesto genera `/portals/billing/2.1.0/entry.js`; Docker usa la misma versión. Cada nueva compilación requiere otro `BILLING_RELEASE`: las entregas existentes son inmutables. El servidor Node es de desarrollo; producción usa [Nginx](deploy/nginx.conf) y [Docker](deploy/Dockerfile).

## Sesión y reintentos

Cambiar de identidad o permisos invalida respuestas anteriores y limpia datos/formularios protegidos. Los envíos pendientes bloquean duplicados y salida voluntaria. Las creaciones conservan una clave por intención para reintentos explícitos tras un resultado ambiguo. No hay reintento automático; las claves solo viven en memoria. Un guardado confirmado se distingue de una recarga fallida.

Los permisos visuales no reemplazan autorización de Billing, IAM y Appointments. La corrección administrativa recupera cargos pendientes: no exige una segunda aprobación de una entrada manual válida.

## Documentación y aceptación

- [Auditoría](docs/auditoria-portal-vs-documentacion-2026-11-07.md): diagnóstico del checkout original.
- [Correcciones](docs/audit-remediation.md): cambios, pruebas y dependencias.
- [Contrato de importes y estados](docs/invoice-source-contract.md): alcance de la proyección.
- [Publicación](docs/composition-release.md): reglas de artefactos y evidencia histórica.

Las notas anteriores de `docs/` y CHANGELOG conservan evidencia histórica; sus cifras y pendientes no describen necesariamente esta revisión. `contract:check` valida la proyección Money/estados y la estructura del snapshot de operaciones y esquemas. `node scripts/invoice-contract.mjs --check ../dlc-docs` compara también con el checkout disponible; Para comparar también operaciones/esquemas ejecuta `node scripts/billing-operations-contract.mjs --check ../dlc-docs`. Ninguna de estas comprobaciones consulta automáticamente GitHub ni certifica todos los endpoints en ejecución.

La aceptación integrada requiere servicios reales, registro del shell y credenciales autorizadas. Correos y PDF del evento pertenecen a Billing/Worker. Indicadores financieros y campos enriquecidos de emisor/paciente requieren contratos de lectura aprobados. Un build no certifica esos servicios ni una publicación.
