// Accept a profile photo only if it really is a JPEG or PNG, and strip its metadata.
//
// Photos on a public practice profile must not carry where or when they were taken, the
// device, or the author: EXIF (incl. GPS), XMP and IPTC in JPEG, and the text / EXIF chunks
// in PNG are removed. The type is decided by the bytes (magic numbers), never by the file
// name or the declared content type. Pixels are not decoded or re-encoded.

const MAX_BYTES = 2 * 1024 * 1024;

class ImageRejected extends Error {}

function sanitizeJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new ImageRejected('not a JPEG');
  const out = [buf.subarray(0, 2)];
  let i = 2; let width = 0; let height = 0;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new ImageRejected('corrupt JPEG');
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (marker === 0xd9) { out.push(buf.subarray(i, i + 2)); break; }
    if (i + 4 > buf.length) throw new ImageRejected('truncated JPEG');
    const len = buf.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (len < 2 || end > buf.length) throw new ImageRejected('truncated JPEG');
    // Start of scan: the compressed image data runs to the end; copy it all.
    if (marker === 0xda) { out.push(buf.subarray(i)); i = buf.length; break; }
    const isSof = (marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof && len >= 7) { height = buf.readUInt16BE(i + 5); width = buf.readUInt16BE(i + 7); }
    // Drop APP1 (EXIF/XMP), APP12–APP15 (Ducky/IPTC/Photoshop/…), and comments.
    const drop = marker === 0xe1 || (marker >= 0xec && marker <= 0xef) || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, end));
    i = end;
  }
  if (!width || !height) throw new ImageRejected('JPEG has no image dimensions');
  return { mime: 'image/jpeg', bytes: Buffer.concat(out), width, height };
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);

function sanitizePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new ImageRejected('not a PNG');
  const out = [PNG_SIG];
  let i = 8; let width = 0; let height = 0; let sawEnd = false;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) throw new ImageRejected('truncated PNG');
    if (type === 'IHDR') { width = buf.readUInt32BE(i + 8); height = buf.readUInt32BE(i + 12); }
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') { sawEnd = true; break; }
  }
  if (!sawEnd || !width || !height) throw new ImageRejected('incomplete PNG');
  return { mime: 'image/png', bytes: Buffer.concat(out), width, height };
}

/**
 * @param {Buffer} buf the uploaded bytes
 * @returns {{ mime, bytes, width, height }} metadata-free image
 * @throws {ImageRejected} with a message safe to show the user
 */
function sanitizeImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new ImageRejected('No image was received.');
  if (buf.length > MAX_BYTES) throw new ImageRejected('Images must be 2 MB or smaller.');
  if (buf[0] === 0xff && buf[1] === 0xd8) return sanitizeJpeg(buf);
  if (buf.subarray(0, 8).equals(PNG_SIG)) return sanitizePng(buf);
  throw new ImageRejected('Only JPEG and PNG images can be used.');
}

module.exports = { sanitizeImage, ImageRejected, MAX_BYTES };
