import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * "Continue with Google" / "Continue with Microsoft", drawn to each provider's own
 * branding rules — they ask for their logo, colours, font and label to be used unaltered:
 *
 *   Google  (developers.google.com/identity/branding-guidelines)
 *     light  #FFFFFF fill, 1px #747775 stroke, #1F1F1F text
 *     dark   #131314 fill, 1px #8E918F stroke, #E3E3E3 text
 *     Roboto Medium 14/20, 40px tall, 12px side padding, 10px logo gap, 20px "G", 4px corners
 *   Microsoft (learn.microsoft.com/entra/identity-platform/howto-add-branding-in-apps)
 *     light  #FFFFFF fill, 1px #8C8C8C border, #5E5E5E text
 *     dark   #2F2F2F fill, no visible border, #FFFFFF text
 *     Segoe UI Semibold 15px, 41px tall, 12px padding, 12px logo gap, 21px logo, square corners
 *
 * The logos are the providers' published marks, not redrawn.
 */

export const GoogleLogo = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export const MicrosoftLogo = ({ size = 21 }) => (
  <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden="true" focusable="false">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
);

const STYLES = {
  google: {
    light: { background: '#FFFFFF', border: '1px solid #747775', color: '#1F1F1F' },
    dark: { background: '#131314', border: '1px solid #8E918F', color: '#E3E3E3' },
    base: {
      fontFamily: "'Roboto', Arial, sans-serif", fontWeight: 500, fontSize: 14, lineHeight: '20px',
      letterSpacing: '0.25px', height: 40, padding: '0 12px', gap: 10, borderRadius: 4,
    },
    hover: { light: 'rgba(48,48,48,0.08)', dark: 'rgba(227,227,227,0.08)' },
  },
  microsoft: {
    light: { background: '#FFFFFF', border: '1px solid #8C8C8C', color: '#5E5E5E' },
    dark: { background: '#2F2F2F', border: '1px solid #2F2F2F', color: '#FFFFFF' },
    base: {
      fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
      fontWeight: 600, fontSize: 15, lineHeight: '20px', height: 41, padding: '0 12px', gap: 12, borderRadius: 0,
    },
    hover: { light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.08)' },
  },
};

const LABEL = { google: 'Continue with Google', microsoft: 'Continue with Microsoft' };

const SocialSignInButton = ({ provider, onClick, theme = 'light', disabled = false, busy = false, label, busyLabel = 'Connecting…', className = '', fullWidth = true }) => {
  const s = STYLES[provider];
  const mode = theme === 'dark' ? 'dark' : 'light';
  const [hover, setHover] = React.useState(false);
  const text = busy ? busyLabel : (label || LABEL[provider]);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-provider={provider}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative inline-flex items-center justify-center select-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        ...s.base, ...s[mode],
        // The providers specify a state layer for hover rather than a different colour.
        backgroundImage: hover && !(disabled || busy) ? `linear-gradient(${s.hover[mode]}, ${s.hover[mode]})` : undefined,
      }}
    >
      {busy
        ? <Loader2 className="animate-spin" size={provider === 'google' ? 20 : 21} aria-hidden="true" />
        : provider === 'google' ? <GoogleLogo /> : <MicrosoftLogo />}
      <span className="truncate">{text}</span>
    </button>
  );
};

export default SocialSignInButton;
