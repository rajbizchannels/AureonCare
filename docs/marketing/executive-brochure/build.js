#!/usr/bin/env node
/**
 * Builds the executive brief as a self-contained web page and a matching PDF.
 *
 *   NODE_PATH=$(npm root -g) node docs/marketing/executive-brochure/build.js
 *
 * One template, two outputs, so the page and the PDF cannot drift apart:
 *
 *   aureoncare-executive-brief.html   fonts, logo and screens inlined; publishable as-is
 *   aureoncare-executive-brief.pdf    ten US-Letter pages, rendered by Chromium from the same page
 *
 * Everything is inlined rather than linked. The web page is hosted under a
 * content policy that blocks images from anywhere but data: URIs, and the PDF
 * is rendered offline, so a Google Fonts link would silently fall back to a
 * system face in exactly the output people print.
 *
 * The typefaces are Bricolage Grotesque, Source Serif 4 and IBM Plex Mono, all
 * under the SIL Open Font License, which permits bundling them like this.
 *
 * The screens in assets/screens are captures of the demo environment
 * (synthetic data) taken through docs/demo/video-harness. Every figure that
 * shows one says so in its caption — keep it that way if they are replaced.
 */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ASSETS = path.join(HERE, 'assets');
const OUT_HTML = path.join(HERE, 'aureoncare-executive-brief.html');
const OUT_PDF = path.join(HERE, 'aureoncare-executive-brief.pdf');

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, '
  + 'U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, '
  + 'U+FEFF, U+FFFD';

const FACES = [
  ['Bricolage Grotesque', 'normal', '500 800', 'bricolage-grotesque.woff2'],
  ['Source Serif 4', 'normal', '400 700', 'source-serif-4.woff2'],
  ['Source Serif 4', 'italic', '400', 'source-serif-4-italic.woff2'],
  ['IBM Plex Mono', 'normal', '400', 'ibm-plex-mono-400.woff2'],
  ['IBM Plex Mono', 'normal', '500', 'ibm-plex-mono-500.woff2'],
];

const dataUri = (file, type) =>
  `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;

function fontFaces() {
  return FACES.map(([family, style, weight, file]) => (
    `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};`
    + `font-display:swap;src:url(${dataUri(path.join(ASSETS, 'fonts', file), 'font/woff2')}) `
    + `format('woff2');unicode-range:${LATIN};}`
  )).join('\n');
}

function build() {
  let html = fs.readFileSync(path.join(HERE, 'brochure.template.html'), 'utf8');

  html = html.replace('/*{{fonts}}*/', fontFaces());
  html = html.split('{{logo}}').join(dataUri(path.join(ASSETS, 'logo.png'), 'image/png'));
  html = html.replace(/\{\{img:([a-z0-9-]+)\}\}/g, (_, name) => {
    const file = path.join(ASSETS, 'screens', `${name}.jpg`);
    if (!fs.existsSync(file)) throw new Error(`Template references a missing screen: ${name}`);
    return dataUri(file, 'image/jpeg');
  });

  const left = html.match(/\{\{[^}]+\}\}/);
  if (left) throw new Error(`Unfilled placeholder in template: ${left[0]}`);

  fs.writeFileSync(OUT_HTML, html, 'utf8');
  console.log(`  html  ${path.relative(process.cwd(), OUT_HTML)}  ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
  return html;
}

/**
 * The published page is wrapped in a document skeleton by the host, so the
 * template has no <html>/<head>/<body>. Chromium needs one to print, so this
 * supplies the same minimal frame: a charset, a viewport and a zero margin.
 */
const asDocument = (fragment) => '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + '<style>html,body{margin:0}</style></head><body>' + fragment + '</body></html>';

async function renderPdf(fragment) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(asDocument(fragment), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });

    // A printed sheet is a fixed 11in with overflow hidden, so anything that
    // does not fit is cut off without a sound. Measure every sheet first and
    // refuse to write a PDF that would lose content.
    const clipped = await page.evaluate(() => Array.from(document.querySelectorAll('.sheet'))
      .map((sheet, i) => {
        const inner = sheet.querySelector('.sheet-in');
        const over = inner ? inner.scrollHeight - inner.clientHeight : 0;
        return { page: i + 1, label: sheet.getAttribute('aria-label'), over };
      })
      .filter((s) => s.over > 1));
    if (clipped.length) {
      for (const c of clipped) console.error(`  ✗ page ${c.page} (${c.label}) overflows by ${c.over}px`);
      throw new Error('Content would be clipped in print. Tighten those sheets and rebuild.');
    }

    await page.pdf({ path: OUT_PDF, preferCSSPageSize: true, printBackground: true });
    const pages = await page.evaluate(() => document.querySelectorAll('.sheet').length);
    console.log(`  pdf   ${path.relative(process.cwd(), OUT_PDF)}  ${pages} pages  ${(fs.statSync(OUT_PDF).size / 1024 / 1024).toFixed(2)} MB`);
  } finally {
    await browser.close();
  }
}

(async () => {
  const fragment = build();
  if (!process.argv.includes('--html-only')) await renderPdf(fragment);
})().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
