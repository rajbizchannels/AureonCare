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

// The limits and sizes — the same in every language.
export const UPLOAD_GUIDELINES = {
  cover: { formats: ['image/jpeg', 'image/png'], maxBytes: 2 * MB, recommended: { w: 1600, h: 400 }, min: { w: 1200, h: 300 } },
  logo: { formats: ['image/jpeg', 'image/png'], maxBytes: 2 * MB, recommended: { w: 512, h: 512 }, min: { w: 200, h: 200 } },
  gallery: { formats: ['image/jpeg', 'image/png'], maxBytes: 2 * MB, recommended: { w: 1200, h: 900 }, min: { w: 800, h: 600 } },
  provider: { formats: ['image/jpeg', 'image/png'], maxBytes: 2 * MB, recommended: { w: 400, h: 400 }, min: { w: 200, h: 200 } },
  medicalRecord: { extensions: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.txt'], maxBytes: 10 * MB },
  messageAttachment: { maxBytes: 5 * MB, maxFiles: 5 },
  edi835: { extensions: ['.txt', '.edi', '.835', '.x12'], maxBytes: 10 * MB },
  backup: { extensions: ['.json'], maxBytes: 10 * MB },
};

// The words, per app language (en, es, fr, de, ar). Each kind: [label, formats, aspect, note].
const TEXT = {
  en: {
    kinds: {
      cover: ['Cover photo (banner)', 'JPEG or PNG', '4:1, wide', 'Shown across the top of your public page and cropped to fit — keep faces and text in the centre.'],
      logo: ['Logo', 'JPEG or PNG', '1:1, square', 'Shown small with rounded corners — a simple mark with some padding works best; use PNG for a transparent background.'],
      gallery: ['Gallery photo', 'JPEG or PNG', '4:3, landscape', 'Up to 12 photos. No patients or patient information in photos.'],
      provider: ['Provider photo', 'JPEG or PNG', '1:1, square', 'Shown as a circle — a head-and-shoulders photo, face centred.'],
      medicalRecord: ['Medical record', 'PDF, JPEG, PNG, DOC, DOCX or TXT', null, 'Scans: 300 dpi in colour or greyscale is plenty; a multi-page scan is best as one PDF.'],
      messageAttachment: ['Attachment', 'Images, PDFs and documents', null, null],
      edi835: ['ERA / 835 file', '.835, .edi, .x12 or .txt', null, 'The remittance file from your clearinghouse or payer, unchanged.'],
      backup: ['Backup file', 'AureonCare backup (.json)', null, null],
    },
    upTo: (size) => `up to ${size}`,
    perMessage: (n) => ` each, ${n} per message`,
    recommended: (w, h, aspect, mw, mh) => `${w} × ${h} px recommended (${aspect}), at least ${mw} × ${mh}`,
    wrongType: (label, formats) => `${label}: use ${formats}.`,
    tooLarge: (label, name, size, max) => `${label}: ${name} is ${size} — the limit is ${max}.`,
    small: (label, w, h, rw, rh) => `${label} is ${w} × ${h} px — smaller than the recommended ${rw} × ${rh}, so it may look blurry.`,
    attach: 'Attach a file',
  },
  es: {
    kinds: {
      cover: ['Foto de portada (banner)', 'JPEG o PNG', '4:1, panorámica', 'Se muestra en la parte superior de su página pública y se recorta para ajustarse: mantenga caras y texto en el centro.'],
      logo: ['Logotipo', 'JPEG o PNG', '1:1, cuadrado', 'Se muestra en tamaño pequeño con esquinas redondeadas: funciona mejor un símbolo sencillo con algo de margen; use PNG para un fondo transparente.'],
      gallery: ['Foto de la galería', 'JPEG o PNG', '4:3, horizontal', 'Hasta 12 fotos. Sin pacientes ni información de pacientes en las fotos.'],
      provider: ['Foto del profesional', 'JPEG o PNG', '1:1, cuadrado', 'Se muestra en un círculo: una foto de cabeza y hombros, con la cara centrada.'],
      medicalRecord: ['Historia clínica', 'PDF, JPEG, PNG, DOC, DOCX o TXT', null, 'Escaneos: 300 ppp en color o escala de grises es suficiente; un escaneo de varias páginas es mejor como un solo PDF.'],
      messageAttachment: ['Archivo adjunto', 'Imágenes, PDF y documentos', null, null],
      edi835: ['Archivo ERA / 835', '.835, .edi, .x12 o .txt', null, 'El archivo de remesa de su cámara de compensación o pagador, sin modificar.'],
      backup: ['Archivo de copia de seguridad', 'Copia de seguridad de AureonCare (.json)', null, null],
    },
    upTo: (size) => `hasta ${size}`,
    perMessage: (n) => ` cada uno, ${n} por mensaje`,
    recommended: (w, h, aspect, mw, mh) => `${w} × ${h} px recomendado (${aspect}), mínimo ${mw} × ${mh}`,
    wrongType: (label, formats) => `${label}: use ${formats}.`,
    tooLarge: (label, name, size, max) => `${label}: ${name} ocupa ${size}; el límite es ${max}.`,
    small: (label, w, h, rw, rh) => `${label}: ${w} × ${h} px, menor que el tamaño recomendado de ${rw} × ${rh}, por lo que puede verse borrosa.`,
    attach: 'Adjuntar un archivo',
  },
  fr: {
    kinds: {
      cover: ['Photo de couverture (bannière)', 'JPEG ou PNG', '4:1, large', 'Affichée en haut de votre page publique et recadrée pour s’adapter : gardez les visages et le texte au centre.'],
      logo: ['Logo', 'JPEG ou PNG', '1:1, carré', 'Affiché en petit avec des coins arrondis : un symbole simple avec un peu de marge fonctionne le mieux ; utilisez PNG pour un fond transparent.'],
      gallery: ['Photo de la galerie', 'JPEG ou PNG', '4:3, paysage', 'Jusqu’à 12 photos. Aucun patient ni aucune information sur un patient sur les photos.'],
      provider: ['Photo du praticien', 'JPEG ou PNG', '1:1, carré', 'Affichée dans un cercle : une photo tête et épaules, visage centré.'],
      medicalRecord: ['Dossier médical', 'PDF, JPEG, PNG, DOC, DOCX ou TXT', null, 'Numérisations : 300 ppp en couleur ou en niveaux de gris suffisent ; une numérisation de plusieurs pages est préférable en un seul PDF.'],
      messageAttachment: ['Pièce jointe', 'Images, PDF et documents', null, null],
      edi835: ['Fichier ERA / 835', '.835, .edi, .x12 ou .txt', null, 'Le fichier de remise de votre chambre de compensation ou de votre payeur, sans modification.'],
      backup: ['Fichier de sauvegarde', 'Sauvegarde AureonCare (.json)', null, null],
    },
    upTo: (size) => `jusqu’à ${size}`,
    perMessage: (n) => ` chacun, ${n} par message`,
    recommended: (w, h, aspect, mw, mh) => `${w} × ${h} px recommandé (${aspect}), au moins ${mw} × ${mh}`,
    wrongType: (label, formats) => `${label} : utilisez ${formats}.`,
    tooLarge: (label, name, size, max) => `${label} : ${name} fait ${size} — la limite est de ${max}.`,
    small: (label, w, h, rw, rh) => `${label} : ${w} × ${h} px — plus petit que les ${rw} × ${rh} recommandés, l’image risque d’être floue.`,
    attach: 'Joindre un fichier',
  },
  de: {
    kinds: {
      cover: ['Titelbild (Banner)', 'JPEG oder PNG', '4:1, breit', 'Wird oben auf Ihrer öffentlichen Seite angezeigt und passend zugeschnitten – Gesichter und Text in der Mitte halten.'],
      logo: ['Logo', 'JPEG oder PNG', '1:1, quadratisch', 'Wird klein mit abgerundeten Ecken angezeigt – ein einfaches Zeichen mit etwas Rand wirkt am besten; PNG für einen transparenten Hintergrund verwenden.'],
      gallery: ['Galeriefoto', 'JPEG oder PNG', '4:3, Querformat', 'Bis zu 12 Fotos. Keine Patienten oder Patientendaten auf den Fotos.'],
      provider: ['Foto der behandelnden Person', 'JPEG oder PNG', '1:1, quadratisch', 'Wird als Kreis angezeigt – ein Foto von Kopf und Schultern, Gesicht mittig.'],
      medicalRecord: ['Patientenakte', 'PDF, JPEG, PNG, DOC, DOCX oder TXT', null, 'Scans: 300 dpi in Farbe oder Graustufen genügen; ein mehrseitiger Scan am besten als ein PDF.'],
      messageAttachment: ['Anhang', 'Bilder, PDFs und Dokumente', null, null],
      edi835: ['ERA-/835-Datei', '.835, .edi, .x12 oder .txt', null, 'Die Zahlungsavis-Datei Ihres Clearinghouse oder Kostenträgers, unverändert.'],
      backup: ['Sicherungsdatei', 'AureonCare-Sicherung (.json)', null, null],
    },
    upTo: (size) => `bis ${size}`,
    perMessage: (n) => ` pro Datei, ${n} pro Nachricht`,
    recommended: (w, h, aspect, mw, mh) => `${w} × ${h} px empfohlen (${aspect}), mindestens ${mw} × ${mh}`,
    wrongType: (label, formats) => `${label}: bitte ${formats} verwenden.`,
    tooLarge: (label, name, size, max) => `${label}: ${name} ist ${size} groß – die Grenze liegt bei ${max}.`,
    small: (label, w, h, rw, rh) => `${label} ist ${w} × ${h} px – kleiner als die empfohlenen ${rw} × ${rh}, daher kann es unscharf wirken.`,
    attach: 'Datei anhängen',
  },
  ar: {
    kinds: {
      cover: ['صورة الغلاف (البانر)', 'JPEG أو PNG', '4:1، عريضة', 'تظهر أعلى صفحتك العامة وتُقصّ لتناسبها — اجعل الوجوه والنصوص في المنتصف.'],
      logo: ['الشعار', 'JPEG أو PNG', '1:1، مربع', 'يظهر صغيرًا بزوايا مستديرة — يناسبه رمز بسيط مع بعض الهوامش؛ استخدم PNG للحصول على خلفية شفافة.'],
      gallery: ['صورة المعرض', 'JPEG أو PNG', '4:3، أفقية', 'حتى 12 صورة. لا مرضى ولا معلومات عن المرضى في الصور.'],
      provider: ['صورة مقدّم الرعاية', 'JPEG أو PNG', '1:1، مربعة', 'تظهر داخل دائرة — صورة للرأس والكتفين مع توسيط الوجه.'],
      medicalRecord: ['السجل الطبي', 'PDF أو JPEG أو PNG أو DOC أو DOCX أو TXT', null, 'المسح الضوئي: تكفي دقة 300 نقطة في البوصة بالألوان أو بتدرّج الرمادي؛ ويُفضَّل حفظ المسح متعدد الصفحات في ملف PDF واحد.'],
      messageAttachment: ['مرفق', 'صور وملفات PDF ومستندات', null, null],
      edi835: ['ملف ERA / 835', '.835 أو .edi أو .x12 أو .txt', null, 'ملف التحويل من غرفة المقاصة أو الجهة الدافعة، دون تعديل.'],
      backup: ['ملف النسخة الاحتياطية', 'نسخة AureonCare الاحتياطية (.json)', null, null],
    },
    upTo: (size) => `حتى ${size}`,
    perMessage: (n) => ` لكل ملف، ${n} في الرسالة الواحدة`,
    recommended: (w, h, aspect, mw, mh) => `${w} × ${h} بكسل مُوصى به (${aspect})، بحد أدنى ${mw} × ${mh}`,
    wrongType: (label, formats) => `${label}: استخدم ${formats}.`,
    tooLarge: (label, name, size, max) => `${label}: حجم ${name} هو ${size} — والحد الأقصى ${max}.`,
    small: (label, w, h, rw, rh) => `${label} بحجم ${w} × ${h} بكسل — أصغر من الحجم المُوصى به ${rw} × ${rh}، لذا قد تبدو غير واضحة.`,
    attach: 'إرفاق ملف',
  },
};

const textFor = (lang) => TEXT[lang] || TEXT[String(lang || '').slice(0, 2)] || TEXT.en;
const words = (kind, lang) => textFor(lang).kinds[kind] || TEXT.en.kinds[kind];

const fmtBytes = (n) => (n >= MB ? `${Math.round((n / MB) * 10) / 10} MB` : `${Math.round(n / 1024)} KB`);

/** The upload's name, e.g. "Logo", in the app language. */
export const labelFor = (kind, lang = 'en') => (UPLOAD_GUIDELINES[kind] ? words(kind, lang)[0] : '');
/** The longer advice shown under the one-line guidance (or '' when there is none). */
export const noteFor = (kind, lang = 'en') => (UPLOAD_GUIDELINES[kind] ? words(kind, lang)[3] || '' : '');
/** "Attach a file — …" for the message attach button. */
export const attachTitle = (lang = 'en') => `${textFor(lang).attach} — ${guidelineText('messageAttachment', lang)}`;

/** One-line guidance for the upload control. */
export function guidelineText(kind, lang = 'en') {
  const g = UPLOAD_GUIDELINES[kind];
  if (!g) return '';
  const t = textFor(lang);
  const [, formats, aspect] = words(kind, lang);
  const parts = [formats, `${t.upTo(fmtBytes(g.maxBytes))}${g.maxFiles ? t.perMessage(g.maxFiles) : ''}`];
  if (g.recommended) parts.push(t.recommended(g.recommended.w, g.recommended.h, aspect, g.min.w, g.min.h));
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
export async function checkUpload(kind, file, lang = 'en') {
  const g = UPLOAD_GUIDELINES[kind];
  if (!g || !file) return {};
  const t = textFor(lang);
  const [label, formats] = words(kind, lang);
  if (g.formats && !g.formats.includes(file.type)) return { error: t.wrongType(label, formats) };
  if (g.extensions && !g.extensions.includes(extOf(file.name))) return { error: t.wrongType(label, formats) };
  if (file.size > g.maxBytes) return { error: t.tooLarge(label, file.name, fmtBytes(file.size), fmtBytes(g.maxBytes)) };
  if (g.min) {
    const d = await imageSize(file);
    if (d && (d.w < g.min.w || d.h < g.min.h)) {
      return { warning: t.small(label, d.w, d.h, g.recommended.w, g.recommended.h) };
    }
  }
  return {};
}
