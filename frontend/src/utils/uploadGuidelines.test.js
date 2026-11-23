import { attachTitle, checkUpload, guidelineText, labelFor, noteFor } from './uploadGuidelines';

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
    expect(noteFor('gallery')).toMatch(/12 photos/);
  });
  it('speaks the app language, falling back to English', async () => {
    expect(guidelineText('cover', 'es')).toMatch(/^JPEG o PNG · hasta 2 MB · 1600 × 400 px recomendado \(4:1, panorámica\), mínimo 1200 × 300$/);
    expect(guidelineText('messageAttachment', 'fr')).toMatch(/5 MB chacun, 5 par message/);
    expect(noteFor('gallery', 'de')).toMatch(/Bis zu 12 Fotos/);
    expect(labelFor('logo', 'ar')).toBe('الشعار');
    expect(attachTitle('de')).toMatch(/^Datei anhängen — /);
    expect((await checkUpload('cover', file('big.jpg', 'image/jpeg', 3 * 1024 * 1024), 'de')).error)
      .toBe('Titelbild (Banner): big.jpg ist 3 MB groß – die Grenze liegt bei 2 MB.');
    expect((await checkUpload('logo', file('logo.gif', 'image/gif', 1000), 'ar')).error).toMatch(/JPEG أو PNG/);
    expect(guidelineText('logo', 'xx')).toBe(guidelineText('logo'));
    expect(guidelineText('logo', 'es-MX')).toBe(guidelineText('logo', 'es'));
    for (const lang of ['es', 'fr', 'de', 'ar']) {
      for (const kind of ['cover', 'logo', 'gallery', 'provider', 'medicalRecord', 'messageAttachment', 'edi835', 'backup']) {
        expect(labelFor(kind, lang)).toBeTruthy();
        expect(guidelineText(kind, lang)).not.toBe(guidelineText(kind, 'en'));
        expect(Boolean(noteFor(kind, lang))).toBe(Boolean(noteFor(kind, 'en')));
      }
    }
  });
});
