import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader } from 'lucide-react';

/**
 * ZoomMeetingEmbed
 *
 * Launches a Zoom meeting embedded inside the AureonCare app — no new tab or popup.
 *
 * Uses the Zoom Meeting SDK (Client View, CDN-loaded) together with:
 *   - ZAK token  : host privileges for the logged-in Zoom account
 *   - sdkToken   : Meeting SDK JWT from Zoom API   (preferred, no extra env vars)
 *   - signature  : HMAC-signed JWT from ZOOM_SDK_KEY/SECRET  (fallback)
 *
 * The SDK renders into #zmmtg-root (appended to document.body by the SDK itself).
 * We position that div as a fixed full-screen overlay via an injected <style>.
 *
 * Props:
 *   meetingId   {string}   – Zoom meeting number
 *   onClose     {function} – called when the user leaves / cancels
 *   api         {object}   – apiService instance
 *   displayName {string}   – name shown in meeting (default: "Host")
 */

const ZOOM_SDK_VERSION = '2.18.2';
const ZOOM_SDK_CDN = `https://source.zoom.us/${ZOOM_SDK_VERSION}`;

const ZoomMeetingEmbed = ({ meetingId, onClose, api, displayName = 'Host' }) => {
  const [status, setStatus] = useState('loading'); // loading | joining | joined | error
  const [errorMsg, setErrorMsg] = useState(null);
  const mountedRef = useRef(true);
  const styleInjectedRef = useRef(false);

  // ------------------------------------------------------------------
  // Inject a <style> that forces #zmmtg-root to fill the viewport and
  // sit above everything else in the React app.
  // ------------------------------------------------------------------
  const injectOverlayStyle = useCallback(() => {
    if (styleInjectedRef.current) return;
    styleInjectedRef.current = true;
    const style = document.createElement('style');
    style.id = 'zoom-overlay-style';
    style.textContent = `
      #zmmtg-root {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 9999 !important;
        background: #1a1a2e !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  const removeOverlayStyle = useCallback(() => {
    const style = document.getElementById('zoom-overlay-style');
    if (style) style.remove();
    styleInjectedRef.current = false;
  }, []);

  // ------------------------------------------------------------------
  // Load the Zoom SDK script + CSS from CDN (only once per page load)
  // ------------------------------------------------------------------
  const loadSDK = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Already loaded
      if (window.ZoomMtg) { resolve(); return; }

      // Inject CSS
      if (!document.getElementById('zoom-sdk-css')) {
        const link = document.createElement('link');
        link.id = 'zoom-sdk-css';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `${ZOOM_SDK_CDN}/zoom.min.css`;
        document.head.appendChild(link);
      }

      // If script tag already exists but window.ZoomMtg not ready yet, just poll
      if (document.getElementById('zoom-sdk-js')) {
        const timer = setInterval(() => {
          if (window.ZoomMtg) { clearInterval(timer); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(timer); reject(new Error('Zoom SDK load timeout')); }, 20000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'zoom-sdk-js';
      script.src = `${ZOOM_SDK_CDN}/lib/ZoomMtg.min.js`;
      script.onload = () => {
        // Wait for the global to be populated
        const timer = setInterval(() => {
          if (window.ZoomMtg) { clearInterval(timer); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(timer); reject(new Error('Zoom SDK load timeout')); }, 20000);
      };
      script.onerror = () =>
        reject(new Error('Failed to load Zoom SDK. Please check your network connection.'));
      document.head.appendChild(script);
    });
  }, []);

  // ------------------------------------------------------------------
  // Cleanup: leave meeting and hide the SDK root div
  // ------------------------------------------------------------------
  const cleanup = useCallback(() => {
    removeOverlayStyle();
    if (window.ZoomMtg) {
      try { window.ZoomMtg.endMeeting({}); } catch (_) {}
    }
    const root = document.getElementById('zmmtg-root');
    if (root) root.style.display = 'none';
  }, [removeOverlayStyle]);

  // ------------------------------------------------------------------
  // Main: load SDK → fetch tokens → init → join
  // ------------------------------------------------------------------
  const loadAndJoin = useCallback(async () => {
    try {
      setStatus('loading');

      // Load SDK and fetch host tokens in parallel
      const [, tokenData] = await Promise.all([
        loadSDK(),
        api.getZoomHostToken(meetingId),
      ]);

      if (!mountedRef.current) return;

      if (!tokenData.signature) {
        throw new Error(
          'Zoom SDK signature could not be generated. ' +
          'Ensure ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are set on the server.'
        );
      }

      setStatus('joining');
      injectOverlayStyle();

      window.ZoomMtg.setZoomJSLib(`${ZOOM_SDK_CDN}/lib`, '/av');
      window.ZoomMtg.preLoadWasm();
      window.ZoomMtg.prepareWebSDK();

      window.ZoomMtg.init({
        leaveUrl: window.location.href,
        patchJsMedia: true,
        leaveOnPageUnload: false,
        success: () => {
          injectOverlayStyle(); // apply again after SDK builds its DOM

          const joinParams = {
            meetingNumber: String(meetingId),
            userName: displayName,
            zak: tokenData.zakToken,
            password: tokenData.password || '',
            success: () => {
              if (mountedRef.current) setStatus('joined');
            },
            error: (err) => {
              console.error('Zoom join error:', err);
              if (mountedRef.current) {
                setErrorMsg(
                  'Failed to join meeting: ' + (err?.reason || JSON.stringify(err))
                );
                setStatus('error');
              }
            },
          };

          // For Zoom General Apps, Client ID == SDK Key and Client Secret == SDK Secret.
          // The signature was generated on the backend using those same credentials.
          joinParams.signature = tokenData.signature;
          joinParams.sdkKey    = tokenData.sdkKey;

          window.ZoomMtg.join(joinParams);
        },
        error: (err) => {
          console.error('Zoom init error:', err);
          if (mountedRef.current) {
            setErrorMsg(
              'Failed to initialize Zoom SDK: ' + (err?.reason || JSON.stringify(err))
            );
            setStatus('error');
          }
        },
      });
    } catch (err) {
      console.error('ZoomMeetingEmbed error:', err);
      if (mountedRef.current) {
        setErrorMsg(err.message || 'Failed to start Zoom meeting');
        setStatus('error');
      }
    }
  }, [meetingId, api, displayName, loadSDK, injectOverlayStyle]);

  useEffect(() => {
    mountedRef.current = true;
    loadAndJoin();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  // Meeting is running — Zoom's own UI fills the viewport.
  // Show only a floating "Leave & Return" button on top.
  if (status === 'joined') {
    return (
      <div
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 10001 }}
        className="pointer-events-auto"
      >
        <button
          onClick={handleClose}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-xl flex items-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" />
          Leave &amp; Return
        </button>
      </div>
    );
  }

  // Loading / joining / error overlay shown BEFORE SDK takes over
  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[9998]">
      {/* Close / back button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        aria-label="Cancel"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="text-center text-white px-6 max-w-md">
        {(status === 'loading' || status === 'joining') && (
          <>
            <Loader className="w-12 h-12 mx-auto mb-5 animate-spin text-blue-400" />
            <p className="text-xl font-semibold mb-2">
              {status === 'loading' ? 'Loading Zoom…' : 'Starting meeting…'}
            </p>
            <p className="text-sm text-gray-400">
              {status === 'loading'
                ? 'Downloading Meeting SDK, please wait'
                : 'Connecting to Zoom — this takes a few seconds'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-400 text-6xl mb-5 leading-none">✗</div>
            <p className="text-xl font-semibold text-red-300 mb-3">Meeting failed to start</p>
            <p className="text-sm text-gray-400 leading-relaxed">{errorMsg}</p>
            <button
              onClick={handleClose}
              className="mt-8 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ZoomMeetingEmbed;
