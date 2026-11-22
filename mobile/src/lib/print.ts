import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Hand a complete HTML document to the phone's own print sheet.
 */
export async function printDocument(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/**
 * Download a PDF with the session's credential and open it in the phone's print sheet, which
 * also offers "Save as PDF" / share. Used for sick notes, which the server sends as a LOCKED
 * PDF (print only — not editable), so what is shared is exactly what the practice issued.
 */
export async function printPdf(source: { url: string; headers: Record<string, string> }, filename: string): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('This device cannot store the PDF.');
  const target = `${dir}${filename.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  const result = await FileSystem.downloadAsync(source.url, target, { headers: source.headers });
  if (result.status !== 200) throw new Error('Could not download the sick note.');
  await Print.printAsync({ uri: result.uri });
}
