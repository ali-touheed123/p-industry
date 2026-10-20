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

export function printViaIframe(htmlContent: string, onError?: (err: Error) => void): boolean {
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
    // Workstream H: Do NOT call window.print() — it prints the top-level application dashboard!
    console.error('[iframePrint] Could not access iframe document context.');
    iframe.remove();
    const err = new Error('Printer iframe document could not be initialized.');
    if (onError) onError(err);
    return false;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  // Cleanup: remove iframe after print dialog is dismissed
  const cleanup = () => {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.remove();
      }
    }, 500);
  };

  iframe.contentWindow?.addEventListener('afterprint', cleanup);

  // TASK-P11-06: Extend fallback safety timeout to 30 seconds to prevent premature detachment during slow print dialog interactions
  safetyTimer = setTimeout(() => {
    if (document.getElementById('__thermal_print_iframe__')) {
      iframe.remove();
    }
  }, 30000);

  // Trigger print — synchronous call inside iframe's window context
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  return true;
}

/**
 * Wraps a thermal receipt HTML snippet into a full self-contained HTML document
 * optimised for 80mm thermal printers with embedded CSS reset.
 *
 * @deprecated Legacy wrapper that hardcodes 80mm Courier New.
 * POS and Sales History now use `renderReceiptDocument` from `receiptRenderCore.ts`.
 * Retained for backward compatibility.
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
      @page { size: 80mm 297mm; margin: 0; }
      body { padding: 2mm; }
    }
  </style>
</head>
<body>
${innerHtml}
<script>
(function() {
  try {
    var b = document.body;
    var h = document.documentElement;
    var heightPx = Math.max(
      b ? b.scrollHeight : 0, b ? b.offsetHeight : 0,
      h ? h.scrollHeight : 0, h ? h.offsetHeight : 0
    );
    if (heightPx > 0) {
      var hMm = Math.ceil(heightPx * 25.4 / 96) + 6;
      var s = document.createElement('style');
      s.setAttribute('data-thermal-fit', 'true');
      s.textContent = '@page { size: 80mm ' + hMm + 'mm; margin: 0; }';
      document.head.appendChild(s);
    }
  } catch(e) {}
})();
</script>
</body>
</html>`;
}
