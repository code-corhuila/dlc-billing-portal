
import { describe, expect, it } from 'vitest';
import { readInvoicePage } from './invoice-read-adapter';

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
});
