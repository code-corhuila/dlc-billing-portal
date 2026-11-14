import { afterEach, expect, it, vi } from 'vitest';
import { deliverInvoicePdf } from './invoice-pdf-browser-download';

const invoiceId = '11111111-1111-4111-8111-111111111111';

function setupBrowser() {
  const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
  const createObjectURL = vi.fn().mockReturnValue('blob:invoice-pdf');
  const revokeObjectURL = vi.fn();
  const click = vi.fn();
  const remove = vi.fn();

  const anchor = {
    href: '',
    download: '',
    click,
    remove,
  };

  const appendChild = vi.fn();

  const browser = {
    createObjectURL,
    revokeObjectURL,
    createAnchor: vi.fn().mockReturnValue(anchor),
    appendAnchor: appendChild,
  };

  return {
    blob,
    anchor,
    browser,
    createObjectURL,
    revokeObjectURL,
    click,
    remove,
    appendChild,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it('creates a temporary URL for the PDF Blob', () => {
  const { blob, browser, createObjectURL } = setupBrowser();

  deliverInvoicePdf(blob, invoiceId, browser);

  expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(blob);
});

it('sets a safe PDF filename and triggers the browser download', () => {
  const { blob, browser, anchor, appendChild, click } = setupBrowser();

  deliverInvoicePdf(blob, invoiceId, browser);

  expect(anchor.href).toBe('blob:invoice-pdf');
  expect(anchor.download).toBe(`invoice-${invoiceId}.pdf`);
  expect(appendChild).toHaveBeenCalledExactlyOnceWith(anchor);
  expect(click).toHaveBeenCalledOnce();
});

it('releases the temporary URL and removes the anchor after delivery', () => {
  const { blob, browser, revokeObjectURL, remove } = setupBrowser();

  deliverInvoicePdf(blob, invoiceId, browser);

  expect(remove).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:invoice-pdf');
});

it('cleans up browser resources when the download click fails', () => {
  const { blob, browser, click, remove, revokeObjectURL } = setupBrowser();

  click.mockImplementation(() => {
    throw new Error('Download blocked');
  });

  expect(() => deliverInvoicePdf(blob, invoiceId, browser))
    .toThrow('Download blocked');

  expect(remove).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:invoice-pdf');
});

it('does not allow unsafe characters in the download filename', () => {
  const { blob, browser, anchor } = setupBrowser();

  deliverInvoicePdf(blob, '../invoice/unsafe:name', browser);

  expect(anchor.download).toBe('invoice-.._invoice_unsafe_name.pdf');
});
