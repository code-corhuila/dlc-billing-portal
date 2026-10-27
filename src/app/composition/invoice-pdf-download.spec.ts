import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { afterEach, expect, it, vi } from 'vitest';

import {
  BILLING_CONTEXT,
  BillingCompositionRoot,
} from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';
import * as pdfBrowser from '../billing/data/invoice-pdf-browser-download';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const otherInvoiceId = '33333333-3333-4333-8333-333333333333';

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(status: 'DRAFT' | 'ISSUED' = 'ISSUED') {
  const controller = new AbortController();
  const request = vi.fn();

  const context = {
    route: {
      localPath: `/invoices/${invoiceId}`,
      basePath: '/app/billing',
    },
    navigation: {
      request: vi.fn().mockResolvedValue({ status: 'applied' }),
    },
    http: { request },
    signal: controller.signal,
    reportFailure: vi.fn(),
    session: {
      getSnapshot: vi.fn(),
      subscribe: () => () => {},
    },
  };

  const injector = Injector.create({
    providers: [
      provideInvoiceListSource(dummyInvoiceList),
      { provide: BILLING_CONTEXT, useValue: context },
    ],
  });

  const frame = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  frame.invoiceListMode.set('http');
  frame.invoiceDetailReadState.set(
    invoiceDetailReadSuccess(readInvoiceDetail({
      id: invoiceId,
      patientId: '22222222-2222-4222-8222-222222222222',
      items: [],
      total: '150000.00',
      balance: '150000.00',
      currency: 'COP',
      status,
      version: 3,
    })),
  );

  return { frame, injector, request, controller, context };
}

function authorize(frame: BillingCompositionRoot): void {
  frame.session.set({
    state: 'authenticated',
    user: { roles: ['SECRETARY_ASSISTANT'] },
  } as never);
}

function pdfResponse() {
  return {
    ok: true as const,
    status: 200,
    data: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    headers: { 'content-type': 'application/pdf' },
    correlationId: 'test-correlation',
  };
}

it('does not allow PDF download without an authorized session', () => {
  const { frame, injector } = setup();

  try {
    expect(frame.canDownloadPdfInvoices()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('allows authorized staff to download in HTTP detail mode', () => {
  const { frame, injector } = setup();

  try {
    authorize(frame);
    expect(frame.canDownloadPdfInvoices()).toBe(true);
  } finally {
    injector.destroy();
  }
});

it('does not allow PDF downloads in demo mode', () => {
  const { frame, injector } = setup();

  try {
    authorize(frame);
    frame.invoiceListMode.set('demo');

    expect(frame.canDownloadPdfInvoices()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('requests the PDF using the documented HTTP contract', async () => {
  const { frame, injector, request, context } = setup();

  try {
    authorize(frame);
    request.mockResolvedValue(pdfResponse());

    await frame.downloadInvoicePdf(invoiceId);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: `/api/v1/invoices/${invoiceId}/pdf`,
      responseType: 'blob',
      signal: context.signal,
    });

    expect(frame.downloadingPdf()).toBe(false);
    expect(frame.pdfDownloadMessage()).toBe('');
  } finally {
    injector.destroy();
  }
});

it('does not download a draft invoice', async () => {
  const { frame, injector, request } = setup('DRAFT');

  try {
    authorize(frame);

    await frame.downloadInvoicePdf(invoiceId);

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('does not request a PDF for an unrelated invoice', async () => {
  const { frame, injector, request } = setup();

  try {
    authorize(frame);

    await frame.downloadInvoicePdf(otherInvoiceId);

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('prevents duplicate PDF requests while one is pending', async () => {
  const { frame, injector, request } = setup();

  try {
    authorize(frame);

    let settle!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => {
      settle = resolve;
    }));

    const first = frame.downloadInvoicePdf(invoiceId);

    expect(frame.downloadingPdf()).toBe(true);

    await frame.downloadInvoicePdf(invoiceId);
    expect(request).toHaveBeenCalledTimes(1);

    settle(pdfResponse());
    await first;

    expect(frame.downloadingPdf()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('does not retain PDF errors after navigating to another invoice', async () => {
  const { frame, injector, request } = setup();

  try {
    authorize(frame);

    let rejectRequest!: (reason: Error) => void;
    request.mockReturnValue(new Promise((_, reject) => {
      rejectRequest = reject;
    }));

    const pending = frame.downloadInvoicePdf(invoiceId);

    frame.route.set({
      ...frame.route(),
      localPath: `/invoices/${otherInvoiceId}`,
    });

    rejectRequest(new Error('Network unavailable'));
    await pending;

    expect(frame.pdfDownloadMessage()).toBe('');
  } finally {
    injector.destroy();
  }
});

it('reports HTTP failures without exposing internal details', async () => {
  const { frame, injector, request, context } = setup();

  try {
    authorize(frame);
    request.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Internal authorization details',
      details: null,
      traceId: 'test-trace',
      correlationId: 'test-correlation',
      kind: 'http',
      retryable: false,
    });

    await frame.downloadInvoicePdf(invoiceId);

    expect(frame.pdfDownloadMessage()).toContain('permisos');
    expect(frame.pdfDownloadMessage()).not.toContain('Internal');
    expect(context.reportFailure).toHaveBeenCalledWith({
      code: 'PORTAL_TASK_FAILED',
    });
    expect(frame.downloadingPdf()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('delivers the downloaded PDF Blob to the browser', async () => {
  const { frame, injector, request } = setup();
  const deliver = vi.spyOn(pdfBrowser, 'deliverInvoicePdf')
    .mockImplementation(() => {});

  try {
    authorize(frame);
    const response = pdfResponse();
    request.mockResolvedValue(response);

    await frame.downloadInvoicePdf(invoiceId);

    expect(deliver).toHaveBeenCalledExactlyOnceWith(
      response.data,
      invoiceId,
    );
  } finally {
    injector.destroy();
  }
});

it('does not deliver a stale PDF after navigating away', async () => {
  const { frame, injector, request } = setup();
  const deliver = vi.spyOn(pdfBrowser, 'deliverInvoicePdf')
    .mockImplementation(() => {});

  try {
    authorize(frame);

    let settle!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => {
      settle = resolve;
    }));

    const pending = frame.downloadInvoicePdf(invoiceId);

    frame.route.set({
      ...frame.route(),
      localPath: `/invoices/${otherInvoiceId}`,
    });

    settle(pdfResponse());
    await pending;

    expect(deliver).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('does not deliver the PDF after authorization is revoked', async () => {
  const { frame, injector, request } = setup();
  const deliver = vi.spyOn(pdfBrowser, 'deliverInvoicePdf')
    .mockImplementation(() => {});

  try {
    authorize(frame);

    let settle!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => {
      settle = resolve;
    }));

    const pending = frame.downloadInvoicePdf(invoiceId);

    frame.session.set({
      state: 'anonymous',
    } as never);

    settle(pdfResponse());
    await pending;

    expect(deliver).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});
