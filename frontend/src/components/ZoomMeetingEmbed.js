import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader } from 'lucide-react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

/**
 * ZoomMeetingEmbed — Component View (v5.x, npm)
 *
 * Renders a Zoom meeting inline inside AureonCare using the Zoom Meeting SDK
 * Component View. No new tab or popup is opened.
 *
 * Requirements (handled automatically):
 *  - @zoom/meetingsdk npm package (installed)
 *  - SDK binary assets (WASM, workers) served from /zoom-lib
 *    → copied there by `npm run prestart / prebuild` via scripts/copy-zoom-lib.js
 *
 * Props:
 *   meetingId   {string}   Zoom meeting number
 *   onClose     {function} Called when the user leaves or cancels
 *   api         {object}   apiService instance
 *   displayName {string}   Name shown in meeting (default: "Host")
 */

// One SDK client instance per page load — reused across mounts/unmounts.
let _zoomClient = null;
function getZoomClient() {
  if (!_zoomClient) {
    _zoomClient = ZoomMtgEmbedded.createClient();
  }
  return _zoomClient;
}

const ZoomMeetingEmbed = ({ meetingId, onClose, api, displayName = 'Host' }) => {
  const containerRef   = useRef(null);
  const mountedRef     = useRef(true);
  const joinedRef      = useRef(false);

  const [status,   setStatus]   = useState('loading'); // loading | joining | joined | error
  const [errorMsg, setErrorMsg] = useState(null);

  // ------------------------------------------------------------------
  // Cleanup: leave the meeting and reset the SDK client reference so
  // a future mount can re-initialize cleanly.
  // ------------------------------------------------------------------
  const cleanup = useCallback(() => {
    if (joinedRef.current) {
      try { getZoomClient().leaveMeeting({}); } catch (_) {}
      joinedRef.current = false;
      _zoomClient = null; // force re-create on next session
    }
  }, []);

  // ------------------------------------------------------------------
  // Main flow: fetch tokens → init SDK → join meeting
  // ------------------------------------------------------------------
  const loadAndJoin = useCallback(async () => {
    try {
      setStatus('loading');

      // Fetch host tokens from backend (ZAK + SDK signature)
      const tokenData = await api.getZoomHostToken(meetingId);

      if (!mountedRef.current) return;

      if (!tokenData.signature) {
        throw new Error(
          'Zoom SDK signature could not be generated. ' +
          'Ensure ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are set on the server, ' +
          'then reconnect Zoom in Admin Settings.'
        );
      }

      setStatus('joining');

      const client = getZoomClient();

      // Initialize the SDK — points it at the binary assets we copied to public/
      await client.init({
        zoomAppRoot: containerRef.current,
        language:    'en-US',
        patchJsMedia: true,
        // Binary assets (WASM, AV workers) live in the av/ subdirectory.
        // Files are copied to public/zoom-lib by `npm run prestart/prebuild`.
        assetPath: `${window.location.origin}/zoom-lib/av`,
      });

      // Join the meeting as host
      await client.join({
        signature:     tokenData.signature,
        sdkKey:        tokenData.sdkKey,
        meetingNumber: String(meetingId),
        password:      tokenData.password || '',
        userName:      displayName,
        zak:           tokenData.zakToken,
      });

      joinedRef.current = true;
      if (mountedRef.current) setStatus('joined');
    } catch (err) {
      console.error('ZoomMeetingEmbed error:', err);
      if (mountedRef.current) {
        setErrorMsg(err.message || 'Failed to start Zoom meeting');
        setStatus('error');
      }
    }
  }, [meetingId, api, displayName]);

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
  // Render — full-screen overlay layout:
  //   ┌────────────────────────────────────┐
  //   │  Zoom Meeting   [Leave & Return]   │  ← always-visible header
  //   ├────────────────────────────────────┤
  //   │                                    │
  //   │   SDK renders here (containerRef)  │  ← flex-1
  //   │                                    │
  //   └────────────────────────────────────┘
  //   Loading / error overlay sits on top (absolute, z-10) while joining
  // ------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[9998] bg-gray-900 flex flex-col">

      {/* Header — always visible so the user can leave at any time */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <span className="text-white text-sm font-semibold">Zoom Meeting</span>
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Leave &amp; Return
        </button>
      </div>

      {/* SDK container — the Component View renders the meeting UI here */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-hidden"
        style={{ minHeight: 0 }}
      />

      {/* Loading / error overlay — shown until the meeting is joined */}
      {(status === 'loading' || status === 'joining' || status === 'error') && (
        <div className="absolute inset-0 top-[44px] bg-gray-900 flex items-center justify-center z-10">
          <div className="text-center text-white px-6 max-w-md">
            {(status === 'loading' || status === 'joining') && (
              <>
                <Loader className="w-12 h-12 mx-auto mb-5 animate-spin text-blue-400" />
                <p className="text-xl font-semibold mb-2">
                  {status === 'loading' ? 'Loading Zoom…' : 'Starting meeting…'}
                </p>
                <p className="text-sm text-gray-400">
                  {status === 'loading'
                    ? 'Preparing Meeting SDK, please wait'
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
      )}
    </div>
  );
};

export default ZoomMeetingEmbed;
