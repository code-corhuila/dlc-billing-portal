
import { describe, expect, it, vi } from 'vitest';

import type { PortalContext } from '../../shell-contract';
import { loadInvoiceReadState } from './invoice-read-flow';
import {
  createInvoiceReadState,
  type InvoiceReadState,
} from './invoice-read-state';

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

  it('publishes loading before a pending request finishes', async () => {
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      resolveRequest = resolve;
    });
    const request = vi.fn().mockReturnValue(pending);
    const states: InvoiceReadState[] = [];

    const result = loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
      (state) => states.push(state),
    );

    expect(states).toEqual([
      { status: 'loading', invoices: [] },
    ]);

    resolveRequest({ ok: true, data: invoicePage });
    await result;

    expect(states.map((state) => state.status)).toEqual([
      'loading',
      'success',
    ]);
  });

  it('publishes an empty loading state instead of previous invoices', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: { data: [], meta: {} },
    });
    const states: InvoiceReadState[] = [];

    await loadInvoiceReadState(
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
      (state) => states.push(state),
    );

    expect(states).toEqual([
      { status: 'loading', invoices: [] },
      { status: 'success', invoices: [] },
    ]);
  });

  it('publishes loading followed by error on HTTP failure', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false });
    const states: InvoiceReadState[] = [];

    await loadInvoiceReadState(
      createContext(request),
      createInvoiceReadState(),
      (state) => states.push(state),
    );

    expect(states).toEqual([
      { status: 'loading', invoices: [] },
      { status: 'error', invoices: [] },
    ]);
  });

  it('does not publish loading for an already cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();
    const states: InvoiceReadState[] = [];

    const result = await loadInvoiceReadState(
      createContext(request, controller.signal),
      createInvoiceReadState(),
      (state) => states.push(state),
    );

    expect(result).toEqual({
      status: 'cancelled',
      invoices: [],
    });
    expect(states).toEqual([
      { status: 'cancelled', invoices: [] },
    ]);
    expect(request).not.toHaveBeenCalled();
  });
});
