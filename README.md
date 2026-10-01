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
