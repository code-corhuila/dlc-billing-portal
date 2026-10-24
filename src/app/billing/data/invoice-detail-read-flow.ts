import type { PortalContext } from '../../shell-contract';
import { readInvoiceDetailHttp } from './invoice-http-read';
import {
  invoiceDetailReadCancelled,
  invoiceDetailReadError,
  invoiceDetailReadLoading,
  invoiceDetailReadSuccess,
  type InvoiceDetailReadState,
} from './invoice-detail-read-state';

export async function loadInvoiceDetailReadState(
  context: Pick<PortalContext, 'http' | 'signal'>,
  invoiceId: string,
  previous: InvoiceDetailReadState,
  onStateChange?: (state: InvoiceDetailReadState) => void,
): Promise<InvoiceDetailReadState> {
  const publish = (
    state: InvoiceDetailReadState,
  ): InvoiceDetailReadState => {
    onStateChange?.(state);
    return state;
  };

  if (context.signal.aborted) {
    return publish(invoiceDetailReadCancelled(previous));
  }

  const loading = publish(invoiceDetailReadLoading(previous));

  try {
    const invoice = await readInvoiceDetailHttp(context, invoiceId);

    if (context.signal.aborted) {
      return publish(invoiceDetailReadCancelled(loading));
    }

    return publish(invoiceDetailReadSuccess(invoice));
  } catch {
    if (context.signal.aborted) {
      return publish(invoiceDetailReadCancelled(loading));
    }

    return publish(invoiceDetailReadError(loading));
  }
}
