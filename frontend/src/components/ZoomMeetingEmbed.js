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

const HEADER_HEIGHT = 44; // px — must match the header div height below

const ZoomMeetingEmbed = ({ meetingId, onClose, api, displayName = 'Host' }) => {
  const containerRef = useRef(null);
  const clientRef    = useRef(null);   // per-instance SDK client (no module singleton)
  const mountedRef   = useRef(true);
  const joinedRef    = useRef(false);

  const [status,   setStatus]   = useState('loading'); // loading | joining | joined | error
  const [errorMsg, setErrorMsg] = useState(null);

  // ------------------------------------------------------------------
  // Tear down any active or stale SDK session.
  // As host, endMeeting() terminates the meeting for all; leaveMeeting()
  // as fallback in case the SDK isn't fully joined yet.
  // Always nulls clientRef so the next call to loadAndJoin() gets a
  // fresh SDK client — this is the fix for errorCode 3000.
  // ------------------------------------------------------------------
  const endActiveSession = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.endMeeting({});
    } catch (_) {
      try { client.leaveMeeting({}); } catch (__) {}
    }
    clientRef.current = null;
    joinedRef.current = false;
  }, []);

  // ------------------------------------------------------------------
  // Main flow: fetch tokens → init SDK → join meeting
  // ------------------------------------------------------------------
  const loadAndJoin = useCallback(async () => {
    try {
      setStatus('loading');

      // Clear any stale session BEFORE creating a new client.
      // This prevents errorCode 3000 "Already has other meetings in progress."
      await endActiveSession();

      if (!mountedRef.current) return;

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

      // Create a fresh client for this session.
      const client = ZoomMtgEmbedded.createClient();
      clientRef.current = client;

      // Initialize the SDK — points it at the binary assets we copied to public/
      await client.init({
        zoomAppRoot: containerRef.current,
        language:    'en-US',
        patchJsMedia: true,
        // Binary assets (WASM, AV workers) live in the av/ subdirectory.
        // Files are copied to public/zoom-lib by `npm run prestart/prebuild`.
        assetPath: `${window.location.origin}/zoom-lib/av`,
      });

      if (!mountedRef.current) return;

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
        // SDK errors are plain objects with .reason and .errorCode fields, not Error instances.
        const msg =
          typeof err === 'object' && err !== null && err.reason
            ? `${err.reason} (code: ${err.errorCode})`
            : (err.message || 'Failed to start Zoom meeting');
        setErrorMsg(msg);
        setStatus('error');
      }
    }
  }, [meetingId, api, displayName, endActiveSession]);

  useEffect(() => {
    mountedRef.current = true;
    loadAndJoin();
    return () => {
      mountedRef.current = false;
      endActiveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(async () => {
    await endActiveSession();
    onClose();
  }, [endActiveSession, onClose]);

  // ------------------------------------------------------------------
  // Render — full-screen overlay layout:
  //   ┌────────────────────────────────────┐
  //   │  Zoom Meeting   [Leave & Return]   │  ← fixed-height header (HEADER_HEIGHT px)
  //   ├────────────────────────────────────┤
  //   │                                    │
  //   │   SDK renders here (containerRef)  │  ← fills remaining space absolutely
  //   │                                    │
  //   └────────────────────────────────────┘
  //   Loading / error overlay sits on top (absolute, z-10) while joining.
  //
  // The SDK container uses absolute positioning with an explicit pixel height so
  // it is never collapsed to 0 by flexbox (which caused the black window bug).
  // ------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[9998] bg-gray-900">

      {/* Header — always visible so the user can leave at any time */}
      <div
        style={{ height: HEADER_HEIGHT }}
        className="flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700"
      >
        <span className="text-white text-sm font-semibold">Zoom Meeting</span>
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Leave &amp; Return
        </button>
      </div>

      {/* SDK container — absolute so it always has a measurable, non-zero size */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top:    HEADER_HEIGHT,
          left:   0,
          right:  0,
          bottom: 0,
        }}
      />

      {/* Loading / error overlay — shown until the meeting is joined */}
      {(status === 'loading' || status === 'joining' || status === 'error') && (
        <div
          className="absolute left-0 right-0 bottom-0 bg-gray-900 flex items-center justify-center z-10"
          style={{ top: HEADER_HEIGHT }}
        >
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
