
import type { PortalContext } from '../../shell-contract';
import { readInvoicesHttp } from './invoice-http-read';
import {
  invoiceReadCancelled,
  invoiceReadError,
  invoiceReadSuccess,
  type InvoiceReadState,
} from './invoice-read-state';
import { projectInvoiceList } from '../presentation/invoice-list-projection';

export async function loadInvoiceReadState(
  context: Pick<PortalContext, 'http' | 'signal'>,
  previous: InvoiceReadState,
): Promise<InvoiceReadState> {
  if (context.signal.aborted) {
    return invoiceReadCancelled(previous);
  }

  try {
    const page = await readInvoicesHttp(context);

    if (context.signal.aborted) {
      return invoiceReadCancelled(previous);
    }

    const invoices = projectInvoiceList(page.data);

    return invoiceReadSuccess(invoices);
  } catch {
    if (context.signal.aborted) {
      return invoiceReadCancelled(previous);
    }

    return invoiceReadError(previous);
  }
}
