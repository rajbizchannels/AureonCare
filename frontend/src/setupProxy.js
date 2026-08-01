/**
 * CRA dev-server middleware.
 *
 * Adds Cross-Origin-Isolation headers required by the Zoom Meeting SDK
 * Component View. SharedArrayBuffer (used for WASM AV processing) is only
 * available when BOTH headers are present on the page response.
 *
 * We use "credentialless" instead of "require-corp" for COEP so that
 * cross-origin subresources from zoom.us (telemetry, CDN assets) are not
 * blocked.
 */
module.exports = function (app) {
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    next();
  });
};
