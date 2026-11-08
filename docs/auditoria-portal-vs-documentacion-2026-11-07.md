# Auditoría del portal Billing frente a la documentación

Fecha: 7 de noviembre de 2026. Portal: `5255864992277377e828d3bc5e5f5884e4d81553`.
Documentación local `dlc-docs`: `31fb316d8209fbf1838feea9ecf0192c4b551585`.
Ambos repositorios estaban sin modificaciones al iniciar la revisión.

## Dictamen y alcance

El portal tiene una implementación HTTP sustancialmente más avanzada que su README y varias notas históricas. Sin embargo, el recorrido completo desde cargos pendientes hasta una factura emitida todavía tiene vacíos en la interfaz. La demostración independiente y el portal montado por el shell tienen capacidades distintas; no deben usarse indistintamente como evidencia de cumplimiento.

Esta es una auditoría de código, documentación y verificaciones locales. No certifica el despliegue, la presentación visual, la autorización efectiva del backend ni la aceptación de las historias. No se modificaron funciones del producto. La documentación se contrastó contra el checkout local disponible, sin consultar ni actualizar la última rama remota.

Fuentes normativas revisadas en `../dlc-docs/`:

- `04-requirements/user-stories.md`: HU-BIL-001 a HU-BIL-004 y HU-XCT-001.
- `04-requirements/traceability-matrix.md`.
- `02-domain/entities-and-rules.md`: BIL-001 a BIL-016.
- `06-data/monetary-calculation.md`.
- `07-api/contracts/openapi/billing-service.yaml` y proyección de Money/estados.
- `12-ux-ui/navigation-map.md`.
- `05-architecture/decisions/ADR-015-billing-encounter-account.md`.

También se revisaron README, CHANGELOG, las notas de `docs/`, rutas, entrada de composición, componentes, adaptadores HTTP, pruebas, CI y empaquetado. Se inspeccionó puntualmente el registro local de `dlc-front`; no se auditó por completo ese repositorio ni las API.

## Matriz funcional

| Requisito | Evidencia actual en el portal compuesto | Evaluación |
|---|---|---|
| HU-BIL-001: consultar precios y reglas | GET `/procedure-prices` y `/additional-price-rules`, búsqueda local, estados de carga/error/vacío | Implementado en código; alcance limitado a la página recibida |
| HU-BIL-001: crear precios y reglas | Formularios HTTP, COP exacto, permisos de administrador; reglas envían `requiresApproval: false` | Implementado; faltan aspectos de versionado y recuperación indicados abajo |
| HU-BIL-001: versionar precios existentes conservando historia | Adaptador POST disponible; la acción de versionar una tarjeta solo existe en modo independiente | Incompleto en la interfaz conectada |
| HU-BIL-002: consultar lista y detalle | GET de facturas y detalle, importes exactos, estados, conceptos financieros | Implementado; paginación remota pendiente |
| HU-BIL-002: seleccionar cargos UNBILLED y crear borrador | No se encontró consumidor GET `/billable-items` ni POST `/invoices` en el código productivo | Ausente en este portal |
| HU-BIL-002: corregir un cargo pendiente antes de emitir | Formulario de administrador en DRAFT, motivo obligatorio, versión esperada e idempotencia | Implementado; no equivale a una segunda aprobación obligatoria |
| HU-BIL-002: emitir borrador | POST `/invoices/{id}/issuances`, control de estado/versión, reintento con clave estable | Implementado para borradores ya existentes |
| HU-BIL-002: descargar PDF actual | GET binario; permitido en ISSUED, PARTIALLY_PAID y PAID | Implementado; contenido y autorización reales pendientes de aceptación |
| HU-BIL-003: registrar pagos y consultar historia | POST/GET de pagos, validación positiva y no superior al saldo, versión e idempotencia, recarga de detalle | Implementado; estados y persistencia finales dependen de Billing |
| HU-BIL-004: entrada manual justificada | Formulario sin precio/concepto/justificación prefijados; contexto UUID por ruta; administrador/odontólogo | Implementado en Billing; recorrido desde el portal clínico no acreditado |
| HU-XCT-001 / BIL-016: cierre y cuenta previa | Hay utilidades locales de EncounterAccount; no una pantalla/consulta integrada de cierre en el portal | Dependencia entre servicios; las utilidades no demuestran el protocolo real |
| BIL-011/012: correos tras emisión/pago y PDF del evento | El portal consume operaciones financieras; no se exige que envíe correos directamente | Responsabilidad de Billing/Worker; no verificada en esta auditoría |
| UX: métricas financieras y detalle enriquecido | Métricas ficticias ocultas en HTTP; paciente presentado como UUID; detalle financiero básico | Parcial frente al catálogo de pantallas; requiere contratos de lectura aprobados |

## Hallazgos priorizados

### A01 — P1: falta el inicio del recorrido de facturación

El contrato permite listar cargos facturables y crear un borrador desde `billableItemIds`. El portal solo lista facturas ya creadas y puede emitir un DRAFT existente. No se encontró una pantalla ni adaptador para crear ese borrador.

Evidencia: `src/app/composition/billing-root.component.ts`, `src/app/billing/data/invoice-http-read.ts`, `src/app/billing/data/invoice-issuance-http.ts`; OpenAPI `/billable-items` y POST `/invoices`.

Impacto: el personal necesita otra herramienta o un proceso externo para llegar al borrador. Cambio propuesto: selección de cargos autorizados de un paciente, creación idempotente de borrador y apertura de su detalle. El servidor debe calcular totales y comprobar finalización administrativa; el portal no debe sustituir esas comprobaciones.

### A02 — P1: versionado de precios inaccesible en HTTP

Las tarjetas HTTP no renderizan la acción de nueva versión. `openForPrice()` rechaza expresamente `composed`; `canVersion()` también. El único formulario accesible es “Nuevo procedimiento”, y `duplicateCode` impide usar un código ya recibido. Por tanto, tener el POST implementado no completa el mantenimiento de versiones.

Evidencia: `src/app/billing/catalog/pages/pricing-catalog/pricing-catalog.component.{ts,html}`; HU-BIL-001.

Cambio propuesto: habilitar una acción de nueva versión sobre la proyección HTTP, preservar identidad y validar vigencia conforme al contrato. La autoridad sobre solapamientos y concurrencia sigue siendo Billing.

### A03 — P1: navegación de listas limitada a la primera respuesta

`readInvoicesHttp()`, `readProcedurePricesHttp()` y `readExtraChargeRulesHttp()` no permiten seleccionar otra página. La lista proyecta solo `page.data` y pierde los metadatos; su “Siguiente” recorta localmente esos registros en grupos de dos. Los catálogos también conservan únicamente `result.data` en la composición. El historial de pagos sí tiene paginación remota y sirve de referencia.

Evidencia: `src/app/billing/data/invoice-http-read.ts`, `invoice-read-flow.ts`, `invoice-read-state.ts`; adaptadores de catálogo y `billing-root.component.ts`.

Impacto: puede haber registros existentes que el usuario nunca encuentre. La advertencia sobre filtros locales informa la limitación pero no permite recuperar el resto. Cambio propuesto: conservar metadatos y conectar página/límite al servidor; mantener solo filtros soportados por el contrato o identificarlos claramente como locales.

### A04 — P1: protección desigual ante cambio de identidad

La suscripción general del root actualiza la sesión, pero no limpia todos los datos y borradores. Varias operaciones verifican rol/ruta al resolver, sin comparar el usuario que inició la solicitud: creación de precio, pago, cargo manual y emisión. Los formularios de pago/cargo manual tampoco incluyen actor en la huella de reintento. En cambio, creación de reglas y corrección administrativa ya tienen comprobaciones por actor.

Evidencia: `billing-root.component.ts` (`constructor`, `createPriceVersion`, `registerPayment`, `registerManualCharge`, `issueInvoice`); `invoice-payment-http-page.component.ts`; `manual-charge-form.component.ts`; contraste con `requestExtraChargeRuleCreation` y `price-correction-form.component.ts`.

Riesgo condicionado: si el shell mantiene el montaje al cambiar de usuario por otro con el mismo rol, una respuesta o un borrador anterior puede sobrevivir. No se reprodujo una exposición real ni se auditó si el shell siempre desmonta en ese caso. Cambio propuesto: invalidar solicitudes y datos protegidos por identidad/revisión de sesión y añadir pruebas de cambio de actor con roles iguales, revocación y reautenticación.

### A05 — P2: creación de precio sin cierre confirmado del formulario ni clave estable de reintento

`requestPriceVersionCreation()` genera un UUID nuevo en cada intento. Después del éxito, el root recarga y muestra un mensaje, pero no comunica un estado de guardado que cierre/limpie el diálogo. `submitPrice()` en modo compuesto emite y retorna. El formulario puede seguir abierto y bloquear `canLeave()` incluso tras el registro. Un fallo ambiguo seguido de otro envío usa otra clave.

Evidencia: `billing-root.component.ts` y `pricing-catalog.component.ts`. El flujo de reglas ya ofrece un patrón de resultado confirmado y reintento por actor/payload.

Cambio propuesto: conservar la intención durante resultados ambiguos; cerrar y limpiar tras confirmación; distinguir creación exitosa de recarga fallida. La deduplicación del servidor puede mitigar duplicados, pero no sustituye la conservación de la intención.

### A06 — P2: mensajes y documentación contradicen capacidades actuales

- README afirma que los fuentes están vacíos y que el proyecto no compila; después describe mocks y, finalmente, una integración real de reglas.
- El aviso de la lista HTTP dice que detalle y pagos no están disponibles, aunque el root habilita detalle, emisión, PDF y pagos según rol/estado.
- Varias notas de `docs/` describen incrementos históricos y pendientes ya implementados sin un índice que distinga pasado y estado vigente.
- CHANGELOG termina en 2.0.0 con 187 pruebas; el checkout actual tiene 609.

Cambio propuesto: README como estado actual, tabla de capacidades por modo y una sección histórica claramente fechada. Corregir el aviso de la lista. Las cifras antiguas deben conservarse como evidencia de sus revisiones, no reemplazarse como si hubieran medido el código actual.

### A07 — P2: discrepancia de política del primer pago

`docs/composed-invoice-payments.md` y el flujo demo establecen un primer pago mínimo del 50 %. El formulario HTTP admite cualquier importe positivo hasta el saldo; coincide con HU-BIL-003 y API-FIN-01 locales, que no exigen ese mínimo.

Evaluación: conflicto entre una decisión documentada para demo y el contrato oficial, no un incumplimiento demostrado del flujo HTTP. Antes de cambiar: resolver explícitamente si el 50 % sigue siendo requisito; si lo es, alinear primero reglas/contrato y backend, luego interfaz y pruebas.

### A08 — P2: acceso a reglas y cargos manuales poco conectado

El root reconoce `/procedures/rules` y `/manual-charges/new`. El enlace “Reglas adicionales” del catálogo solo se renderiza cuando `!composed`; el registro local de `dlc-front` únicamente anuncia Facturación y Procedimientos. La entrada manual requiere cuatro UUID de contexto y no ofrece selección de origen. La búsqueda puntual en el código clínico local no encontró una navegación a `manual-charges`.

Evaluación: rutas existentes con descubribilidad incompleta; el recorrido clínico completo no está acreditado. Cambio propuesto: navegación mediante el shell hacia reglas y un acceso contextual desde atención clínica que transmita únicamente los identificadores autorizados. No prefijar valores financieros ni convertir query parameters en autorización.

### A09 — P2: versiones de entrega y evidencia no equivalentes

`package.json` tiene 0.1.0 y `build:portal` deriva por defecto `0.1.0-demo`; Docker y el registro local del shell usan 2.0.0. Las notas recientes citan artefactos locales 2.0.1/2.0.2/2.0.4 no publicados.

Impacto: compilar el checkout no demuestra qué cambios consume el shell desplegado. Cambio propuesto: definir versión candidata, construir un artefacto inmutable y registrar commit, URL y descriptor que lo selecciona. No sobrescribir una versión ya publicada. No se comprobó el contenido actualmente servido en producción.

### A10 — P2: detalle básico frente al diseño y contratos verificados solo parcialmente

El mapa UX menciona emisor, paciente, servicios, totales e información de pago. El detalle HTTP usa UUID de paciente/cita y conceptos/precios; no presenta una identidad administrativa enriquecida ni emisor. Las métricas HTTP están ocultas correctamente para evitar usar el ingreso demo fijo.

Además, `contract:check` solo compara Money/estados con una proyección; no valida todos los endpoints, DTO, permisos ni el protocolo de cierre. CI ejecuta pruebas y builds, sin un paso explícito de comparación con el checkout oficial de documentación.

Cambio propuesto: acordar campos administrativos mínimos y fuente autorizada; extender verificaciones de contrato según cada incremento. No resolverlo leyendo historia clínica ni calculando totales financieros en el navegador.

## Verificación ejecutada

| Comprobación | Resultado del checkout auditado |
|---|---|
| `npm.cmd run test:coverage` | 64 archivos y 609 pruebas aprobados |
| Cobertura global | Líneas 91,91 %; sentencias 90,71 %; ramas 86,62 %; funciones 92,34 % |
| Umbrales actuales | Aprobados: globales 80 % y líneas de dominio 90 % |
| `npm.cmd run build` | Aprobado |
| `npm.cmd run contract:check` | Aprobado contra proyección comprometida |
| `node scripts/invoice-contract.mjs --check ../dlc-docs` | Aprobado contra Money/estados de documentación local |
| Aceptación visual / accesibilidad / servicios reales | No ejecutada en esta auditoría |
| Publicación / Docker / CI remoto | No ejecutados en esta auditoría |

PowerShell bloqueó inicialmente `npm.ps1`; se utilizó `npm.cmd`. Esbuild requirió ejecutar pruebas/build fuera del sandbox por restricciones de lectura. Las verificaciones finales anteriores terminaron correctamente. La suite incluye pruebas de empaquetado de composición; no se publicó una versión candidata para el shell.

## Orden propuesto para los cambios

1. Proteger cambio de actor y reintentos; evitar que los nuevos flujos amplíen el riesgo de estado anterior (A04/A05).
2. Completar versionado HTTP y paginación de servidor (A02/A03).
3. Implementar cargos pendientes → borrador → detalle → emisión, respetando finalización administrativa (A01).
4. Conectar entradas a reglas y cargos manuales con los portales responsables (A08).
5. Resolver política del 50 %, actualizar textos/documentación y definir campos UX aprobados (A06/A07/A10).
6. Preparar una entrega con versión inequívoca y ejecutar aceptación real por rol: crear/versionar, cargo manual, borrador, corrección, emisión, pago parcial/final, historia y PDF; incluir conflictos, fallos ambiguos y cierre de sesión (A09).

No se asigna un porcentaje de cumplimiento de HU: código, pruebas aisladas y evidencia histórica no equivalen a aceptación integrada. El siguiente trabajo puede partir de estos identificadores y criterios, manteniendo separados los cambios del portal, los requisitos por resolver y las dependencias de otros servicios.
