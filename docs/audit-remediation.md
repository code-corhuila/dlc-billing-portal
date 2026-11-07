# Correcciones de la auditoría — 7 de noviembre de 2026

Estado: cambios locales, candidato Billing 2.1.0. La [auditoría](auditoria-portal-vs-documentacion-2026-11-07.md) conserva el diagnóstico de la revisión original; este documento registra la respuesta. No se publicaron cambios ni se aplicaron migraciones a la base del proyecto.

## Resultado por hallazgo

| ID | Corrección y evidencia | Estado |
|---|---|---|
| A01 | Nueva ruta `/invoices/new`: lectura paginada y filtrada por paciente, selección UNBILLED, POST sin importes, clave estable, guardas de sesión/conflicto y apertura del borrador confirmado. Billing conserva autoridad sobre totales y cierre administrativo. | Implementado y probado localmente |
| A02 | Tarjetas HTTP permiten nueva versión; código/nombre permanecen de solo lectura y la fecha debe ser posterior a la última fecha conocida. El servidor resuelve vigencias/concurrencia y versiones no recibidas en la página. | Implementado y probado |
| A03 | Anterior/Siguiente consulta al servidor en facturas, precios y reglas. Se conservan metadatos y no se vuelve a recortar localmente una página del servidor. Filtros de texto/estado siguen identificados como locales. | Implementado y probado |
| A04 | Se capturan identidad/permisos y generación para operaciones asíncronas. Cambio de acceso invalida lecturas, resultados e intenciones y limpia datos y formularios. Una petición antigua no libera el coordinador de una nueva consulta del mismo ID. | Implementado y probado |
| A05 | Una creación de precio conserva clave por actor/payload tras incertidumbre. Confirmación limpia/cierra el formulario incluso si la recarga falla. Inputs y cancelación se bloquean durante envío; pago/cargo manual confirmado también limpia su borrador. | Implementado y probado |
| A06 | README actual, aviso de lista corregido y changelog del candidato; las notas antiguas conservan sus evidencias históricas. | Corregido |
| A07 | El usuario eligió exigir primer pago de al menos 50 % del total incluidos extras, redondeado al centavo superior. Portal y API usan aritmética exacta. API evalúa dentro del bloqueo de factura y después de resolver replay; devuelve 409 `INITIAL_PAYMENT_BELOW_MINIMUM`. Un pago posterior puede ser COP 0,01; pagos históricos no se alteran. Dominio, HU, OpenAPI y revisión API-FIN-01 locales se alinearon. | Implementado y probado con PostgreSQL desechable |
| A08 | Navegación compuesta hacia reglas y borradores. Clinical ofrece “Registrar precio en Facturación” desde un extra registrado, pasando únicamente patientId/appointmentId/procedureId/sourceRecordId mediante el shell. No pasa precio, motivo, concepto ni actor. | Código y prueba renderizada implementados; entrega integrada pendiente |
| A09 | Package, build por defecto, Docker y descriptor local de `dlc-front` apuntan a Billing 2.1.0; las entregas previas permanecen intactas. | Candidato local; publicación pendiente |
| A10 | Snapshot de operaciones, roles, parámetros, request/response y esquemas; comparación opcional con checkout oficial. Pruebas verifican payload sin importes del borrador y política de pagos. CI ejecuta ambos guardas de contrato. | Verificación ampliada; enriquecimiento UX requiere contrato |

## Verificaciones

- Portal: **626 pruebas en 67 archivos**, sin fallos. Cobertura: líneas 92,69 %, sentencias 90,75 %, ramas 86,43 %, funciones 93,05 %. Umbrales conservados.
- Build Angular independiente aprobado; la suite también compila y audita un artefacto compuesto real, incluida la ausencia de efectos al importar.
- `contract:check`, comparación Money/estados y `billing-operations-contract.mjs --check ../dlc-docs` aprobados contra el checkout local actualizado. Las comprobaciones no consultan la última rama remota y no sustituyen pruebas de autorización/HTTP reales.
- API: `mvn -o -q test` aprobado. Algunos grupos requieren infraestructura y se omiten en esa ejecución; no se declara que todos los tests Maven hayan usado servicios reales.
- Ejecutor existente `dlc-billing-db/tests/run-isolated.py --api-only`: Liquibase validado, migración y repetición aprobadas; **27 pruebas transaccionales reales sin fallos ni omisiones** en PostgreSQL desechable, entre ellas pagos concurrentes, replay, mínimo inicial y pago posterior de un centavo. El contenedor y red de prueba se eliminan al terminar. No cambia la base del proyecto.
- Clinical: typecheck, **344 pruebas en 35 archivos** y ambos builds de producción aprobados. Incluye una prueba de UI renderizada para la navegación del extra. Se instalaron las dependencias fijadas existentes; no se cambiaron versiones de paquetes. El entorno usa Node 24/npm 11 frente al rango Node 22/npm 10 declarado por Clinical: queda por reproducir allí con su runtime declarado.
- Shell: **13 pruebas** de registro, navegación/proxy e integración focalizadas aprobadas.
- Artefacto local inmutable generado: `/portals/billing/2.1.0/entry.js`. Imagen `dlc-billing-portal:audit-2.1.0` construida con Node 22/npm 10. Nginx validado en un contenedor desechable ligado a loopback: GET 200, HEAD 200 sin cuerpo, `no-store`, MIME JavaScript y archivo inexistente 404. El contenedor se retiró; la imagen candidata queda disponible. Hashes de artefactos e imagen en [evidencia de entrega](release-2.1.0-evidence.json). Los builds Windows/Node 24 y Linux/Node 22 tienen hashes diferentes y se identifican por separado.
- Revisión visual en navegador: el inventario devolvió `The browser access host is unavailable`. No se acredita QA visual, responsive ni accesibilidad completa.
- La instalación fijada de dependencias reportó advisories existentes: Billing en Docker, 39 (3 críticos, 10 altos, 25 moderados y 1 bajo); Clinical, 13 (3 altos y 10 moderados). No se verificó su explotabilidad ni se aplicaron upgrades automáticos. La aceptación de seguridad de dependencias sigue pendiente.

## Qué falta para aceptación y puesta en servicio

1. Publicar conjuntamente las revisiones compatibles de Portal/API/Clinical y actualizar el registro operativo. El descriptor modificado es el local de fixtures, no el registro de un entorno desplegado. Clinical conserva su descriptor anterior; su nuevo enlace pertenece al build real generado y debe seleccionarse al integrar la entrega.
2. Recorrer en el shell real, con IAM/Gateway y usuarios de prueba autorizados, el flujo Clinical → cargo manual → finalización administrativa → borrador → corrección si procede → emisión → primer pago ≥ 50 % → pago final → historia/PDF. Confirmar por rol y con conflictos y pérdida de sesión.
3. Verificar correos y PDFs al momento del evento con Worker; son responsabilidades de servicios, no envíos desde el navegador. Las pruebas locales no certifican entrega de correo.
4. Aprobar contratos para indicadores financieros e identidad administrativa enriquecida del paciente/emisor. Las API de factura actuales entregan UUID y no ofrecen una consulta agregada de ingresos; no se añadieron métricas ficticias ni accesos a historia clínica para suplirlos.
5. Verificar permisos de lectura financiera del Odontólogo de extremo a extremo: el OpenAPI permite lecturas autorizadas de pagos/PDF, mientras que los tests HTTP actuales de la API mantienen una denegación de historia de pagos para DENTIST. No se amplió acceso clínico/financiero del backend de forma indiscriminada para resolver esta discrepancia.

Los cambios previos de `dlc-billing-api` y `dlc-billing-db` encontrados al comenzar se conservaron. La adaptación de importes de `PaymentTransactionTest` conserva su preparación de datos existente. No se realizaron commits, pushes, despliegues ni actualizaciones de dependencias.
