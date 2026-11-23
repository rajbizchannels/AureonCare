// What each upload accepts, in one place — shown next to the upload control and checked before
// anything is sent. The limits mirror the server's (it enforces them too):
//   images  backend/utils/imageSanitize.js (JPEG/PNG, 2 MB, metadata stripped)
//   gallery backend/routes/practiceProfile.js (12 photos)
//   records backend/routes/medical-records.js (10 MB; JPEG, PNG, PDF, DOC, DOCX, TXT)
//   message backend/routes/messages.js (5 MB each, 5 per message)
//   EDI 835 backend/routes/edi.js (10 MB; .txt .edi .835 .x12)
//   backup  backend/server.js JSON body limit (10 MB)
// Recommended sizes come from how the public profile page shows them (backend/routes/publicProfile.js):
// cover full width up to 280 px tall, logo a 72 px rounded square, gallery 160 × 140 tiles,
// provider photo a 56 px circle — doubled or more so they stay sharp on high-density screens.

const MB = 1024 * 1024;

export const UPLOAD_GUIDELINES = {
  cover: {
    label: 'Cover photo (banner)', formats: ['image/jpeg', 'image/png'], formatText: 'JPEG or PNG', maxBytes: 2 * MB,
    recommended: { w: 1600, h: 400 }, min: { w: 1200, h: 300 }, aspect: '4:1, wide',
    note: 'Shown across the top of your public page and cropped to fit — keep faces and text in the centre.',
  },
  logo: {
    label: 'Logo', formats: ['image/jpeg', 'image/png'], formatText: 'JPEG or PNG', maxBytes: 2 * MB,
    recommended: { w: 512, h: 512 }, min: { w: 200, h: 200 }, aspect: '1:1, square',
    note: 'Shown small with rounded corners — a simple mark with some padding works best; use PNG for a transparent background.',
  },
  gallery: {
    label: 'Gallery photo', formats: ['image/jpeg', 'image/png'], formatText: 'JPEG or PNG', maxBytes: 2 * MB,
    recommended: { w: 1200, h: 900 }, min: { w: 800, h: 600 }, aspect: '4:3, landscape',
    note: 'Up to 12 photos. No patients or patient information in photos.',
  },
  provider: {
    label: 'Provider photo', formats: ['image/jpeg', 'image/png'], formatText: 'JPEG or PNG', maxBytes: 2 * MB,
    recommended: { w: 400, h: 400 }, min: { w: 200, h: 200 }, aspect: '1:1, square',
    note: 'Shown as a circle — a head-and-shoulders photo, face centred.',
  },
  medicalRecord: {
    label: 'Medical record', extensions: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt'],
    formatText: 'PDF, JPEG, PNG, DOC, DOCX or TXT', maxBytes: 10 * MB,
    note: 'Scans: 300 dpi in colour or greyscale is plenty; a multi-page scan is best as one PDF.',
  },
  messageAttachment: {
    label: 'Attachment', formatText: 'Images, PDFs and documents', maxBytes: 5 * MB, maxFiles: 5,
  },
  edi835: {
    label: 'ERA / 835 file', extensions: ['.txt', '.edi', '.835', '.x12'], formatText: '.835, .edi, .x12 or .txt', maxBytes: 10 * MB,
    note: 'The remittance file from your clearinghouse or payer, unchanged.',
  },
  backup: {
    label: 'Backup file', extensions: ['.json'], formatText: 'AureonCare backup (.json)', maxBytes: 10 * MB,
  },
};

const fmtBytes = (n) => (n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.round(n / 1024)} KB`);

/** One-line guidance for the upload control. */
export function guidelineText(kind) {
  const g = UPLOAD_GUIDELINES[kind];
  if (!g) return '';
  const parts = [g.formatText, `up to ${fmtBytes(g.maxBytes)}${g.maxFiles ? ` each, ${g.maxFiles} per message` : ''}`];
  if (g.recommended) parts.push(`${g.recommended.w} × ${g.recommended.h} px recommended (${g.aspect}), at least ${g.min.w} × ${g.min.h}`);
  return parts.join(' · ');
}

const extOf = (name) => { const m = /\.[^.]+$/.exec(String(name || '').toLowerCase()); return m ? m[0] : ''; };

function imageSize(file) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/**
 * Check a file before upload. { error } — do not send (wrong type, too large);
 * { warning } — send, but tell the person (smaller than recommended, will look blurry); {} — fine.
 */
export async function checkUpload(kind, file) {
  const g = UPLOAD_GUIDELINES[kind];
  if (!g || !file) return {};
  if (g.formats && !g.formats.includes(file.type)) return { error: `${g.label}: use ${g.formatText}.` };
  if (g.extensions && !g.extensions.includes(extOf(file.name))) return { error: `${g.label}: use ${g.formatText}.` };
  if (file.size > g.maxBytes) return { error: `${g.label}: ${file.name} is ${fmtBytes(file.size)} — the limit is ${fmtBytes(g.maxBytes)}.` };
  if (g.min) {
    const d = await imageSize(file);
    if (d && (d.w < g.min.w || d.h < g.min.h)) {
      return { warning: `${g.label} is ${d.w} × ${d.h} px — smaller than the recommended ${g.recommended.w} × ${g.recommended.h}, so it may look blurry.` };
    }
  }
  return {};
}
