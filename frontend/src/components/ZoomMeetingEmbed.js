import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader, Shield, Circle, ExternalLink } from 'lucide-react';
import ZoomMtgEmbedded from '@zoom/meetingsdk/embedded';

const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 28;

const HIDDEN_MORE_ITEMS = [
  'polls/quizzes',
  'record',
  'breakout rooms',
  'stop summary',
  'caption settings',
  'report',
];

function hideRestrictedMenuItems(root) {
  const menuItems = root.querySelectorAll(
    '[class*="MuiMenuItem"], [class*="MuiListItem"], [role="menuitem"], li[class*="dropdown-item"]'
  );
  menuItems.forEach((item) => {
    const text = (item.textContent || '').trim().toLowerCase();
    if (HIDDEN_MORE_ITEMS.some((label) => text === label || text.startsWith(label))) {
      item.style.display = 'none';
    }
  });
}

const ZoomMeetingEmbed = ({ meetingId, onClose, api, displayName = 'Host' }) => {
  const containerRef = useRef(null);
  const clientRef    = useRef(null);
  const mountedRef   = useRef(true);
  const joinedRef    = useRef(false);

  const [status,   setStatus]   = useState('consent'); // consent | loading | joining | joined | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [aanVisible, setAanVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingConsent, setShowRecordingConsent] = useState(false);

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
      // The customize.activeApps.popper config ensures the Active Apps Notifier
      // (AAN) panel is positioned visibly in the top-left of the meeting area.
      // meetingInfo includes all default items so the AAN shield icon is rendered.
      await client.init({
        zoomAppRoot: containerRef.current,
        language:    'en-US',
        patchJsMedia: true,
        // Binary assets (WASM, AV workers) live in the av/ subdirectory.
        // Files are copied to public/zoom-lib by `npm run prestart/prebuild`.
        assetPath: `${window.location.origin}/zoom-lib/av`,
        customize: {
          // Show all meeting info items including the AAN shield icon
          meetingInfo: ['topic', 'host', 'mn', 'pwd', 'telPwd', 'invite', 'participant', 'dc', 'enctype'],
          // Position the Active Apps Notifier panel visibly in the top-left corner
          activeApps: {
            popper: {
              disableDraggable: false,
              placement: 'bottom-start',
              anchorReference: 'anchorPosition',
              anchorPosition: {
                top: 0,
                left: 0,
              },
            },
          },
          // Position the meeting info panel below the top-left corner
          meeting: {
            popper: {
              disableDraggable: false,
              placement: 'bottom-start',
              anchorReference: 'anchorPosition',
              anchorPosition: {
                top: 0,
                left: 0,
              },
            },
          },
        },
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

      // Listen for recording state changes to show persistent indicator
      // and consent dialog per Zoom Marketplace legal requirements.
      client.on('recording-change', (payload) => {
        if (!mountedRef.current) return;
        const recording = payload === 'Recording' || payload === 'recording';
        setIsRecording(recording);
        if (recording) {
          setShowRecordingConsent(true);
        }
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

  // Start loading only after user consents (status goes from 'consent' → 'loading')
  useEffect(() => {
    mountedRef.current = true;
    if (status === 'loading' && !joinedRef.current) {
      loadAndJoin();
    }
    return () => {
      mountedRef.current = false;
      endActiveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'loading']);

  // Hide disallowed items from the SDK "More" dropdown whenever it opens.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          hideRestrictedMenuItems(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleClose = useCallback(async () => {
    await endActiveSession();
    onClose();
  }, [endActiveSession, onClose]);

  // Audio/visual consent screen — Zoom Marketplace legal requirement.
  // Must be shown before joining so participants can consent or decline.
  if (status === 'consent') {
    return (
      <div className="fixed inset-0 z-[9998] bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-lg mx-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Telehealth Session Notice</h2>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-200 font-medium mb-2">Audio &amp; Video Consent</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                By joining this meeting, you consent to your audio and video being transmitted
                to other participants. This session uses Zoom's Meeting SDK to provide telehealth
                services through the AureonCare platform.
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-200 font-medium mb-2">Recording Notice</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                This meeting may be recorded for quality assurance and medical record purposes.
                If recording begins, you will be notified and may choose to leave. By continuing,
                you acknowledge that the host may initiate recording during this session.
              </p>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-200 font-medium mb-2">App Content Access</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                The AureonCare Telehealth app accesses meeting content (video, audio, and chat)
                to provide healthcare services. This information is handled in accordance with
                applicable privacy regulations.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500 mb-6">
            <div className="flex items-center gap-3">
              <a
                href="https://explore.zoom.us/en/terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 underline"
              >
                Zoom Terms of Service
              </a>
              <a
                href="https://explore.zoom.us/en/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 underline"
              >
                Zoom Privacy Policy
              </a>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
            >
              Decline &amp; Leave
            </button>
            <button
              onClick={() => setStatus('loading')}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              I Agree &amp; Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-gray-900">

      {/* Header */}
      <div
        style={{ height: HEADER_HEIGHT }}
        className="flex items-center justify-between px-4 bg-gray-800 border-b border-gray-700"
      >
        <div className="flex items-center gap-3">
          <span className="text-white text-sm font-semibold">Zoom Meeting</span>

          {/* Recording indicator — persistent red badge when recording is active */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-600/20 border border-red-500/40">
              <Circle className="w-2.5 h-2.5 text-red-500 fill-red-500 animate-pulse" />
              <span className="text-xs text-red-300 font-medium">Recording</span>
            </div>
          )}

          {/* Active Apps Notifier (AAN) — Zoom Marketplace requirement */}
          {status === 'joined' && (
            <button
              onClick={() => {
                const root = containerRef.current;
                if (root) {
                  const aanBtn = root.querySelector('[class*="active-apps"]')
                    || root.querySelector('[data-type="activeApps"]')
                    || root.querySelector('.meeting-info-icon__icon-aan')
                    || root.querySelector('[class*="aan"]');
                  if (aanBtn) { aanBtn.click(); return; }
                }
                setAanVisible(v => !v);
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 transition-colors"
              title="Active Apps Notifier — This app is accessing meeting content"
            >
              <Shield className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs text-green-300 font-medium">App Active</span>
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
          Leave &amp; Return
        </button>
      </div>

      {/* Recording consent dialog — shown when recording starts mid-meeting */}
      {showRecordingConsent && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-2 mb-4">
              <Circle className="w-4 h-4 text-red-500 fill-red-500" />
              <h3 className="text-white text-base font-semibold">Recording in Progress</h3>
            </div>
            <p className="text-sm text-gray-300 mb-2">
              This meeting is now being recorded by the host.
            </p>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              By staying in this meeting, you consent to being recorded. The recording may include
              your audio, video, and any content shared during the session. If you do not consent,
              please leave the meeting now.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRecordingConsent(false); handleClose(); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                Leave Meeting
              </button>
              <button
                onClick={() => setShowRecordingConsent(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                I Consent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AAN panel */}
      {aanVisible && status === 'joined' && (
        <div
          className="absolute z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-4"
          style={{ top: HEADER_HEIGHT + 8, left: 16, width: 320 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <h3 className="text-white text-sm font-semibold">Active Apps Notifier</h3>
            </div>
            <button onClick={() => setAanVisible(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3 mb-3">
            <p className="text-xs text-gray-300 font-medium mb-1">AureonCare Telehealth</p>
            <p className="text-xs text-gray-400">
              This app is currently accessing meeting content including video and audio
              to provide telehealth services.
            </p>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            The host is using an app that can access meeting content.
            You can learn more about this app on the{' '}
            <a
              href="https://marketplace.zoom.us/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Zoom App Marketplace
            </a>.
          </p>
        </div>
      )}

      {/* SDK container */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top:    HEADER_HEIGHT,
          left:   0,
          right:  0,
          bottom: FOOTER_HEIGHT,
        }}
      />

      {/* Legal notice footer — Zoom Terms of Service + Privacy Policy links */}
      <div
        style={{ height: FOOTER_HEIGHT }}
        className="absolute left-0 right-0 bottom-0 flex items-center justify-center gap-4 bg-gray-800/90 border-t border-gray-700/50 px-4"
      >
        <span className="text-[10px] text-gray-500">Powered by Zoom</span>
        <a
          href="https://explore.zoom.us/en/terms/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
        >
          Terms of Service <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <a
          href="https://explore.zoom.us/en/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
        >
          Privacy Policy <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* Loading / error overlay */}
      {(status === 'loading' || status === 'joining' || status === 'error') && (
        <div
          className="absolute left-0 right-0 bg-gray-900 flex items-center justify-center z-10"
          style={{ top: HEADER_HEIGHT, bottom: FOOTER_HEIGHT }}
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
