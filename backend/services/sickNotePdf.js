// The sick note as a PDF — what Print opens and what the email attaches.
//
// Locked: AES-256 encrypted with a random owner password (thrown away), no user password, so
// anyone can open and print it but a reader cannot edit it, copy text out of it, annotate it
// or rearrange pages without breaking the encryption. Same content as the HTML certificate
// (services/sickNotes.js renderDocument).

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const SN = require('./sickNotes');

const TEAL = '#068573';

function iso(v) { return v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10); }

/** @returns {Promise<Buffer>} */
function renderPdf(note, patient = {}, practice = {}) {
  return new Promise((resolve, reject) => {
    const n = note;
    const doc = new PDFDocument({
      size: 'A4', margin: 56, pdfVersion: '1.7ext3',
      ownerPassword: crypto.randomBytes(24).toString('hex'),
      permissions: {
        printing: 'highResolution', modifying: false, copying: false, annotating: false,
        fillingForms: false, contentAccessibility: true, documentAssembly: false,
      },
      info: { Title: `Sick note ${n.reference}`, Author: practice.name || 'AureonCare', Subject: 'Statement of fitness', Creator: 'AureonCare' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 112;
    const left = 56;
    const voided = n.status === 'voided';
    const start = iso(n.start_date || n.startDate);
    const end = iso(n.end_date || n.endDate);
    const days = SN.daysBetween(start, end);

    // Letterhead
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111').text(practice.name || 'Medical practice', left, 56, { width: W * 0.55 });
    const meta = [SN.formatAddress(practice.address), practice.phone, practice.email].filter(Boolean).join('\n');
    doc.font('Helvetica').fontSize(9).fillColor('#333').text(meta, left + W * 0.55, 58, { width: W * 0.45, align: 'right' });
    const lineY = Math.max(doc.y, 92) + 8;
    doc.moveTo(left, lineY).lineTo(left + W, lineY).lineWidth(2).strokeColor(TEAL).stroke();

    // Title
    doc.y = lineY + 16;
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111').text(`Statement of fitness for ${SN.PURPOSES[n.purpose] || 'work'}`, left);
    doc.font('Courier').fontSize(9).fillColor('#333')
      .text(`Reference ${n.reference}${voided ? `  ·  VOIDED${n.void_reason || n.voidReason ? ` — ${n.void_reason || n.voidReason}` : ''}` : ''}`);
    doc.moveDown(0.8);

    const row = (k, v, bold = false) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(11).fillColor('#444').text(k, left, y, { width: W * 0.36 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111').text(v, left + W * 0.38, y, { width: W * 0.62 });
      doc.moveDown(0.35);
    };
    row('Patient', `${patient.first_name || ''} ${patient.last_name || ''}`.trim(), true);
    if (patient.date_of_birth) row('Date of birth', SN.longDate(patient.date_of_birth));
    if (patient.mrn) row('Patient number', String(patient.mrn));
    row('Assessed on', SN.longDate(n.assessed_on || n.assessedOn));
    row('Condition', n.condition_text || n.conditionText || 'A medical condition');
    doc.moveDown(0.5);

    // Advice box
    const boxTop = doc.y;
    doc.x = left + 12;
    doc.font('Helvetica').fontSize(11).fillColor('#111').text('I advise that this patient', left + 12, boxTop + 10, { width: W - 24 });
    doc.font('Helvetica-Bold').fontSize(13).text(SN.adviceText({ fitness: n.fitness, purpose: n.purpose }), { width: W - 24 });
    const adj = (n.adjustments || []).map((a) => SN.ADJUSTMENTS[a] || a);
    if (n.fitness === 'may_be_fit' && adj.length) {
      doc.moveDown(0.3).font('Helvetica').fontSize(11).text('If available, and with the agreement of the employer or school:', { width: W - 24 });
      for (const a of adj) doc.text(`•  ${a}`, { width: W - 24, indent: 8 });
    }
    if (n.comments) doc.moveDown(0.3).font('Helvetica-Oblique').fontSize(11).text(`Comments: ${n.comments}`, { width: W - 24 });
    const boxBottom = doc.y + 10;
    doc.roundedRect(left, boxTop, W, boxBottom - boxTop, 4).lineWidth(0.8).strokeColor('#999').stroke();
    doc.y = boxBottom + 12; doc.x = left;

    row('This applies', `from ${SN.longDate(start)} to ${SN.longDate(end)} (${days} day${days === 1 ? '' : 's'})`, true);
    row('Review needed at the end', (n.follow_up ?? n.followUp) ? 'Yes — I will need to assess fitness again' : 'No');

    // Signature block
    doc.moveDown(2);
    const sigY = doc.y;
    doc.moveTo(left, sigY + 24).lineTo(left + 180, sigY + 24).lineWidth(0.8).strokeColor('#333').stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#333').text('Signature', left, sigY + 28);
    const who = [n.issuer_name || n.issuerName, n.issuer_title || n.issuerTitle].filter(Boolean).join(', ');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(who, left + W * 0.5, sigY, { width: W * 0.5, align: 'right' });
    const reg = n.issuer_registration || n.issuerRegistration;
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    if (reg) doc.text(`Registration no. ${reg}`, left + W * 0.5, doc.y, { width: W * 0.5, align: 'right' });
    doc.text(`Issued ${SN.longDate(n.created_at || n.createdAt || new Date())}`, left + W * 0.5, doc.y, { width: W * 0.5, align: 'right' });

    // Footer
    const footY = Math.max(doc.y + 30, sigY + 70);
    doc.moveTo(left, footY).lineTo(left + W, footY).lineWidth(0.5).strokeColor('#ccc').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#444').text(
      `To check this note is genuine, contact ${practice.name || 'the practice'}${practice.phone ? ` on ${practice.phone}` : ''} and quote reference ${n.reference}. `
      + 'This note is for the patient to give to an employer, school or benefits office; it does not state a diagnosis unless the patient agreed to one being included.',
      left, footY + 6, { width: W });

    if (voided) {
      doc.save().rotate(-20, { origin: [doc.page.width / 2, doc.page.height / 2] })
        .font('Helvetica-Bold').fontSize(96).fillColor('#C80000').fillOpacity(0.15)
        .text('VOID', 0, doc.page.height / 2 - 60, { width: doc.page.width, align: 'center' }).restore();
    }
    doc.end();
  });
}

module.exports = { renderPdf };
