import { ApplicationRef, ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { BILLING_CONTEXT, BillingCompositionRoot } from './app/composition/billing-root.component';
import { PortalContext, PortalHandle } from './app/shell-contract';
import { provideInvoiceListSource } from './app/billing/data/invoice-list-source';

export const portalId = 'billing';
export const contractVersion = 1;

export async function mount(host: HTMLElement, context: PortalContext): Promise<PortalHandle> {
  if (context.signal.aborted) throw new Error('CANCELLED');

  const element = host.ownerDocument.createElement('dlc-billing-root');
  host.appendChild(element);

  let application: ApplicationRef | undefined;
  let disposed = false;
  let cleanup: Promise<void> | undefined;

  const unmount = () => {
    if (cleanup) return cleanup;

    disposed = true;
    context.signal.removeEventListener('abort', onAbort);

    cleanup = Promise.resolve().then(() => {
      try {
        application?.destroy();
      } finally {
        element.remove();
      }
    });

    return cleanup;
  };

  const onAbort = () => {
    void unmount().catch(() => {
      // Cleanup failure is reported to the compositor.
    });
  };

  try {
    application = await createApplication({
      providers: [
        provideZonelessChangeDetection(),
        provideInvoiceListSource(),
        { provide: BILLING_CONTEXT, useValue: context },
        {
          provide: ErrorHandler,
          useValue: {
            handleError: () => context.reportFailure({
              code: 'PORTAL_RENDER_FAILED',
            }),
          },
        },
      ],
    });

    if (context.signal.aborted) throw new Error('CANCELLED');

    const root = application.bootstrap(BillingCompositionRoot, element).instance;

    if (context.signal.aborted) throw new Error('CANCELLED');

    root.invoiceListMode.set('http');

    const syncRoute = async () => {
      if (disposed || context.signal.aborted) return;

      if (root.route().localPath === '/') {
        await root.loadInvoices();
      } else if (root.route().localPath === '/procedures') {
        await root.loadProcedurePrices();
      } else {
        await root.syncInvoiceRoute();
      }
    };

    context.signal.addEventListener('abort', onAbort, { once: true });

    void syncRoute();

    return {
      updateRoute: async route => {
        if (disposed) throw new Error('CANCELLED');

        root.route.set(route);
        await syncRoute();
      },
      canLeave: async () => !disposed && root.canLeave(),
      unmount,
    };
  } catch (error) {
    try {
      await unmount();
    } catch {
      // Preserve the original mounting error.
    }

    throw error;
  }
}