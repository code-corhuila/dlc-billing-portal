
import { describe, expect, it, vi } from 'vitest';

import type { PortalContext } from '../../shell-contract';
import { loadInvoiceReadState } from './invoice-read-flow';
import { createInvoiceReadState } from './invoice-read-state';

type ReadContext = Pick<PortalContext, 'http' | 'signal'>;

function createContext(
  request: PortalContext['http']['request'],
  signal = new AbortController().signal,
): ReadContext {
  return {
    http: { request },
    signal,
  };
}

const invoicePage = {
  data: [
    {
      id: 'invoice-001',
      patientId: 'patient-001',
      invoiceNumber: 'INV-001',
      items: [],
      total: '150000.00',
      balance: '150000.00',
      currency: 'COP',
      status: 'ISSUED',
      version: 1,
    },
  ],
  meta: {},
};

describe('invoice read flow', () => {
  it('loads and projects valid invoices', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: invoicePage,
    });

    const state = await loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'success',
      invoices: [
        {
          id: 'invoice-001',
          number: 'INV-001',
          patientName: 'patient-001',
          amount: '150000.00',
          status: 'ISSUED',
        },
      ],
    });
    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/invoices',
      signal: expect.any(AbortSignal),
    });
  });

  it('accepts an empty invoice page', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: { data: [], meta: {} },
    });

    const state = await loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'success',
      invoices: [],
    });
  });

  it('returns error without previous invoices on HTTP failure', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
    });

    const state = await loadInvoiceReadState(
      createContext(request),
      {
        status: 'success',
        invoices: [
          {
            id: 'old-invoice',
            number: 'OLD-001',
            patientName: 'Demo Patient',
            amount: '100.00',
            status: 'ISSUED',
          },
        ],
      },
    );

    expect(state).toEqual({
      status: 'error',
      invoices: [],
    });
  });

  it('returns error for an invalid API response', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: { data: 'invalid', meta: {} },
    });

    const state = await loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'error',
      invoices: [],
    });
  });

  it('returns cancelled without making a pre-aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();

    const state = await loadInvoiceReadState(
      createContext(request, controller.signal),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'cancelled',
      invoices: [],
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('returns cancelled when aborted during the request', async () => {
    const controller = new AbortController();
    const request = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error('Network interrupted');
    });

    const state = await loadInvoiceReadState(
      createContext(request, controller.signal),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'cancelled',
      invoices: [],
    });
  });

  it('returns error for a network failure without cancellation', async () => {
    const request = vi.fn().mockRejectedValue(
      new Error('Network unavailable'),
    );

    const state = await loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
    );

    expect(state).toEqual({
      status: 'error',
      invoices: [],
    });
  });
});
