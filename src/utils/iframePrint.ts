/**
 * iframePrint.ts — UX-01: Thermal Receipt Printing via Hidden Iframe
 *
 * Modern browsers block `window.print()` calls made after async operations
 * (e.g. `await fetch()`). Injecting a hidden iframe and calling
 * `iframe.contentWindow.print()` synchronously avoids the popup blocker
 * because the print dialog originates from the iframe's own window context.
 *
 * The iframe is automatically removed from the DOM after printing completes
 * (or after a 3-second safety timeout if `afterprint` does not fire).
 */

export function printViaIframe(htmlContent: string): void {
  // Remove any leftover iframe from a previous print
  const existing = document.getElementById('__thermal_print_iframe__');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__thermal_print_iframe__';

  // Hide iframe completely — it must not affect the page layout
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '-10000px',
    left: '-10000px',
    width: '0',
    height: '0',
    border: 'none',
    visibility: 'hidden',
  });

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    // Safety fallback: if iframe fails, fall back to window.print
    console.warn('[iframePrint] Could not access iframe document. Falling back to window.print().');
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Cleanup: remove iframe after print dialog is dismissed
  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
    }, 500);
  };

  iframe.contentWindow?.addEventListener('afterprint', cleanup);

  // Safety timeout: always remove after 3 seconds even if afterprint never fires
  setTimeout(() => {
    if (document.getElementById('__thermal_print_iframe__')) {
      iframe.remove();
    }
  }, 3000);

  // Trigger print — synchronous call inside iframe's window context
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
}

/**
 * Wraps a thermal receipt HTML snippet into a full self-contained HTML document
 * optimised for 80mm thermal printers with embedded CSS reset.
 */
export function buildThermalHtmlDocument(innerHtml: string, title = 'Receipt'): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 80mm;
      max-width: 80mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      padding: 4mm;
    }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { padding: 2mm; }
    }
  </style>
</head>
<body>
${innerHtml}
</body>
</html>`;
}
