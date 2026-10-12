// Generated from dlc-docs OpenAPI at 18813df4fca61f2d858edcbf6d873d507ef6729f; do not edit.
// Sources: billing-service.yaml#/components/schemas/Invoice/properties/status; _shared.yaml#/components/schemas/Money.
export const INVOICE_STATUSES = ["DRAFT","ISSUED","PARTIALLY_PAID","PAID","CANCELLED"] as const;
export type InvoiceStatus = typeof INVOICE_STATUSES[number];
export const COP_MONEY_PATTERN = "^\\d{1,12}\\.\\d{2}$";
