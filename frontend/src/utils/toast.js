/**
 * On-screen toasts.
 *
 * addNotification() writes to the notification bell, which is easy to miss: a password
 * change that failed, or succeeded, said so only behind the bell. Every addNotification
 * now also raises a toast, and code with no access to the app context (the forgot-password
 * dialog, public pages) can call showToast directly.
 *
 * A window event keeps this free of React context, so it works on the sign-in screens and
 * anywhere else the provider tree is not in reach.
 */
export const TOAST_EVENT = 'ac:toast';

export function showToast(type, message, opts = {}) {
  if (!message || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type: type || 'info', message: String(message), ...opts } }));
  } catch (_) { /* old browsers without CustomEvent: the bell still has it */ }
}
