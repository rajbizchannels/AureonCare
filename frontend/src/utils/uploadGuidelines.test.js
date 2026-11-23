import { checkUpload, guidelineText, UPLOAD_GUIDELINES } from './uploadGuidelines';

const file = (name, type, size) => ({ name, type, size });

describe('upload guidelines', () => {
  it('describes the practice profile images with formats, limit and recommended size', () => {
    expect(guidelineText('cover')).toMatch(/JPEG or PNG · up to 2 MB · 1600 × 400 px recommended \(4:1/);
    expect(guidelineText('logo')).toMatch(/512 × 512/);
    expect(guidelineText('messageAttachment')).toMatch(/5 MB each, 5 per message/);
  });
  it('refuses the wrong type before uploading', async () => {
    expect((await checkUpload('logo', file('logo.gif', 'image/gif', 1000))).error).toMatch(/JPEG or PNG/);
    expect((await checkUpload('edi835', file('era.pdf', 'application/pdf', 1000))).error).toMatch(/\.835/);
  });
  it('refuses a file over the limit, naming its size and the limit', async () => {
    const r = await checkUpload('cover', file('big.jpg', 'image/jpeg', 3 * 1024 * 1024));
    expect(r.error).toMatch(/3 MB — the limit is 2 MB/);
  });
  it('accepts a file within the rules', async () => {
    expect(await checkUpload('medicalRecord', file('scan.pdf', 'application/pdf', 500 * 1024))).toEqual({});
    expect(UPLOAD_GUIDELINES.gallery.note).toMatch(/12 photos/);
  });
});
