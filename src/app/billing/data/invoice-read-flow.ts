

import { readPageMeta, type PageMeta } from './pagination';
import type { PortalContext } from '../../shell-contract';
import { readInvoicesHttp } from './invoice-http-read';
import {
  invoiceReadCancelled,
  invoiceReadError,
  invoiceReadLoading,
  invoiceReadSuccess,
  type InvoiceReadState,
} from './invoice-read-state';
import { projectInvoiceList } from '../presentation/invoice-list-projection';

export async function loadInvoiceReadState(
  context: Pick<PortalContext, 'http' | 'signal'>,
  previous: InvoiceReadState,
  onStateChange?: (state: InvoiceReadState) => void,
  requestedPage?: number,
  onMeta?: (meta: PageMeta) => void,
): Promise<InvoiceReadState> {
  const publish = (state: InvoiceReadState): InvoiceReadState => {
    onStateChange?.(state);
    return state;
  };

  if (context.signal.aborted) {
    return publish(invoiceReadCancelled(previous));
  }

  const loading = publish(invoiceReadLoading(previous));

  try {
    const page = await readInvoicesHttp(context, requestedPage);

    if (context.signal.aborted) {
      return publish(invoiceReadCancelled(loading));
    }

    const meta = onMeta ? readPageMeta(page.meta) : undefined;
    const invoices = projectInvoiceList(page.data);
    if (meta) onMeta?.(meta);

    return publish(invoiceReadSuccess(invoices));
  } catch {
    if (context.signal.aborted) {
      return publish(invoiceReadCancelled(loading));
    }

    return publish(invoiceReadError(loading));
  }
}
