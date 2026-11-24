import { cellText, rowsFromTable, templateTable, csvTemplateText, isSpreadsheetName } from './importSpreadsheet';

describe('import spreadsheet helpers', () => {
  it('writes Excel dates, times, booleans and numbers the way the import expects', () => {
    expect(cellText(new Date(1984, 2, 17))).toBe('1984-03-17');
    expect(cellText(new Date(2026, 11, 1, 9, 30))).toBe('2026-12-01T09:30');
    expect(cellText(true)).toBe('yes');
    expect(cellText(6.5)).toBe('6.5');
    expect(cellText(null)).toBe('');
    expect(cellText('  P-1 ')).toBe('P-1');
  });
  it('turns a sheet into rows keyed by lower-case header, dropping blank rows', () => {
    const rows = rowsFromTable([['MRN', 'First_Name', 'Date_of_Birth'], ['P-1', 'Ana', new Date(1980, 1, 2)], ['', '', ''], ['P-2', 'Ben', '1990-12-31']]);
    expect(rows).toEqual([
      { mrn: 'P-1', first_name: 'Ana', date_of_birth: '1980-02-02' },
      { mrn: 'P-2', first_name: 'Ben', date_of_birth: '1990-12-31' },
    ]);
  });
  it('builds the template from the published format', () => {
    const fmt = { fields: [{ name: 'name', example: 'Gloves, medium' }, { name: 'sku', example: 'GLV' }] };
    expect(templateTable(fmt)).toEqual([['name', 'sku'], ['Gloves, medium', 'GLV']]);
    expect(csvTemplateText(fmt)).toBe('name,sku\r\n"Gloves, medium",GLV\r\n');
  });
  it('recognises Excel files', () => {
    expect(isSpreadsheetName('patients.XLSX')).toBe(true);
    expect(isSpreadsheetName('old.xls')).toBe(true);
    expect(isSpreadsheetName('patients.csv')).toBe(false);
  });
});
