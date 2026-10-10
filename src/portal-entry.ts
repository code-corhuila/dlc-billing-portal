import { ApplicationRef, ErrorHandler, provideZonelessChangeDetection } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { BILLING_CONTEXT, BillingCompositionRoot } from './app/composition/billing-root.component';
import { PortalContext, PortalHandle } from './app/shell-contract';

export const portalId = 'billing';
export const contractVersion = 1;

export async function mount(
  host: HTMLElement, context: PortalContext,
): Promise<PortalHandle> {
  if (context.signal.aborted) throw new Error('CANCELLED');
  const element = host.ownerDocument.createElement('dlc-billing-root');
  host.appendChild(element);
  let application: ApplicationRef | undefined;
  let disposed = false;
  const unmount = async () => {
    if (disposed) return;
    disposed = true;
    context.signal.removeEventListener('abort', onAbort);
    try { application?.destroy(); } finally { element.remove(); }
  };
  const onAbort = () => {
    void unmount().catch(() => context.reportFailure({ code: 'PORTAL_TASK_FAILED' }));
  };
  try {
    application = await createApplication({ providers: [
      provideZonelessChangeDetection(),
      { provide: BILLING_CONTEXT, useValue: context },
      { provide: ErrorHandler, useValue: {
        handleError: () => context.reportFailure({ code: 'PORTAL_RENDER_FAILED' }),
      } },
    ] });
    if (context.signal.aborted) throw new Error('CANCELLED');
    const root = application.bootstrap(BillingCompositionRoot, element).instance;
    if (context.signal.aborted) throw new Error('CANCELLED');
    context.signal.addEventListener('abort', onAbort, { once: true });
    return {
      updateRoute: async (route) => {
        if (disposed) throw new Error('CANCELLED');
        root.route.set(route);
      },
      canLeave: async () => !disposed,
      unmount,
    };
  } catch (error) {
    try { await unmount(); } catch { /* Preserve the original mount failure. */ }
    throw error;
  }
}
