import { describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '../../shell-contract';
import { loadInvoiceDetailReadState } from './invoice-detail-read-flow';
import {
  createInvoiceDetailReadState,
  invoiceDetailReadSuccess,
  type InvoiceDetailReadState,
} from './invoice-detail-read-state';
import { readInvoiceDetail } from './invoice-read-adapter';

type ReadContext = Pick<PortalContext, 'http' | 'signal'>;

const invoice = {
  id: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

function createContext(
  request: PortalContext['http']['request'],
  signal = new AbortController().signal,
): ReadContext {
  return {
    http: { request },
    signal,
  };
}

describe('invoice detail read flow', () => {
  it('loads an individual invoice through the shared HTTP client', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: invoice,
    });

    const context = createContext(request);
    const state = await loadInvoiceDetailReadState(
      context,
      invoice.id,
      createInvoiceDetailReadState(),
    );

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: `/api/v1/invoices/${invoice.id}`,
      signal: context.signal,
    });

    expect(state).toEqual({
      status: 'success',
      invoice: readInvoiceDetail(invoice),
    });

    expect(state.invoice?.version).toBe(3);
    expect(state.invoice?.total).toBe('150000.00');
    expect(state.invoice?.balance).toBe('75000.00');
  });

  it('publishes loading before the request completes', async () => {
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise<unknown>(resolve => {
      resolveRequest = resolve;
    });
    const request = vi.fn().mockReturnValue(pending);
    const states: InvoiceDetailReadState[] = [];

    const result = loadInvoiceDetailReadState(
      createContext(request),
      invoice.id,
      createInvoiceDetailReadState(),
      state => states.push(state),
    );

    expect(states).toEqual([
      { status: 'loading', invoice: undefined },
    ]);

    resolveRequest({ ok: true, data: invoice });
    await result;

    expect(states).toEqual([
      { status: 'loading', invoice: undefined },
      { status: 'success', invoice: readInvoiceDetail(invoice) },
    ]);
  });

  it('clears previous invoice data while loading', async () => {
    let resolveRequest!: (value: unknown) => void;
    const pending = new Promise<unknown>(resolve => {
      resolveRequest = resolve;
    });
    const request = vi.fn().mockReturnValue(pending);
    const states: InvoiceDetailReadState[] = [];
    const previous = invoiceDetailReadSuccess(
      readInvoiceDetail(invoice),
    );

    const result = loadInvoiceDetailReadState(
      createContext(request),
      invoice.id,
      previous,
      state => states.push(state),
    );

    expect(states[0]).toEqual({
      status: 'loading',
      invoice: undefined,
    });

    resolveRequest({ ok: true, data: invoice });
    await result;
  });

  it('publishes error without retaining previous data on HTTP failure', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false });
    const states: InvoiceDetailReadState[] = [];
    const previous = invoiceDetailReadSuccess(
      readInvoiceDetail(invoice),
    );

    const result = await loadInvoiceDetailReadState(
      createContext(request),
      invoice.id,
      previous,
      state => states.push(state),
    );

    expect(result).toEqual({
      status: 'error',
      invoice: undefined,
    });

    expect(states).toEqual([
      { status: 'loading', invoice: undefined },
      { status: 'error', invoice: undefined },
    ]);
  });

  it('returns error for an invalid invoice response', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      data: { ...invoice, version: 0 },
    });

    const result = await loadInvoiceDetailReadState(
      createContext(request),
      invoice.id,
      createInvoiceDetailReadState(),
    );

    expect(result).toEqual({
      status: 'error',
      invoice: undefined,
    });
  });

  it('returns error for a network failure', async () => {
    const request = vi.fn().mockRejectedValue(
      new Error('Network unavailable'),
    );

    const result = await loadInvoiceDetailReadState(
      createContext(request),
      invoice.id,
      createInvoiceDetailReadState(),
    );

    expect(result).toEqual({
      status: 'error',
      invoice: undefined,
    });
  });

  it('does not send a request when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn();
    const states: InvoiceDetailReadState[] = [];

    const result = await loadInvoiceDetailReadState(
      createContext(request, controller.signal),
      invoice.id,
      createInvoiceDetailReadState(),
      state => states.push(state),
    );

    expect(request).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'cancelled',
      invoice: undefined,
    });
    expect(states).toEqual([
      { status: 'cancelled', invoice: undefined },
    ]);
  });

  it('returns cancelled when aborted during the request', async () => {
    const controller = new AbortController();
    const request = vi.fn().mockImplementation(async () => {
      controller.abort();
      return { ok: true, data: invoice };
    });
    const states: InvoiceDetailReadState[] = [];

    const result = await loadInvoiceDetailReadState(
      createContext(request, controller.signal),
      invoice.id,
      createInvoiceDetailReadState(),
      state => states.push(state),
    );

    expect(result).toEqual({
      status: 'cancelled',
      invoice: undefined,
    });
    expect(states.map(state => state.status)).toEqual([
      'loading',
      'cancelled',
    ]);
  });
});
