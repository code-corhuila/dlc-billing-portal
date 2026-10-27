interface InvoicePdfAnchor {
  href: string;
  download: string;
  click(): void;
  remove(): void;
}

export interface InvoicePdfBrowser {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): InvoicePdfAnchor;
  appendAnchor(anchor: InvoicePdfAnchor): void;
}

function getDefaultBrowser(): InvoicePdfBrowser {
  return {
    createObjectURL: blob => URL.createObjectURL(blob),
    revokeObjectURL: url => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
    appendAnchor: anchor => document.body.appendChild(anchor as HTMLAnchorElement),
  };
}

export function deliverInvoicePdf(
  blob: Blob,
  invoiceId: string,
  browser: InvoicePdfBrowser = getDefaultBrowser(),
): void {
  const safeInvoiceId = invoiceId.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `invoice-${safeInvoiceId}.pdf`;

  const url = browser.createObjectURL(blob);
  let anchor: InvoicePdfAnchor | undefined;

  try {
    anchor = browser.createAnchor();
    anchor.href = url;
    anchor.download = filename;

    browser.appendAnchor(anchor);
    anchor.click();
  } finally {
    try {
      anchor?.remove();
    } finally {
      browser.revokeObjectURL(url);
    }
  }
}
