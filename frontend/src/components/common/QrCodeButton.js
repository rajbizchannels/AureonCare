import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Download, Printer, Copy, Check, Loader2 } from 'lucide-react';

/**
 * A "QR code" button for a link that is shared with someone: opens a dialog with the code,
 * the link, and Download / Print / Copy.
 *
 * The code is drawn in the browser (no request carries the link anywhere). `getUrl` may
 * be a string or an async function — e.g. one that asks the server for a short link
 * (/s/<code>), which makes a smaller, easier-to-scan code. It runs only when the dialog
 * is opened, and once.
 */
export async function makeQrDataUrl(text, width = 512) {
  return QRCode.toDataURL(text, {
    width, margin: 2, errorCorrectionLevel: 'M',
    color: { dark: '#0F172AFF', light: '#FFFFFFFF' },
  });
}

const safeName = (s) => String(s || 'qr-code').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'qr-code';

const QrCodeButton = ({ getUrl, title = 'QR code', description, filename, theme = 'light', label = 'QR code', className = '' }) => {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [img, setImg] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const u = typeof getUrl === 'function' ? await getUrl() : getUrl;
      if (!u) throw new Error('There is no link to show yet.');
      setUrl(u);
      setImg(await makeQrDataUrl(u));
    } catch (e) {
      setError(e.message || 'Could not create the QR code.');
    }
  }, [getUrl]);

  useEffect(() => { if (open && !img && !error) load(); }, [open, img, error, load]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const download = () => {
    const a = document.createElement('a');
    a.href = img;
    a.download = `${safeName(filename || title)}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Print just the code, its title and the link, from a hidden frame (no pop-up window).
  const print = () => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' });
    document.body.appendChild(frame);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-align:center;padding:40px;color:#0F172A}
      h1{font-size:22px;margin:0 0 6px}p{color:#475569;margin:0 0 18px}img{width:320px;height:320px}
      .u{font-family:monospace;font-size:13px;word-break:break-all;margin-top:14px}.b{font-weight:700;margin-top:24px}
      .g{color:#F9BD00}.t{color:#08B39C}</style></head><body>
      <h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}
      <img src="${img}" alt="QR code"><div class="u">${esc(url)}</div>
      <div class="b"><span class="g">Aureon</span><span class="t">Care</span></div></body></html>`);
    doc.close();
    const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); };
    const image = doc.querySelector('img');
    if (image && !image.complete) image.onload = go; else go();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  const btn = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
    dark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Show a QR code for this link"
              className={className || `inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border shrink-0 ${
                dark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
        <QrCode className="w-3.5 h-3.5" />{label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"
             aria-label={title} onClick={() => setOpen(false)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 shadow-xl ${dark ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-semibold">{title}</h3>
                {description && <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{description}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                      className={`p-1 rounded ${dark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center">
              {img ? (
                <img src={img} alt={`QR code for ${url}`} className="w-60 h-60 rounded-lg bg-white p-1" />
              ) : error ? (
                <p className="text-sm text-red-500 py-16 text-center">{error}</p>
              ) : (
                <div className="w-60 h-60 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              )}
            </div>
            {url && <p className={`mt-3 text-xs font-mono break-all text-center ${dark ? 'text-slate-300' : 'text-gray-600'}`}>{url}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={download} disabled={!img} className={`${btn} disabled:opacity-50`}>
                <Download className="w-4 h-4" />Download PNG
              </button>
              <button type="button" onClick={print} disabled={!img} className={`${btn} disabled:opacity-50`}>
                <Printer className="w-4 h-4" />Print
              </button>
              <button type="button" onClick={copy} disabled={!url} className={`${btn} disabled:opacity-50`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QrCodeButton;
