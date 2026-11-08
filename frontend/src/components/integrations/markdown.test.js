import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MarkdownView, toPlainText, extractSoap, extractCodes, parseBlocks } from './markdown';

const SCRIBE = `## SOAP Note
### Subjective
Headache for **3 days**, no fever.
### Objective
- BP 130/85
- HR 72
### Assessment
Tension-type headache.
### Plan
1. Hydration
2. Review in 1 week

## Suggested codes
- ICD-10 \`G44.209\` — Tension-type headache, unspecified — "headache for 3 days"
- CPT \`99213\` — Office visit, established patient, low complexity
`;

test('renders headings, bold, lists and code without raw markup', () => {
  render(<MarkdownView text={SCRIBE} />);
  expect(screen.getByRole('heading', { name: 'SOAP Note' })).toBeInTheDocument();
  expect(screen.getByText('3 days').tagName).toBe('STRONG');
  expect(screen.getAllByRole('listitem').length).toBe(6);
  expect(screen.getByText('G44.209').tagName).toBe('CODE');
  expect(document.body.textContent).not.toMatch(/\*\*|##/);
});

test('never renders model output as HTML', () => {
  const { container } = render(<MarkdownView text={'<img src=x onerror="alert(1)"> **hi** <script>x</script>'} />);
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
  expect(container.textContent).toContain('<img src=x');
});

test('renders a simple table', () => {
  render(<MarkdownView text={'| Code | Meaning |\n|---|---|\n| I10 | Hypertension |'} />);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'I10' })).toBeInTheDocument();
});

test('extractSoap keeps the SOAP part and drops the codes section', () => {
  const soap = extractSoap(SCRIBE);
  expect(soap).toMatch(/Subjective/);
  expect(soap).toMatch(/Review in 1 week/);
  expect(soap).not.toMatch(/Suggested codes|99213/);
});

test('extractSoap returns nothing for a codes-only answer', () => {
  expect(extractSoap('- ICD-10 `I10` — Essential hypertension')).toBe('');
});

test('toPlainText produces readable text for plain fields', () => {
  const plain = toPlainText(extractSoap(SCRIBE));
  expect(plain).toMatch(/^Subjective:/);
  expect(plain).toContain('Headache for 3 days, no fever.');
  expect(plain).toContain('- BP 130/85');
  expect(plain).toContain('1. Hydration');
  expect(plain).not.toMatch(/\*\*|###/);
});

test('extractCodes finds ICD-10 and CPT codes with descriptions', () => {
  const { icd, cpt } = extractCodes(SCRIBE);
  expect(icd).toEqual([{ code: 'G44.209', description: 'Tension-type headache, unspecified' }]);
  expect(cpt).toEqual([{ code: '99213', description: 'Office visit, established patient, low complexity' }]);
});

test('extractCodes reads codes under section headings and in tables', () => {
  const md = '### ICD-10\n- E11.9 Type 2 diabetes\n- I10: Essential hypertension\n### CPT\n- 83036 HbA1c\n\n| Code | Description |\n|---|---|\n| 80053 | Metabolic panel |';
  const { icd, cpt } = extractCodes(md);
  expect(icd.map((c) => c.code)).toEqual(['E11.9', 'I10']);
  expect(cpt.map((c) => c.code)).toEqual(['83036', '80053']);
  expect(icd[1].description).toBe('Essential hypertension');
});

test('vitals and dates are not mistaken for codes', () => {
  const { icd, cpt } = extractCodes('BP 130/85, seen 2026-02-28, pain 7/10, weight 72 kg');
  expect(icd).toEqual([]);
  expect(cpt).toEqual([]);
});

test('parseBlocks copes with empty input', () => {
  expect(parseBlocks('')).toEqual([]);
  expect(toPlainText(null)).toBe('');
});
