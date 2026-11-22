import * as Print from 'expo-print';

/**
 * Hand a complete HTML document (a sick note) to the phone's own print sheet, which also
 * offers "Save as PDF" and sharing. The server renders the document, so web and app print
 * exactly the same thing.
 */
export async function printDocument(html: string): Promise<void> {
  await Print.printAsync({ html });
}
