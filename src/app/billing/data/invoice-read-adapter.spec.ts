import { describe, expect, it } from 'vitest';
import { readInvoiceDetail, readInvoicePage } from './invoice-read-adapter';

describe('invoice read adapter', () => {
  const validInvoice = {
    id: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: '150000.00',
    balance: '150000.00',
    currency: 'COP',
    status: 'DRAFT',
    version: 1,
  };

  const validItem = {
    id: '33333333-3333-4333-8333-333333333333',
    patientId: validInvoice.patientId,
    procedureId: '44444444-4444-4444-8444-444444444444',
    description: 'Dental procedure',
    quantity: '1.2500',
    unitPrice: '120000.00',
    currency: 'COP',
    version: 1,
    status: 'BILLED',
  };

  const validPage = {
    data: [validInvoice],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  it('reads a paginated invoice response', () => {
    const result = readInvoicePage(validPage);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: validInvoice.id,
      patientId: validInvoice.patientId,
      total: '150000.00',
      balance: '150000.00',
      currency: 'COP',
      status: 'DRAFT',
    });
    expect(result.meta).toEqual(validPage.meta);
  });

  it('preserves exact COP decimal strings', () => {
    const result = readInvoicePage({
      ...validPage,
      data: [{
        ...validInvoice,
        total: '999999999999.99',
        balance: '0.01',
      }],
    });

    expect(result.data[0].total).toBe('999999999999.99');
    expect(result.data[0].balance).toBe('0.01');
  });

  it('preserves absent invoice numbers without inventing labels', () => {
    const result = readInvoicePage(validPage);

    expect(result.data[0].invoiceNumber).toBeUndefined();
    expect(result.data[0]).not.toHaveProperty('patientName');
  });

  it('accepts every documented invoice status', () => {
    const statuses = [
      'DRAFT',
      'ISSUED',
      'PARTIALLY_PAID',
      'PAID',
      'CANCELLED',
    ] as const;

    for (const status of statuses) {
      const result = readInvoicePage({
        ...validPage,
        data: [{ ...validInvoice, status }],
      });

      expect(result.data[0].status).toBe(status);
    }
  });

  it('rejects an invalid invoice status', () => {
    expect(() => readInvoicePage({
      ...validPage,
      data: [{ ...validInvoice, status: 'UNKNOWN' }],
    })).toThrow();
  });

  it('rejects malformed monetary values', () => {
    expect(() => readInvoicePage({
      ...validPage,
      data: [{ ...validInvoice, total: 150000.00 }],
    })).toThrow();
  });

  it('rejects a response without the required page structure', () => {
    expect(() => readInvoicePage({
      data: [validInvoice],
    })).toThrow();
  });

  it('reads a single invoice without requiring pagination', () => {
    const result = readInvoiceDetail(validInvoice);

    expect(result.id).toBe(validInvoice.id);
    expect(result.patientId).toBe(validInvoice.patientId);
    expect(result.status).toBe('DRAFT');
    expect(result.version).toBe(1);
    expect(result.items).toEqual([]);
  });

  it('preserves the invoice version and exact COP amounts', () => {
    const result = readInvoiceDetail({
      ...validInvoice,
      version: 7,
      total: '999999999999.99',
      balance: '0.01',
    });

    expect(result.version).toBe(7);
    expect(result.total).toBe('999999999999.99');
    expect(result.balance).toBe('0.01');
    expect(result.currency).toBe('COP');
  });

  it('rejects a single invoice with an invalid version', () => {
    expect(() => readInvoiceDetail({
      ...validInvoice,
      version: 0,
    })).toThrow('Invalid invoice version');
  });

  it('reads validated billable items with exact decimal values', () => {
    const result = readInvoiceDetail({
      ...validInvoice,
      items: [validItem],
    });

    expect(result.items).toEqual([validItem]);
    expect(result.items[0]).toMatchObject({
      description: 'Dental procedure',
      quantity: '1.2500',
      unitPrice: '120000.00',
      currency: 'COP',
      status: 'BILLED',
    });
  });

  it('rejects billable items without required fields', () => {
    const { description, ...incompleteItem } = validItem;
    void description;

    expect(() => readInvoiceDetail({
      ...validInvoice,
      items: [incompleteItem],
    })).toThrow();
  });

  it('rejects invalid quantities in billable items', () => {
    for (const quantity of ['0', '-1', '1.12345', 2]) {
      expect(() => readInvoiceDetail({
        ...validInvoice,
        items: [{ ...validItem, quantity }],
      })).toThrow();
    }
  });

  it('rejects invalid billable item prices and currencies', () => {
    for (const changes of [
      { unitPrice: 120000 },
      { unitPrice: 'invalid' },
      { currency: 'USD' },
    ]) {
      expect(() => readInvoiceDetail({
        ...validInvoice,
        items: [{ ...validItem, ...changes }],
      })).toThrow();
    }
  });

  it('rejects invalid billable item versions and statuses', () => {
    for (const changes of [
      { version: 0 },
      { status: 'UNKNOWN' },
    ]) {
      expect(() => readInvoiceDetail({
        ...validInvoice,
        items: [{ ...validItem, ...changes }],
      })).toThrow();
    }
  });
});
