
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../model/generated/invoice-contract.generated';
import { copMoney, type CopMoney } from '../model/cop-money';

export interface ReadInvoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  invoiceNumber?: string;
  items: unknown[];
  total: CopMoney;
  balance: CopMoney;
  currency: 'COP';
  status: InvoiceStatus;
  version: number;
}

export interface ReadInvoicePage {
  data: ReadInvoice[];
  meta: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid invoice ${field}`);
  }

  return value;
}

function readInvoice(value: unknown): ReadInvoice {
  if (!isRecord(value)) {
    throw new Error('Invalid invoice');
  }

  if (
    typeof value.status !== 'string'
    || !INVOICE_STATUSES.some(status => status === value.status)
  ) {
    throw new Error('Invalid invoice status');
  }

  if (
    !Number.isInteger(value.version)
    || (value.version as number) < 1
  ) {
    throw new Error('Invalid invoice version');
  }

  if (!Array.isArray(value.items)) {
    throw new Error('Invalid invoice items');
  }

  if (value.currency !== 'COP') {
    throw new Error('Invalid invoice currency');
  }

  const invoice: ReadInvoice = {
    id: requireString(value.id, 'id'),
    patientId: requireString(value.patientId, 'patientId'),
    items: [...value.items],
    total: copMoney(value.total),
    balance: copMoney(value.balance),
    currency: 'COP',
    status: value.status as InvoiceStatus,
    version: value.version as number,
  };

  if (value.appointmentId !== undefined) {
    invoice.appointmentId = requireString(
      value.appointmentId,
      'appointmentId',
    );
  }

  if (value.invoiceNumber !== undefined) {
    invoice.invoiceNumber = requireString(
      value.invoiceNumber,
      'invoiceNumber',
    );
  }

  return invoice;
}

export function readInvoicePage(value: unknown): ReadInvoicePage {
  if (!isRecord(value)) {
    throw new Error('Invalid invoice page');
  }

  if (!Array.isArray(value.data) || !isRecord(value.meta)) {
    throw new Error('Invalid invoice page structure');
  }

  return {
    data: value.data.map(readInvoice),
    meta: { ...value.meta },
  };
}
