/**
 * Print a complete HTML document (a certificate, a letter) without opening a new tab:
 * it is written into a hidden iframe, printed, and the frame removed afterwards.
 * Works with pop-up blockers, and nothing from the app's own page leaks into the print.
 */
export function printHtml(html, title = 'Document') {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = title;
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } finally {
      cleanup();
    }
  };
  frame.srcdoc = html;
}
