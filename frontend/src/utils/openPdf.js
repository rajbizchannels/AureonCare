/**
 * Open a PDF fetched with the session (a sick note) in a new tab, where the browser's viewer
 * prints or saves it. The tab is opened synchronously, inside the click, so a pop-up blocker
 * allows it; the PDF is loaded into it once fetched. Falls back to a download.
 */
export async function openPdf(getBlob, filename = 'document.pdf') {
  const tab = window.open('', '_blank');
  try {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (tab && !tab.closed) tab.close();
    throw e;
  }
}
