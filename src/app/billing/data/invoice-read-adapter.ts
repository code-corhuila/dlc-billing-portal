import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../model/generated/invoice-contract.generated';
import { copMoney, type CopMoney } from '../model/cop-money';

export interface ReadBillableItem {
  id: string;
  patientId: string;
  procedureId: string;
  description: string;
  quantity: string;
  unitPrice: CopMoney;
  currency: 'COP';
  version: number;
  status: 'UNBILLED' | 'BILLED';
  approvalRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReadInvoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  invoiceNumber?: string;
  items: ReadBillableItem[];
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

const QUANTITY_PATTERN =
  /^(?!0(?:\.0{1,4})?$)(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/;

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

function readBillableItem(value: unknown): ReadBillableItem {
  if (!isRecord(value)) {
    throw new Error('Invalid billable item');
  }

  const description = requireString(
    value['description'],
    'item description',
  );

  if (description.length > 500) {
    throw new Error('Invalid billable item description');
  }

  const quantity = value['quantity'];

  if (
    typeof quantity !== 'string'
    || !QUANTITY_PATTERN.test(quantity)
  ) {
    throw new Error('Invalid billable item quantity');
  }

  if (value['currency'] !== 'COP') {
    throw new Error('Invalid billable item currency');
  }

  if (
    !Number.isInteger(value['version'])
    || (value['version'] as number) < 1
  ) {
    throw new Error('Invalid billable item version');
  }

  if (
    value['status'] !== 'UNBILLED'
    && value['status'] !== 'BILLED'
  ) {
    throw new Error('Invalid billable item status');
  }

  const item: ReadBillableItem = {
    id: requireString(value['id'], 'item id'),
    patientId: requireString(value['patientId'], 'item patientId'),
    procedureId: requireString(value['procedureId'], 'item procedureId'),
    description,
    quantity,
    unitPrice: copMoney(value['unitPrice']),
    currency: 'COP',
    version: value['version'] as number,
    status: value['status'],
  };

  if (value['approvalRequired'] !== undefined) {
    if (typeof value['approvalRequired'] !== 'boolean') {
      throw new Error('Invalid billable item approvalRequired');
    }

    item.approvalRequired = value['approvalRequired'];
  }

  if (value['createdAt'] !== undefined) {
    item.createdAt = requireString(
      value['createdAt'],
      'item createdAt',
    );
  }

  if (value['updatedAt'] !== undefined) {
    item.updatedAt = requireString(
      value['updatedAt'],
      'item updatedAt',
    );
  }

  return item;
}

export function readInvoiceDetail(value: unknown): ReadInvoice {
  if (!isRecord(value)) {
    throw new Error('Invalid invoice');
  }

  if (
    typeof value['status'] !== 'string'
    || !INVOICE_STATUSES.some(status => status === value['status'])
  ) {
    throw new Error('Invalid invoice status');
  }

  if (
    !Number.isInteger(value['version'])
    || (value['version'] as number) < 1
  ) {
    throw new Error('Invalid invoice version');
  }

  if (!Array.isArray(value['items'])) {
    throw new Error('Invalid invoice items');
  }

  if (value['currency'] !== 'COP') {
    throw new Error('Invalid invoice currency');
  }

  const invoice: ReadInvoice = {
    id: requireString(value['id'], 'id'),
    patientId: requireString(value['patientId'], 'patientId'),
    items: value['items'].map(readBillableItem),
    total: copMoney(value['total']),
    balance: copMoney(value['balance']),
    currency: 'COP',
    status: value['status'] as InvoiceStatus,
    version: value['version'] as number,
  };

  if (value['appointmentId'] !== undefined) {
    invoice.appointmentId = requireString(
      value['appointmentId'],
      'appointmentId',
    );
  }

  if (value['invoiceNumber'] !== undefined) {
    invoice.invoiceNumber = requireString(
      value['invoiceNumber'],
      'invoiceNumber',
    );
  }

  return invoice;
}

export function readInvoicePage(value: unknown): ReadInvoicePage {
  if (!isRecord(value)) {
    throw new Error('Invalid invoice page');
  }

  if (!Array.isArray(value['data']) || !isRecord(value['meta'])) {
    throw new Error('Invalid invoice page structure');
  }

  return {
    data: value['data'].map(readInvoiceDetail),
    meta: { ...value['meta'] },
  };
}
